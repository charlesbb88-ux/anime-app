import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminGuard";
import {
  getTmdbTvDetails,
  getTmdbTvImages,
  getTmdbSeasonImages,
  tmdbImageUrl,
  type TmdbImagesResponse,
  type TmdbTvDetails,
} from "@/lib/tmdb";

type AnimeRow = {
  id: string;
  tmdb_id: number | null;
};

type InsertAnimeArtwork = {
  anime_id: string;
  source: string; // "tmdb"
  kind: string;   // "poster" | "backdrop" | "logo" | "season_1_poster" etc
  url: string;
  lang: string | null;
  width: number | null;
  height: number | null;
  vote: number | null;
  is_primary: boolean;
};

function mapImages(
  animeId: string,
  kind: string,
  images: TmdbImagesResponse | null,
  key: "posters" | "backdrops" | "logos",
  primaryFilePath: string | null
): InsertAnimeArtwork[] {
  const arr = (images?.[key] ?? []) as any[];
  return arr.map((it) => {
    const url = tmdbImageUrl(it.file_path, "original");
    return {
      anime_id: animeId,
      source: "tmdb",
      kind,
      url: url!,
      lang: it.iso_639_1 ?? null,
      width: it.width ?? null,
      height: it.height ?? null,
      vote: it.vote_average ?? null,
      is_primary: primaryFilePath ? it.file_path === primaryFilePath : false,
    };
  }).filter((r) => !!r.url);
}

function bestVotedPrimary(rows: InsertAnimeArtwork[]) {
  // If none marked primary (TMDB details path missing), pick highest vote as primary.
  const hasPrimary = rows.some((r) => r.is_primary);
  if (hasPrimary) return rows;
  let bestIdx = -1;
  let bestVote = -Infinity;
  for (let i = 0; i < rows.length; i++) {
    const v = rows[i].vote ?? -Infinity;
    if (v > bestVote) {
      bestVote = v;
      bestIdx = i;
    }
  }
  if (bestIdx >= 0) rows[bestIdx].is_primary = true;
  return rows;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) return;

  const limit = Math.min(parseInt(String(req.query.limit ?? "5"), 10) || 5, 25);
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : null;

  // cursor pagination: fetch next batch by id
  let q = supabaseAdmin
    .from("anime")
    .select("id, tmdb_id")
    .not("tmdb_id", "is", null)
    .order("id", { ascending: true })
    .limit(limit);

  if (cursor) q = q.gt("id", cursor);

  const { data: animeRows, error } = await q;
  if (error) return res.status(500).json({ error: error.message });

  const rows = (animeRows ?? []) as AnimeRow[];
  if (rows.length === 0) {
    return res.status(200).json({ done: true, processed: 0, inserted: 0, nextCursor: null });
  }

  let insertedTotal = 0;
  const perAnime: any[] = [];

  for (const a of rows) {
    const animeId = a.id;
    const tvId = a.tmdb_id!;
    const startedAt = Date.now();

    // existing URLs for this anime (dedupe)
    const { data: existing, error: eExist } = await supabaseAdmin
      .from("anime_artwork")
      .select("url")
      .eq("anime_id", animeId)
      .eq("source", "tmdb");

    if (eExist) {
      perAnime.push({ animeId, tvId, ok: false, error: eExist.message });
      continue;
    }

    const existingSet = new Set((existing ?? []).map((r: any) => r.url));

    // fetch details + images
    const { data: details, error: eDet } = await getTmdbTvDetails(tvId);
    if (eDet || !details) {
      perAnime.push({ animeId, tvId, ok: false, error: eDet || "No details" });
      continue;
    }

    const { data: images, error: eImg } = await getTmdbTvImages(tvId);
    if (eImg || !images) {
      perAnime.push({ animeId, tvId, ok: false, error: eImg || "No images" });
      continue;
    }

    const d = details as TmdbTvDetails;

    let posters = mapImages(animeId, "poster", images, "posters", d.poster_path);
    let backdrops = mapImages(animeId, "backdrop", images, "backdrops", d.backdrop_path);
    let logos = mapImages(animeId, "logo", images, "logos", null);

    posters = bestVotedPrimary(posters);
    backdrops = bestVotedPrimary(backdrops);
    logos = bestVotedPrimary(logos);

    // season images (store as season_{N}_poster/backdrop/logo)
    const seasonRows: InsertAnimeArtwork[] = [];
    const seasons = d.seasons ?? [];
    for (const s of seasons) {
      const sn = s.season_number;
      if (sn == null) continue;

      const { data: sImgs } = await getTmdbSeasonImages(tvId, sn);
      // TMDB season images generally have posters, sometimes backdrops/logos
      const sp = mapImages(animeId, `season_${sn}_poster`, sImgs ?? null, "posters", s.poster_path);
      const sb = mapImages(animeId, `season_${sn}_backdrop`, sImgs ?? null, "backdrops", null);
      const sl = mapImages(animeId, `season_${sn}_logo`, sImgs ?? null, "logos", null);

      seasonRows.push(...bestVotedPrimary(sp), ...bestVotedPrimary(sb), ...bestVotedPrimary(sl));
    }

    const all = [...posters, ...backdrops, ...logos, ...seasonRows];

    // filter out already-existing URLs
    const toInsert = all.filter((r) => !existingSet.has(r.url));

    if (toInsert.length > 0) {
      const { error: eIns } = await supabaseAdmin
        .from("anime_artwork")
        .insert(toInsert);

      if (eIns) {
        perAnime.push({ animeId, tvId, ok: false, error: eIns.message });
        continue;
      }
      insertedTotal += toInsert.length;
    }

    perAnime.push({
      animeId,
      tvId,
      ok: true,
      inserted: toInsert.length,
      ms: Date.now() - startedAt,
    });
  }

  const nextCursor = rows[rows.length - 1]?.id ?? null;

  return res.status(200).json({
    done: false,
    processed: rows.length,
    inserted: insertedTotal,
    nextCursor,
    perAnime,
  });
}
