// pages/api/admin/auto-link-anime.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { searchTmdbTv } from "@/lib/tmdb";
import { searchTvdb } from "@/lib/tvdb";

/**
 * Admin secret (same pattern you used elsewhere)
 */
const ADMIN_IMPORT_SECRET = process.env.ANIME_IMPORT_SECRET || "";

/**
 * Bulk tuning (safe defaults)
 * - Cursor paging avoids OFFSET-skip while the filtered set is changing.
 * - Keep concurrency 1 and add a tiny delay to be nice to TMDB.
 */
const BULK_DEFAULT_LIMIT = 25;
const BULK_MAX_LIMIT = 100;
const BULK_SLEEP_MS = 250;

type Mode = "single" | "bulk";

type Body = {
  mode?: Mode;

  // single
  animeId?: string;

  // bulk (CURSOR paging)
  afterId?: string | null; // last processed anime.id (uuid). next page uses id > afterId
  limit?: number;
  onlyMissingTmdb?: boolean; // default true
  onlyMissingTvdb?: boolean; // default false

  // shared
  secret?: string;

  // optional overrides (single only)
  titleOverride?: string;
  yearOverride?: number;
  episodesOverride?: number;

  // optional switches
  tmdbOnly?: boolean; // default false (you can set true to skip tvdb block)
};

