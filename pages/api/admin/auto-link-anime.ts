// pages/api/admin/auto-link-anime.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { searchTmdbTv } from "@/lib/tmdb";
import { searchTvdb } from "@/lib/tvdb";

/**
 * You already have this secret pattern in import-anime.ts.
 * Keep it consistent so only you can call this.
 */
const ADMIN_IMPORT_SECRET = process.env.ANIME_IMPORT_SECRET || "";

type Body = {
  animeId?: string; // UUID in your anime table
  secret?: string;
  // optional override: helps if title is messy
  titleOverride?: string;
  yearOverride?: number;
  episodesOverride?: number;
};

type ExternalSource = "tmdb" | "tvdb" | "anilist" | "mal";

function toDateOnly(s: string | null): string | null {
  if (!s || s.length < 10) return null;
  return s.slice(0, 10);
}

async function upsertExternalLink(args: {
  animeId: string;
  source: ExternalSource;
  externalId: string | number;
  externalType?: string | null;
  title?: string | null;
  year?: number | null;
  startDate?: string | null;
  episodes?: number | null;
  status?: string | null;
  confidence?: number; // 0..100
  matchMethod?: string | null;
  notes?: string | null;
}) {
  const external_id = String(args.externalId);
  const start_date = args.startDate ? toDateOnly(args.startDate) : null;

  const payload = {
    anime_id: args.animeId,
    source: args.source,
    external_id,
    external_type: args.externalType ?? null,
    title: args.title ?? null,
    year: args.year ?? null,
    start_date,
    episodes: args.episodes ?? null,
    status: args.status ?? null,
    confidence: typeof args.confidence === "number" ? args.confidence : 0,
    match_method: args.matchMethod ?? "auto_search",
    notes: args.notes ?? null,
  };

  const { error } = await supabaseAdmin
    .from("anime_external_links")
    .upsert(payload as any, { onConflict: "anime_id,source" });

  if (error) {
    console.error("anime_external_links upsert error:", error, payload);
    throw error;
  }
}

