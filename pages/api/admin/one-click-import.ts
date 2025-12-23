// pages/api/admin/one-click-import.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { searchTmdbTv } from "@/lib/tmdb";
import { searchTvdb } from "@/lib/tvdb";

const ADMIN_IMPORT_SECRET = process.env.ANIME_IMPORT_SECRET || "";

type Body = {
  anilistId?: number | string;
  title?: string;
  year?: number | string;
  episodes?: number | string;
  secret?: string;
};

function toInt(v: any): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = parseInt(v.trim(), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toDateOnly(s: string | null): string | null {
  if (!s || s.length < 10) return null;
  return s.slice(0, 10);
}

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeTitle(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleScore(a: string, b: string): number {
  const A = normalizeTitle(a);
  const B = normalizeTitle(b);
  if (!A || !B) return 0;
  if (A === B) return 100;
  if (A.includes(B) || B.includes(A)) return 85;

  const aTokens = new Set(A.split(" "));
  const bTokens = new Set(B.split(" "));
  let overlap = 0;
  for (const t of aTokens) if (bTokens.has(t)) overlap++;
  const denom = Math.max(aTokens.size, bTokens.size) || 1;
  return Math.round((overlap / denom) * 70);
}

function yearScore(a: number | null, b: number | null): number {
  if (!a || !b) return 0;
  const d = Math.abs(a - b);
  if (d === 0) return 25;
  if (d === 1) return 15;
  if (d === 2) return 8;
  return 0;
}

function episodeScore(a: number | null, b: number | null): number {
  if (!a || !b) return 0;
  const d = Math.abs(a - b);
  if (d === 0) return 15;
  if (d <= 2) return 8;
  if (d <= 5) return 3;
  return 0;
}

async function anilistFetchMediaById(anilistId: number) {
  // ✅ RESTORED: userPreferred, trailer, tags
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        title { romaji english native userPreferred }
        description(asHtml: false)
        format
        status
        episodes
        season
        seasonYear
        startDate { year month day }
        endDate { year month day }
        source
        genres
        averageScore
        coverImage { extraLarge large medium }
        bannerImage
        trailer { id site thumbnail }
        tags {
          name
          description
          rank
          isAdult
          isGeneralSpoiler
          isMediaSpoiler
          category
        }
      }
    }
  `;

  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables: { id: anilistId } }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AniList HTTP ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (json?.errors?.length) throw new Error(json.errors[0]?.message || "AniList error");
  return json?.data?.Media as any;
}

function anilistDateToISO(d: any): string | null {
  const y = d?.year;
  const m = d?.month;
  const day = d?.day;
  if (!y || !m || !day) return null;
  const mm = String(m).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function baseUrlFromReq(req: NextApiRequest) {
  const proto = (req.headers["x-forwarded-proto"] as string) || "http";
  const host = req.headers.host;
  return `${proto}://${host}`;
}