type ExternalSource = "tmdb" | "tvdb" | "anilist" | "mal";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function toInt(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

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

  if (ct === qt) score += 60;
  else if (ct.includes(qt) || qt.includes(ct)) score += 45;
  else {
    const qWords = new Set(qt.split(" "));
    const cWords = new Set(ct.split(" "));
    let overlap = 0;
    for (const w of qWords) if (cWords.has(w)) overlap += 1;
    score += Math.min(35, overlap * 6);
  }

  if (args.queryYear && args.candYear) {
    const dy = Math.abs(args.queryYear - args.candYear);
    if (dy === 0) score += 25;
    else if (dy === 1) score += 18;
    else if (dy === 2) score += 10;
    else if (dy <= 5) score += 4;
    else score -= 10;
  }

  if (args.queryEpisodes && args.candEpisodes) {
    const de = Math.abs(args.queryEpisodes - args.candEpisodes);
    if (de === 0) score += 15;
    else if (de <= 2) score += 10;
    else if (de <= 5) score += 5;
    else score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

function scoreToConfidence(score: number) {
  if (score >= 92) return 100;
  if (score >= 85) return 90;
  if (score >= 75) return 80;
  if (score >= 65) return 70;
  return 50;
}

function pickBaseTitle(anime: any, titleOverride?: string) {
  return (
    (titleOverride && titleOverride.trim()) ||
    anime.title_english ||
    anime.title ||
    anime.title_native ||
    ""
  );
}

function pickYear(anime: any, yearOverride?: number): number | null {
  if (typeof yearOverride === "number") return yearOverride;
  if (typeof anime.season_year === "number") return anime.season_year;
  if (anime.start_date) {
    const y = parseInt(String(anime.start_date).slice(0, 4), 10);
    return Number.isFinite(y) ? y : null;
  }
  return null;
}

function pickEpisodes(anime: any, episodesOverride?: number): number | null {
  if (typeof episodesOverride === "number") return episodesOverride;
  if (typeof anime.total_episodes === "number") return anime.total_episodes;
  return null;
}

async function autoLinkOne(args: {
  animeId: string;
  titleOverride?: string;
  yearOverride?: number;
  episodesOverride?: number;
  tmdbOnly?: boolean;
}) {
  const { animeId, titleOverride, yearOverride, episodesOverride, tmdbOnly } = args;

  const { data: anime, error: animeErr } = await supabaseAdmin
    .from("anime")
    .select(
      "id, title, title_english, title_native, season_year, start_date, total_episodes, tmdb_id, tvdb_id"
    )
    .eq("id", animeId)
    .single();

  if (animeErr || !anime) {
    return {
      ok: false as const,
      anime_id: animeId,
      error: "Failed to load anime row",
      details: animeErr ?? null,
    };
  }

  const baseTitle = pickBaseTitle(anime, titleOverride);
  if (!baseTitle) {
    return {
      ok: false as const,
      anime_id: anime.id,
      error: "Anime has no title to search with",
    };
  }

  const queryYear = pickYear(anime, yearOverride);
  const queryEpisodes = pickEpisodes(anime, episodesOverride);

  const best: any = { tmdb: null, tvdb: null };

  // ----- TMDB -----
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
          candEpisodes: null,
        });
        return { ...r, _score: s, _confidence: scoreToConfidence(s) };
      })
      .sort((a: any, b: any) => b._score - a._score);

    const top = scored[0] ?? null;

    if (top?.tmdb_id) {
      await upsertExternalLink({
        animeId: anime.id,
        source: "tmdb",
        externalId: top.tmdb_id,
        externalType: "tv",
        title: top.title ?? null,
        year: typeof top.year === "number" ? top.year : null,
        startDate: top.first_air_date ?? null,
        episodes: null,
        confidence: top._confidence,
        matchMethod: "auto_search",
        notes: `score=${top._score}`,
      });

      if (!anime.tmdb_id && top._confidence >= 90) {
        const { error: updErr } = await supabaseAdmin
          .from("anime")
          .update({ tmdb_id: top.tmdb_id })
          .eq("id", anime.id);
        if (updErr) console.error("anime.tmdb_id update error:", updErr);
      }
    }

    best.tmdb = top
      ? {
          tmdb_id: top.tmdb_id,
          title: top.title,
          year: top.year,
          score: top._score,
          confidence: top._confidence,
        }
      : null;
  } catch (e: any) {
    console.error("auto-link TMDB error:", e?.message || e);
    best.tmdb = { error: e?.message || "TMDB search failed" };
  }

  // ----- TVDB (optional) -----
  if (!tmdbOnly) {
    try {
      const { data: tvdbHits, error: tvdbErr } = await searchTvdb(baseTitle);
      if (tvdbErr) throw new Error(tvdbErr);

      const scored = (tvdbHits ?? [])
        .map((r: any) => {
          const candYear =
            typeof r.year === "number"
              ? r.year
              : typeof r.year === "string"
              ? parseInt(r.year, 10)
              : null;

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

      const top = scored[0] ?? null;

      if (top?.tvdb_id) {
        await upsertExternalLink({
          animeId: anime.id,
          source: "tvdb",
          externalId: top.tvdb_id,
          externalType: "tv",
          title: top.title ?? null,
          year:
            typeof top.year === "number"
              ? top.year
              : typeof top.year === "string"
              ? parseInt(top.year, 10)
              : null,
          startDate: null,
          episodes: null,
          confidence: top._confidence,
          matchMethod: "auto_search",
          notes: `score=${top._score}`,
        });

        if (!anime.tvdb_id && top._confidence >= 90) {
          const { error: updErr } = await supabaseAdmin
            .from("anime")
            .update({ tvdb_id: top.tvdb_id })
            .eq("id", anime.id);
          if (updErr) console.error("anime.tvdb_id update error:", updErr);
        }
      }

      best.tvdb = top
        ? {
            tvdb_id: top.tvdb_id,
            title: top.title,
            year: top.year,
            score: top._score,
            confidence: top._confidence,
          }
        : null;
    } catch (e: any) {
      console.error("auto-link TVDB error:", e?.message || e);
      best.tvdb = { error: e?.message || "TVDB search failed" };
    }
  }

  return {
    ok: true as const,
    anime_id: anime.id,
    query: { title: baseTitle, year: queryYear, episodes: queryEpisodes },
    best,
  };
}

async function listAnimeIdsForBulkCursor(args: {
  afterId: string | null;
  limit: number;
  onlyMissingTmdb: boolean;
  onlyMissingTvdb: boolean;
}) {
  const { afterId, limit, onlyMissingTmdb, onlyMissingTvdb } = args;

  let q = supabaseAdmin.from("anime").select("id").order("id", { ascending: true }).limit(limit);

  if (onlyMissingTmdb) q = q.is("tmdb_id", null);
  if (onlyMissingTvdb) q = q.is("tvdb_id", null);

  if (afterId) q = q.gt("id", afterId);

  const { data, error } = await q;

  if (error) {
    console.error("bulk list anime ids (cursor) error:", error);
    throw error;
  }

  const ids = (data ?? []).map((r: any) => r.id).filter(Boolean);
  return ids as string[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // auth
  if (ADMIN_IMPORT_SECRET) {
    const token =
      (req.headers["x-import-secret"] as string | undefined) ||
      (req.body && (req.body.secret as string | undefined));

    if (!token || token !== ADMIN_IMPORT_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const body = (req.body || {}) as Body;
  const mode: Mode = body.mode ?? "single";

  // ---------- SINGLE ----------
  if (mode === "single") {
    const { animeId } = body;
    if (!animeId) return res.status(400).json({ error: "Missing animeId" });

    const out = await autoLinkOne({
      animeId,
      titleOverride: body.titleOverride,
      yearOverride: body.yearOverride,
      episodesOverride: body.episodesOverride,
      tmdbOnly: !!body.tmdbOnly,
    });

    if (!out.ok) return res.status(500).json(out);
    return res.status(200).json({ success: true, ...out });
  }

  // ---------- BULK (CURSOR) ----------
  const limit = clamp(toInt(body.limit, BULK_DEFAULT_LIMIT), 1, BULK_MAX_LIMIT);

  const onlyMissingTmdb = body.onlyMissingTmdb !== false; // default true
  const onlyMissingTvdb = body.onlyMissingTvdb === true; // default false

  const tmdbOnly = !!body.tmdbOnly;

  // NOTE: cursor paging avoids OFFSET issues when tmdb_id is being updated during the run.
  const afterId = typeof body.afterId === "string" && body.afterId.trim() ? body.afterId.trim() : null;

  const started = Date.now();

  let ids: string[] = [];
  try {
    ids = await listAnimeIdsForBulkCursor({ afterId, limit, onlyMissingTmdb, onlyMissingTvdb });
  } catch (e: any) {
    return res.status(500).json({ error: "Failed to list anime ids", details: e?.message || String(e) });
  }

  if (ids.length === 0) {
    return res.status(200).json({
      success: true,
      mode: "bulk",
      processed: 0,
      linked_tmdb: 0,
      linked_tvdb: 0,
      errors: 0,
      nextAfterId: afterId,
      hasMore: false,
      duration_ms: Date.now() - started,
    });
  }

  let processed = 0;
  let linked_tmdb = 0;
  let linked_tvdb = 0;
  let errors = 0;

  const samples: any[] = [];

  for (const id of ids) {
    try {
      const out = await autoLinkOne({ animeId: id, tmdbOnly });

      processed += 1;

      const tmdbId = out.ok ? out.best?.tmdb?.tmdb_id : null;
      const tvdbId = out.ok ? out.best?.tvdb?.tvdb_id : null;

      if (tmdbId) linked_tmdb += 1;
      if (tvdbId) linked_tvdb += 1;

      if (samples.length < 5 && out.ok) {
        samples.push({
          anime_id: out.anime_id,
          tmdb: out.best?.tmdb ?? null,
          tvdb: out.best?.tvdb ?? null,
        });
      }
    } catch (e: any) {
      errors += 1;
      console.error("bulk auto-link error animeId=", id, e?.message || e);
    }

    await sleep(BULK_SLEEP_MS);
  }

  const nextAfterId = ids[ids.length - 1] ?? afterId;
  const hasMore = ids.length === limit;

  return res.status(200).json({
    success: true,
    mode: "bulk",
    afterId,
    limit,
    onlyMissingTmdb,
    onlyMissingTvdb,
    tmdbOnly,
    processed,
    linked_tmdb,
    linked_tvdb,
    errors,
    nextAfterId,
    hasMore,
    sample: samples,
    duration_ms: Date.now() - started,
  });
}
