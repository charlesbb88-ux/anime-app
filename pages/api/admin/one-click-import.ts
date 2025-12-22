// pages/api/admin/one-click-import.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { searchTmdbTv, getTmdbTvDetails } from "@/lib/tmdb";
import { searchTvdb, getTvdbSeriesExtended } from "@/lib/tvdb";

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

  // simple token overlap
  const aTokens = new Set(A.split(" "));
  const bTokens = new Set(B.split(" "));
  let overlap = 0;
  for (const t of aTokens) if (bTokens.has(t)) overlap++;
  const denom = Math.max(aTokens.size, bTokens.size) || 1;
  return Math.round((overlap / denom) * 70); // up to ~70
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
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        title { romaji english native }
        description(asHtml: false)
        format
        status
        episodes
        seasonYear
        startDate { year month day }
        endDate { year month day }
        genres
        averageScore
        coverImage { extraLarge large medium }
        bannerImage
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

async function callImportAnime(req: NextApiRequest, args: { source: "tmdb" | "tvdb"; sourceId: number; targetAnimeId: string }) {
  const baseUrl = baseUrlFromReq(req);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (ADMIN_IMPORT_SECRET) {
    headers["x-import-secret"] = ADMIN_IMPORT_SECRET;
  }

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

  // security (same pattern as your other admin routes)
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

  // 1) AniList is the anchor (best for anime identity)
  let al: any = null;
  if (anilistId) {
    try {
      al = await anilistFetchMediaById(anilistId);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "AniList fetch failed" });
    }
  }

  const title =
    al?.title?.english ||
    al?.title?.romaji ||
    al?.title?.native ||
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

  const startDate =
    al?.startDate ? anilistDateToISO(al.startDate) : null;

  const endDate =
    al?.endDate ? anilistDateToISO(al.endDate) : null;

  const slug = slugifyTitle(title);

  // 2) Upsert ONE anime row (your internal truth)
  const animePayload: Record<string, any> = {
    title,
    slug,
    total_episodes: episodes,
    image_url: al?.coverImage?.extraLarge || al?.coverImage?.large || null,
    banner_image_url: al?.bannerImage || null,

    title_english: al?.title?.english || null,
    title_native: al?.title?.native || null,
    title_preferred: al?.title?.romaji || al?.title?.english || null,

    description: al?.description || null,
    format: al?.format || "TV",
    status: al?.status || null,
    season: null,
    season_year: year,
    start_date: startDate ? toDateOnly(startDate) : null,
    end_date: endDate ? toDateOnly(endDate) : null,
    average_score: typeof al?.averageScore === "number" ? al.averageScore : null,
    source: null,
    genres: Array.isArray(al?.genres) && al.genres.length ? al.genres : null,

    anilist_id: anilistId ?? null,
  };

  // if anime already exists by anilist_id, update that row; else upsert by slug
  let animeId: string | null = null;
  if (anilistId) {
    const existing = await supabaseAdmin
      .from("anime")
      .select("id")
      .eq("anilist_id", anilistId)
      .maybeSingle();

    if (existing.data?.id) {
      animeId = existing.data.id as string;
      const upd = await supabaseAdmin.from("anime").update(animePayload).eq("id", animeId).select("id").single();
      if (upd.error) return res.status(500).json({ error: upd.error.message });
      animeId = upd.data.id;
    }
  }

  if (!animeId) {
    const up = await supabaseAdmin
      .from("anime")
      .upsert(animePayload, { onConflict: "slug" })
      .select("id")
      .single();

    if (up.error || !up.data?.id) {
      return res.status(500).json({ error: up.error?.message || "Failed to upsert anime" });
    }
    animeId = up.data.id as string;
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
        episodeScore(episodes, null); // TMDB search results don't give episode counts
      const confidence = Math.max(0, Math.min(100, Math.round((s / 140) * 100)));
      if (!best || confidence > best.confidence) best = { ...r, score: s, confidence };
    }
    return best;
  })();

  const bestTvdb = (() => {
  let best: any = null;

  for (const r of tvdbSearch.data ?? []) {
    const rYear = toInt(r.year);

    // TVDB often returns Japanese name in r.title, but English aliases exist in r.raw.aliases / translations.
    const candidates: string[] = [];

const eng = r?.raw?.translations?.eng;
if (eng) candidates.push(eng); // put English first

if (r.title) candidates.push(String(r.title)); // then whatever TVDB search title is

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

    // score title against the BEST candidate (english alias usually wins)
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

  // 4) If we found candidates, we run your importer routes but FORCE into same animeId
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

  // 5) Pull back what got written into external links for this anime_id
  const links = await supabaseAdmin
    .from("anime_external_links")
    .select("id, anime_id, source, external_id, external_type, title, year, start_date, episodes, status, confidence, match_method, notes, created_at")
    .eq("anime_id", animeId);

  // extra: show the anime row too
  const animeRow = await supabaseAdmin
    .from("anime")
    .select("*")
    .eq("id", animeId)
    .single();

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