function normalizeTitle(s: string) {
  return s
    .toLowerCase()
    .replace(/[\(\)\[\]\:\!\?\,\.\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Very simple scoring (works surprisingly well).
 * You can refine later.
 */
function scoreCandidate(args: {
  queryTitle: string;
  queryYear: number | null;
  queryEpisodes: number | null;
  candTitle: string;
  candYear: number | null;
  candEpisodes: number | null;
}) {
  const qt = normalizeTitle(args.queryTitle);
  const ct = normalizeTitle(args.candTitle);

  let score = 0;

  // title match
  if (ct === qt) score += 60;
  else if (ct.includes(qt) || qt.includes(ct)) score += 45;
  else {
    // partial word overlap
    const qWords = new Set(qt.split(" "));
    const cWords = new Set(ct.split(" "));
    let overlap = 0;
    for (const w of qWords) if (cWords.has(w)) overlap += 1;
    score += Math.min(35, overlap * 6);
  }

  // year proximity
  if (args.queryYear && args.candYear) {
    const dy = Math.abs(args.queryYear - args.candYear);
    if (dy === 0) score += 25;
    else if (dy === 1) score += 18;
    else if (dy === 2) score += 10;
    else if (dy <= 5) score += 4;
    else score -= 10;
  }

  // episodes proximity (only if we have both)
  if (args.queryEpisodes && args.candEpisodes) {
    const de = Math.abs(args.queryEpisodes - args.candEpisodes);
    if (de === 0) score += 15;
    else if (de <= 2) score += 10;
    else if (de <= 5) score += 5;
    else score -= 10;
  }

  // clamp
  score = Math.max(0, Math.min(100, score));
  return score;
}

/**
 * Map score -> confidence bands you can use operationally.
 * - 90–100: auto-accept (safe)
 * - 75–89: likely (show in admin to confirm)
 * - <75: weak (don’t auto-fill ids)
 */
function scoreToConfidence(score: number) {
  if (score >= 92) return 100;
  if (score >= 85) return 90;
  if (score >= 75) return 80;
  if (score >= 65) return 70;
  return 50;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (ADMIN_IMPORT_SECRET) {
    const token =
      (req.headers["x-import-secret"] as string | undefined) ||
      (req.body && (req.body.secret as string | undefined));
    if (!token || token !== ADMIN_IMPORT_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const { animeId, titleOverride, yearOverride, episodesOverride } = req.body as Body;
  if (!animeId) return res.status(400).json({ error: "Missing animeId" });

  // 1) Load anime row
  const { data: anime, error: animeErr } = await supabaseAdmin
    .from("anime")
    .select("id, title, title_english, title_native, season_year, start_date, total_episodes, tmdb_id, tvdb_id")
    .eq("id", animeId)
    .single();

  if (animeErr || !anime) {
    console.error("anime load error:", animeErr);
    return res.status(500).json({ error: "Failed to load anime row" });
  }

  const baseTitle =
    (titleOverride && titleOverride.trim()) ||
    anime.title_english ||
    anime.title ||
    anime.title_native ||
    "";

  if (!baseTitle) return res.status(400).json({ error: "Anime has no title to search with" });

  const queryYear =
    typeof yearOverride === "number"
      ? yearOverride
      : typeof anime.season_year === "number"
      ? anime.season_year
      : anime.start_date
      ? parseInt(String(anime.start_date).slice(0, 4), 10)
      : null;

  const queryEpisodes =
    typeof episodesOverride === "number"
      ? episodesOverride
      : typeof anime.total_episodes === "number"
      ? anime.total_episodes
      : null;

  // 2) Search TMDB + TVDB
  const results: any = {
    tmdb: null,
    tvdb: null,
  };

  // ----- TMDB (TV) -----
  try {
    const { data: tmdbHits, error: tmdbErr } = await searchTmdbTv(baseTitle);
    if (tmdbErr) throw new Error(tmdbErr);

    const scored = (tmdbHits ?? [])
      .map((r: any) => {
        const s = scoreCandidate({
          queryTitle: baseTitle,
          queryYear,
          queryEpisodes,
          candTitle: r.title ?? "Untitled",
          candYear: typeof r.year === "number" ? r.year : null,
          candEpisodes: null, // TMDB search result doesn’t include episode count; that's fine
        });
        return { ...r, _score: s, _confidence: scoreToConfidence(s) };
      })
      .sort((a: any, b: any) => b._score - a._score);

    const best = scored[0] ?? null;

    if (best?.tmdb_id) {
      await upsertExternalLink({
        animeId: anime.id,
        source: "tmdb",
        externalId: best.tmdb_id,
        externalType: "tv",
        title: best.title ?? null,
        year: typeof best.year === "number" ? best.year : null,
        startDate: best.first_air_date ?? null,
        episodes: null,
        confidence: best._confidence,
        matchMethod: "auto_search",
        notes: `score=${best._score}`,
      });

      // optional: keep legacy column populated when we’re confident
      if (!anime.tmdb_id && best._confidence >= 90) {
        await supabaseAdmin.from("anime").update({ tmdb_id: best.tmdb_id }).eq("id", anime.id);
      }
    }

    results.tmdb = best
      ? { tmdb_id: best.tmdb_id, title: best.title, year: best.year, score: best._score, confidence: best._confidence }
      : null;
  } catch (e: any) {
    console.error("auto-link TMDB error:", e?.message || e);
    results.tmdb = { error: e?.message || "TMDB search failed" };
  }

  // ----- TVDB (series) -----
  try {
    const { data: tvdbHits, error: tvdbErr } = await searchTvdb(baseTitle);
    if (tvdbErr) throw new Error(tvdbErr);

    const scored = (tvdbHits ?? [])
      .map((r: any) => {
        const candYear =
          typeof r.year === "number" ? r.year : typeof r.year === "string" ? parseInt(r.year, 10) : null;

        const s = scoreCandidate({
          queryTitle: baseTitle,
          queryYear,
          queryEpisodes,
          candTitle: r.title ?? "Untitled",
          candYear: Number.isFinite(candYear as any) ? (candYear as any) : null,
          candEpisodes: null,
        });
        return { ...r, _score: s, _confidence: scoreToConfidence(s) };
      })
      .sort((a: any, b: any) => b._score - a._score);

    const best = scored[0] ?? null;

    if (best?.tvdb_id) {
      await upsertExternalLink({
        animeId: anime.id,
        source: "tvdb",
        externalId: best.tvdb_id,
        externalType: "tv",
        title: best.title ?? null,
        year:
          typeof best.year === "number"
            ? best.year
            : typeof best.year === "string"
            ? parseInt(best.year, 10)
            : null,
        startDate: null,
        episodes: null,
        confidence: best._confidence,
        matchMethod: "auto_search",
        notes: `score=${best._score}`,
      });

      // optional legacy column
      if (!anime.tvdb_id && best._confidence >= 90) {
        await supabaseAdmin.from("anime").update({ tvdb_id: best.tvdb_id }).eq("id", anime.id);
      }
    }

    results.tvdb = best
      ? { tvdb_id: best.tvdb_id, title: best.title, year: best.year, score: best._score, confidence: best._confidence }
      : null;
  } catch (e: any) {
    console.error("auto-link TVDB error:", e?.message || e);
    results.tvdb = { error: e?.message || "TVDB search failed" };
  }

  return res.status(200).json({
    success: true,
    anime_id: anime.id,
    query: { title: baseTitle, year: queryYear, episodes: queryEpisodes },
    best: results,
  });
}
