import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminGuard";
import { getTmdbEpisodeImages, getTmdbSeasonDetails, tmdbImageUrl } from "@/lib/tmdb";

type AnimeRow = { id: string; tmdb_id: number };
type EpisodeRow = {
  id: string;
  anime_id: string;
  season_number: number | null;
  season_episode_number: number | null;
};

type InsertEpisodeArtwork = {
  anime_episode_id: string;
  source: string; // "tmdb"
  kind: string;   // "still"
  url: string;
  lang: string | null;
  width: number | null;
  height: number | null;
  vote: number | null;
  is_primary: boolean;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) return;

  const limit = Math.min(parseInt(String(req.query.limit ?? "2"), 10) || 2, 10);
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : null;

  // page anime (not episodes) so we can reuse season lookups per show
  let q = supabaseAdmin
    .from("anime")
    .select("id, tmdb_id")
    .not("tmdb_id", "is", null)
    .order("id", { ascending: true })
    .limit(limit);

  if (cursor) q = q.gt("id", cursor);

  const { data: animeRows, error } = await q;
  if (error) return res.status(500).json({ error: error.message });

  const rows = (animeRows ?? []) as any[];
  if (rows.length === 0) {
    return res.status(200).json({ done: true, processedAnime: 0, inserted: 0, nextCursor: null });
  }

  let insertedTotal = 0;
  const perAnime: any[] = [];

  for (const a of rows) {
    const animeId = a.id as string;
    const tvId = a.tmdb_id as number;
    const startedAt = Date.now();

    // load all episodes for this anime
    const { data: eps, error: eEps } = await supabaseAdmin
      .from("anime_episodes")
      .select("id, anime_id, season_number, season_episode_number")
      .eq("anime_id", animeId);

    if (eEps) {
      perAnime.push({ animeId, tvId, ok: false, error: eEps.message });
      continue;
    }

    const episodes = (eps ?? []) as EpisodeRow[];
    if (episodes.length === 0) {
      perAnime.push({ animeId, tvId, ok: true, inserted: 0, note: "no episodes" });
      continue;
    }

    // group by season for optional primary-still matching (still_path from season details)
    const bySeason = new Map<number, EpisodeRow[]>();
    for (const ep of episodes) {
      if (ep.season_number == null || ep.season_episode_number == null) continue;
      const sn = ep.season_number;
      if (!bySeason.has(sn)) bySeason.set(sn, []);
      bySeason.get(sn)!.push(ep);
    }

    // Fetch existing still URLs for all episodes (dedupe)
    const episodeIds = episodes.map((e) => e.id);
    const { data: existing, error: eExist } = await supabaseAdmin
      .from("anime_episode_artwork")
      .select("anime_episode_id, url")
      .in("anime_episode_id", episodeIds)
      .eq("source", "tmdb");

    if (eExist) {
      perAnime.push({ animeId, tvId, ok: false, error: eExist.message });
      continue;
    }

    const existingSet = new Set((existing ?? []).map((r: any) => `${r.anime_episode_id}||${r.url}`));

    let insertedForAnime = 0;
    let skippedUnmappable = 0;

    for (const [seasonNumber, seasonEps] of bySeason.entries()) {
      // get season details once to know each episode's still_path (for is_primary)
      const { data: seasonDetails } = await getTmdbSeasonDetails(tvId, seasonNumber);
      const primaryStillByEp = new Map<number, string | null>();
      for (const se of (seasonDetails?.episodes ?? [])) {
        primaryStillByEp.set(se.episode_number, se.still_path ?? null);
      }

      for (const ep of seasonEps) {
        const epNum = ep.season_episode_number!;
        const primaryStillPath = primaryStillByEp.get(epNum) ?? null;

        const { data: epImgs, error: eImgs } = await getTmdbEpisodeImages(tvId, seasonNumber, epNum);
        if (eImgs || !epImgs) continue;

        const stills = (epImgs.stills ?? []) as any[];

        const rowsToInsert: InsertEpisodeArtwork[] = stills.map((it) => {
          const url = tmdbImageUrl(it.file_path, "original");
          return {
            anime_episode_id: ep.id,
            source: "tmdb",
            kind: "still",
            url: url!,
            lang: it.iso_639_1 ?? null,
            width: it.width ?? null,
            height: it.height ?? null,
            vote: it.vote_average ?? null,
            is_primary: primaryStillPath ? it.file_path === primaryStillPath : false,
          };
        }).filter((r) => !!r.url);

        // If none marked primary and we have rows, pick highest vote
        if (rowsToInsert.length > 0 && !rowsToInsert.some((r) => r.is_primary)) {
          let bestIdx = 0;
          let bestVote = rowsToInsert[0].vote ?? -Infinity;
          for (let i = 1; i < rowsToInsert.length; i++) {
            const v = rowsToInsert[i].vote ?? -Infinity;
            if (v > bestVote) {
              bestVote = v;
              bestIdx = i;
            }
          }
          rowsToInsert[bestIdx].is_primary = true;
        }

        const deduped = rowsToInsert.filter((r) => !existingSet.has(`${r.anime_episode_id}||${r.url}`));

        if (deduped.length > 0) {
          const { error: eIns } = await supabaseAdmin
            .from("anime_episode_artwork")
            .insert(deduped);

          if (!eIns) {
            insertedForAnime += deduped.length;
            for (const r of deduped) existingSet.add(`${r.anime_episode_id}||${r.url}`);
          }
        }
      }
    }

    // Count episodes missing season_number / season_episode_number (we skip them)
    for (const ep of episodes) {
      if (ep.season_number == null || ep.season_episode_number == null) skippedUnmappable++;
    }

    insertedTotal += insertedForAnime;

    perAnime.push({
      animeId,
      tvId,
      ok: true,
      inserted: insertedForAnime,
      skippedUnmappableEpisodes: skippedUnmappable,
      ms: Date.now() - startedAt,
    });
  }

  const nextCursor = rows[rows.length - 1]?.id ?? null;

  return res.status(200).json({
    done: false,
    processedAnime: rows.length,
    inserted: insertedTotal,
    nextCursor,
    perAnime,
  });
}
