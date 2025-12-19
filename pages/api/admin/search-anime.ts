// pages/api/admin/search-anime.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { searchAniListAnime } from "@/lib/anilist";
import { searchTmdbTv } from "@/lib/tmdb";
import { searchTvdb } from "@/lib/tvdb";

type UnifiedSearchItem = {
  source: "anilist" | "tmdb" | "tvdb";

  // one of these will exist depending on source
  anilist_id?: number;
  tmdb_id?: number;
  tvdb_id?: number | null;

  title: string;
  year: number | null;

  poster_url?: string | null;
  backdrop_url?: string | null;

  overview?: string | null;

  // keep raw in case you want to debug in dev
  raw?: any;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const q = (req.query.q as string | undefined)?.trim() ?? "";
  if (!q) {
    return res.status(400).json({ error: "Missing q" });
  }

  // Run all three searches at once
  const [ani, tmdb, tvdb] = await Promise.all([
    searchAniListAnime(q, 1, 10),
    searchTmdbTv(q),
    searchTvdb(q),
  ]);

  const items: UnifiedSearchItem[] = [];

  // AniList -> normalize
  for (const a of ani.data ?? []) {
    const displayTitle =
      a.title.userPreferred ||
      a.title.english ||
      a.title.romaji ||
      a.title.native ||
      "Untitled";

    const poster =
      a.coverImage?.extraLarge || a.coverImage?.large || a.coverImage?.medium || null;

    items.push({
      source: "anilist",
      anilist_id: a.id,
      title: displayTitle,
      year: a.seasonYear ?? null,
      poster_url: poster,
      backdrop_url: a.bannerImage ?? null,
      overview: a.description ?? null,
      raw: a,
    });
  }

  // TMDB -> normalize
  for (const t of tmdb.data ?? []) {
    const year =
      t.first_air_date && t.first_air_date.length >= 4
        ? parseInt(t.first_air_date.slice(0, 4), 10)
        : null;

    items.push({
      source: "tmdb",
      tmdb_id: t.tmdb_id,
      title: t.title,
      year: Number.isFinite(year as any) ? (year as number) : null,
      poster_url: t.poster_url ?? null,
      backdrop_url: t.backdrop_url ?? null,
      overview: t.overview ?? null,
      raw: t.raw,
    });
  }

  // TVDB -> normalize
  for (const v of tvdb.data ?? []) {
    const yearNum =
      typeof v.year === "string" ? parseInt(v.year, 10) : typeof v.year === "number" ? v.year : null;

    items.push({
      source: "tvdb",
      tvdb_id: v.tvdb_id ?? null,
      title: v.title,
      year: Number.isFinite(yearNum as any) ? (yearNum as number) : null,
      poster_url: v.image_url ?? null,
      overview: v.overview ?? null,
      raw: v.raw,
    });
  }

  return res.status(200).json({
    success: true,
    query: q,
    errors: {
      anilist: ani.error,
      tmdb: tmdb.error,
      tvdb: tvdb.error,
    },
    results: items,
  });
}