async function callImportAnime(
  req: NextApiRequest,
  args: { source: "tmdb" | "tvdb"; sourceId: number; targetAnimeId: string }
) {
  const baseUrl = baseUrlFromReq(req);

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ADMIN_IMPORT_SECRET) headers["x-import-secret"] = ADMIN_IMPORT_SECRET;

  const res = await fetch(`${baseUrl}/api/admin/import-anime`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      source: args.source,
      sourceId: args.sourceId,
      targetAnimeId: args.targetAnimeId,
    }),
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return { ok: res.ok, status: res.status, json };
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

  const body = req.body as Body;

  const anilistId = toInt(body.anilistId);
  const fallbackTitle = (body.title || "").trim();
  const fallbackYear = toInt(body.year);
  const fallbackEpisodes = toInt(body.episodes);

  if (!anilistId && !fallbackTitle) {
    return res.status(400).json({ error: "Provide anilistId OR title" });
  }

  // 1) Fetch AniList (anchor)
  let al: any = null;
  if (anilistId) {
    try {
      al = await anilistFetchMediaById(anilistId);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "AniList fetch failed" });
    }
  }

  // ✅ English-first for main display title
  const titleEnglish = al?.title?.english ?? null;
  const titleRomaji = al?.title?.romaji ?? null;
  const titleNative = al?.title?.native ?? null;
  const titlePreferred = al?.title?.userPreferred ?? null;

  const title =
    titleEnglish ||
    titleRomaji ||
    titlePreferred ||
    titleNative ||
    fallbackTitle ||
    "Untitled";

  const year =
    (typeof al?.seasonYear === "number" ? al.seasonYear : null) ??
    (typeof al?.startDate?.year === "number" ? al.startDate.year : null) ??
    fallbackYear ??
    null;

  const episodes =
    (typeof al?.episodes === "number" ? al.episodes : null) ??
    fallbackEpisodes ??
    null;

  const startDate = al?.startDate ? anilistDateToISO(al.startDate) : null;
  const endDate = al?.endDate ? anilistDateToISO(al.endDate) : null;

  const slug = slugifyTitle(title);

  const trailerSite = al?.trailer?.site ?? null;
  const trailerId = al?.trailer?.id ?? null;
  const trailerThumb = al?.trailer?.thumbnail ?? null;

  // 2) Upsert ONE anime row (internal truth)
  const animePayload: Record<string, any> = {
    title,
    slug,
    total_episodes: episodes,
    image_url: al?.coverImage?.extraLarge || al?.coverImage?.large || null,
    banner_image_url: al?.bannerImage || null,

    title_english: titleEnglish,
    title_native: titleNative,
    title_preferred: titlePreferred || titleEnglish || titleRomaji || null,

    description: al?.description || null,
    format: al?.format || "TV",
    status: al?.status || null,
    season: al?.season || null,
    season_year: year,
    start_date: startDate ? toDateOnly(startDate) : null,
    end_date: endDate ? toDateOnly(endDate) : null,
    average_score: typeof al?.averageScore === "number" ? al.averageScore : null,
    source: al?.source || null,
    genres: Array.isArray(al?.genres) && al.genres.length ? al.genres : null,

    trailer_site: trailerSite,
    trailer_id: trailerId,
    trailer_thumbnail_url: trailerThumb,

    anilist_id: anilistId ?? null,
  };

  // If anime exists by anilist_id, update that row; else upsert by slug
  let animeId: string | null = null;

  if (anilistId) {
    const existing = await supabaseAdmin
      .from("anime")
      .select("id")
      .eq("anilist_id", anilistId)
      .maybeSingle();

    if (existing.data?.id) {
      animeId = existing.data.id as string;
      const upd = await supabaseAdmin
        .from("anime")
        .update(animePayload)
        .eq("id", animeId)
        .select("id, total_episodes")
        .single();

      if (upd.error) return res.status(500).json({ error: upd.error.message });
      animeId = upd.data.id as string;
    }
  }

  if (!animeId) {
    const up = await supabaseAdmin
      .from("anime")
      .upsert(animePayload, { onConflict: "slug" })
      .select("id, total_episodes")
      .single();

    if (up.error || !up.data?.id) {
      return res.status(500).json({ error: up.error?.message || "Failed to upsert anime" });
    }
    animeId = up.data.id as string;
  }

  // 2b) ✅ Episode stub creation (best-effort)
  const finalTotalEpisodes =
    typeof animePayload.total_episodes === "number" && animePayload.total_episodes > 0
      ? animePayload.total_episodes
      : null;

  if (finalTotalEpisodes) {
    try {
      const episodesPayload = Array.from({ length: finalTotalEpisodes }, (_, idx) => ({
        anime_id: animeId,
        episode_number: idx + 1,
      }));

      const { error: episodesError } = await supabaseAdmin
        .from("anime_episodes")
        .upsert(episodesPayload, { onConflict: "anime_id,episode_number" });

      if (episodesError) console.error("Episode stub upsert error:", episodesError);
    } catch (e) {
      console.error("Episode stub creation error:", e);
    }
  }

  // 2c) ✅ Tag sync restored (delete + insert)
  try {
    const { error: deleteError } = await supabaseAdmin
      .from("anime_tags")
      .delete()
      .eq("anime_id", animeId);

    if (deleteError) console.error("anime_tags delete error:", deleteError);

    const rawTags = Array.isArray(al?.tags) ? al.tags : [];

    const tagRows = rawTags
      .filter((t: any) => t && t.name)
      .map((t: any) => ({
        anime_id: animeId,
        name: t.name,
        description: t.description ?? null,
        rank: t.rank ?? null,
        is_adult: t.isAdult ?? null,
        is_general_spoiler: t.isGeneralSpoiler ?? null,
        is_media_spoiler: t.isMediaSpoiler ?? null,
        category: t.category ?? null,
      }));

    if (tagRows.length) {
      const { error: insertError } = await supabaseAdmin.from("anime_tags").insert(tagRows);
      if (insertError) console.error("anime_tags insert error:", insertError);
    }
  } catch (e) {
    console.error("anime_tags sync unexpected error:", e);
  }

  // 3) Search TMDB + TVDB for best match
  const tmdbSearch = await searchTmdbTv(title);
  const tvdbSearch = await searchTvdb(title);

  const bestTmdb = (() => {
    let best: any = null;
    for (const r of tmdbSearch.data ?? []) {
      const s =
        titleScore(title, r.title) +
        yearScore(year, r.year ?? null) +
        episodeScore(episodes, null);
      const confidence = Math.max(0, Math.min(100, Math.round((s / 140) * 100)));
      if (!best || confidence > best.confidence) best = { ...r, score: s, confidence };
    }
    return best;
  })();

  const bestTvdb = (() => {
    let best: any = null;

    for (const r of tvdbSearch.data ?? []) {
      const rYear = toInt(r.year);

      const candidates: string[] = [];

      const eng = r?.raw?.translations?.eng;
      if (eng) candidates.push(String(eng));

      if (r.title) candidates.push(String(r.title));

      const aliases = r?.raw?.aliases;
      if (Array.isArray(aliases)) {
        for (const a of aliases) {
          if (typeof a === "string" && a.trim()) candidates.push(a.trim());
        }
      }

      const translations = r?.raw?.translations;
      if (translations && typeof translations === "object") {
        for (const v of Object.values(translations)) {
          if (typeof v === "string" && v.trim()) candidates.push(v.trim());
        }
      }

      let bestTitlePoints = 0;
      for (const c of candidates) {
        bestTitlePoints = Math.max(bestTitlePoints, titleScore(title, c));
      }

      const s = bestTitlePoints + yearScore(year, rYear);
      const confidence = Math.max(0, Math.min(100, Math.round((s / 125) * 100)));

      if (!best || confidence > best.confidence) best = { ...r, score: s, confidence };
    }

    return best;
  })();

  // 4) Import into same animeId (patch importers will not overwrite AniList)
  const importResults: any = { tmdb: null, tvdb: null };

  if (bestTmdb?.tmdb_id && bestTmdb.confidence >= 60) {
    importResults.tmdb = await callImportAnime(req, {
      source: "tmdb",
      sourceId: bestTmdb.tmdb_id,
      targetAnimeId: animeId!,
    });
  }

  if (bestTvdb?.tvdb_id && bestTvdb.confidence >= 60) {
    importResults.tvdb = await callImportAnime(req, {
      source: "tvdb",
      sourceId: Number(bestTvdb.tvdb_id),
      targetAnimeId: animeId!,
    });
  }

  // 5) Pull external links + anime row for visibility
  const links = await supabaseAdmin
    .from("anime_external_links")
    .select(
      "id, anime_id, source, external_id, external_type, title, year, start_date, episodes, status, confidence, match_method, notes, created_at"
    )
    .eq("anime_id", animeId);

  const animeRow = await supabaseAdmin.from("anime").select("*").eq("id", animeId).single();

  return res.status(200).json({
    success: true,
    anime_id: animeId,
    query: { title, year, episodes, anilist_id: anilistId ?? null },
    best: { tmdb: bestTmdb ?? null, tvdb: bestTvdb ?? null },
    imports: importResults,
    anime: animeRow.data ?? null,
    external_links: links.data ?? [],
    warnings: [
      bestTmdb && bestTmdb.confidence < 60 ? "TMDB match confidence below 60; skipped import." : null,
      bestTvdb && bestTvdb.confidence < 60 ? "TVDB match confidence below 60; skipped import." : null,
    ].filter(Boolean),
  });
}
