import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminGuard";
import {
  getTmdbTvDetails,
  getTmdbSeasonDetails,
  getTmdbEpisodeImages,
  tmdbImageUrl,
} from "@/lib/tmdb";

type AnimeRow = {
  id: string;
  anilist_id: number | null;
  tmdb_id: number | null;
  title: string | null;
};

type EpisodeRow = {
  id: string;
  anime_id: string;
  episode_number: number;
  season_number: number | null;
  season_episode_number: number | null;
  tmdb_episode_id: number | null;
  title: string | null;
  synopsis: string | null;
  air_date: string | null;
};

type InsertEpisodeArtwork = {
  anime_episode_id: string;
  source: string;
  kind: string;
  url: string;
  lang: string | null;
  width: number | null;
  height: number | null;
  vote: number | null;
  is_primary: boolean;
};

function hasMeaningfulText(v: unknown) {
  return typeof v === "string" && v.trim().length > 0;
}

function isContiguousOneToN(nums: number[]) {
  if (nums.length === 0) return false;
  const set = new Set(nums);
  if (set.size !== nums.length) return false;

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (min !== 1) return false;
  if (max !== nums.length) return false;

  for (let i = 1; i <= nums.length; i++) {
    if (!set.has(i)) return false;
  }
  return true;
}

async function mapEpisodesForAnime(animeId: string, tvId: number) {
  const { data: localEps, error: eEps } = await supabaseAdmin
    .from("anime_episodes")
    .select("id, anime_id, episode_number, season_number, season_episode_number, tmdb_episode_id")
    .eq("anime_id", animeId)
    .order("episode_number", { ascending: true });

  if (eEps) throw eEps;

  const episodes = (localEps ?? []) as EpisodeRow[];
  if (episodes.length === 0) {
    return {
      mapped: 0,
      skipped: "no local episodes",
      localUnmappedCount: 0,
      tmdbFlatCount: 0,
      partiallyMapped: false,
    };
  }

  const unmapped = episodes.filter(
    (e) => e.season_number == null && e.season_episode_number == null
  );

  if (unmapped.length === 0) {
    return {
      mapped: 0,
      skipped: "already mapped",
      localUnmappedCount: 0,
      tmdbFlatCount: 0,
      partiallyMapped: false,
    };
  }

  const nums = unmapped.map((e) => e.episode_number);
  if (!isContiguousOneToN(nums)) {
    return {
      mapped: 0,
      skipped: "local episode_number not contiguous 1..N (or duplicates/gaps)",
      localUnmappedCount: unmapped.length,
      tmdbFlatCount: 0,
      partiallyMapped: false,
    };
  }

  const { data: details, error: eDet } = await getTmdbTvDetails(tvId);
  if (eDet || !details) throw new Error(eDet || "No TMDB details");

  const seasonNums =
    (details.seasons ?? [])
      .map((s) => s.season_number)
      .filter((sn) => typeof sn === "number" && sn >= 1)
      .sort((x, y) => x - y);

  if (seasonNums.length === 0) {
    return {
      mapped: 0,
      skipped: "tmdb has no seasons >= 1",
      localUnmappedCount: unmapped.length,
      tmdbFlatCount: 0,
      partiallyMapped: false,
    };
  }

  const flat: Array<{
    season_number: number;
    season_episode_number: number;
    tmdb_episode_id: number;
  }> = [];

  for (const sn of seasonNums) {
    const { data: sd, error: eSd } = await getTmdbSeasonDetails(tvId, sn);
    if (eSd || !sd) continue;

    for (const ep of sd.episodes ?? []) {
      if (typeof ep.episode_number !== "number") continue;
      flat.push({
        season_number: sn,
        season_episode_number: ep.episode_number,
        tmdb_episode_id: ep.id,
      });
    }
  }

  if (flat.length === 0) {
    return {
      mapped: 0,
      skipped: "tmdb has no mappable episodes",
      localUnmappedCount: unmapped.length,
      tmdbFlatCount: 0,
      partiallyMapped: false,
    };
  }

  const overlapCount = Math.min(unmapped.length, flat.length);

  const updates = unmapped.slice(0, overlapCount).map((e) => {
    const idx = e.episode_number - 1;
    const tm = flat[idx];

    return {
      id: e.id,
      anime_id: e.anime_id,
      episode_number: e.episode_number,
      season_number: tm.season_number,
      season_episode_number: tm.season_episode_number,
      tmdb_episode_id: tm.tmdb_episode_id,
      updated_at: new Date().toISOString(),
    };
  });

  if (updates.length > 0) {
    const { error: eUp } = await supabaseAdmin
      .from("anime_episodes")
      .upsert(updates, { onConflict: "id" });

    if (eUp) throw eUp;
  }

  let skipped: string | null = null;
  if (unmapped.length > flat.length) {
    skipped = `TMDB has fewer episodes than local rows, so only the first ${overlapCount} were mapped`;
  } else if (flat.length > unmapped.length) {
    skipped = `TMDB has more episodes than local rows, so only the first ${overlapCount} local rows were mapped`;
  }

  return {
    mapped: updates.length,
    skipped,
    localUnmappedCount: unmapped.length,
    tmdbFlatCount: flat.length,
    partiallyMapped: unmapped.length !== flat.length,
  };
}

async function importEpisodeDetailsForAnime(animeId: string, tvId: number) {
  const { data: localEps, error: eEps } = await supabaseAdmin
    .from("anime_episodes")
    .select(
      "id, anime_id, episode_number, season_number, season_episode_number, tmdb_episode_id, title, synopsis, air_date"
    )
    .eq("anime_id", animeId)
    .order("episode_number", { ascending: true });

  if (eEps) throw eEps;

  const episodes = (localEps ?? []) as EpisodeRow[];
  if (episodes.length === 0) {
    return { updated: 0, skippedUnmappableEpisodes: 0 };
  }

  const bySeason = new Map<number, EpisodeRow[]>();
  let skippedUnmappable = 0;

  for (const ep of episodes) {
    if (ep.season_number == null || ep.season_episode_number == null) {
      skippedUnmappable++;
      continue;
    }

    const sn = ep.season_number;
    if (!bySeason.has(sn)) bySeason.set(sn, []);
    bySeason.get(sn)!.push(ep);
  }

  const updates: Array<{
    id: string;
    anime_id: string;
    episode_number: number;
    tmdb_episode_id: number | null;
    title: string | null;
    synopsis: string | null;
    air_date: string | null;
    updated_at: string;
  }> = [];

  for (const [seasonNumber, seasonEpisodes] of bySeason.entries()) {
    const { data: seasonDetails, error: eSeason } = await getTmdbSeasonDetails(tvId, seasonNumber);
    if (eSeason || !seasonDetails) continue;

    const tmdbBySeasonEpisode = new Map<
      number,
      { id: number; name: string | null; overview: string | null; air_date: string | null }
    >();

    for (const ep of seasonDetails.episodes ?? []) {
      if (typeof ep.episode_number !== "number") continue;
      tmdbBySeasonEpisode.set(ep.episode_number, {
        id: ep.id,
        name: ep.name ?? null,
        overview: ep.overview ?? null,
        air_date: ep.air_date ?? null,
      });
    }

    for (const local of seasonEpisodes) {
      const tmdbEp = tmdbBySeasonEpisode.get(local.season_episode_number!);
      if (!tmdbEp) continue;

      const missingTitle = !hasMeaningfulText(local.title) && hasMeaningfulText(tmdbEp.name);
      const missingSynopsis = !hasMeaningfulText(local.synopsis) && hasMeaningfulText(tmdbEp.overview);
      const missingAirDate = !local.air_date && !!tmdbEp.air_date;
      const missingTmdbEpisodeId = local.tmdb_episode_id == null && Number.isFinite(tmdbEp.id);

      if (!missingTitle && !missingSynopsis && !missingAirDate && !missingTmdbEpisodeId) {
        continue;
      }

      updates.push({
        id: local.id,
        anime_id: local.anime_id,
        episode_number: local.episode_number,
        tmdb_episode_id: local.tmdb_episode_id ?? tmdbEp.id ?? null,
        title: hasMeaningfulText(local.title) ? local.title : (tmdbEp.name ?? null),
        synopsis: hasMeaningfulText(local.synopsis) ? local.synopsis : (tmdbEp.overview ?? null),
        air_date: local.air_date ?? tmdbEp.air_date ?? null,
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (updates.length > 0) {
    const { error: eUp } = await supabaseAdmin
      .from("anime_episodes")
      .upsert(updates, { onConflict: "id" });

    if (eUp) throw eUp;
  }

  return {
    updated: updates.length,
    skippedUnmappableEpisodes: skippedUnmappable,
  };
}

async function importEpisodeStillsForAnime(animeId: string, tvId: number) {
  const { data: eps, error: eEps } = await supabaseAdmin
    .from("anime_episodes")
    .select("id, anime_id, season_number, season_episode_number")
    .eq("anime_id", animeId);

  if (eEps) throw eEps;

  const episodes = (eps ?? []) as EpisodeRow[];
  if (episodes.length === 0) {
    return { inserted: 0, skippedUnmappableEpisodes: 0 };
  }

  const bySeason = new Map<number, EpisodeRow[]>();
  let skippedUnmappable = 0;

  for (const ep of episodes) {
    if (ep.season_number == null || ep.season_episode_number == null) {
      skippedUnmappable++;
      continue;
    }

    const sn = ep.season_number;
    if (!bySeason.has(sn)) bySeason.set(sn, []);
    bySeason.get(sn)!.push(ep);
  }

  const episodeIds = episodes.map((e) => e.id);
  const { data: existing, error: eExist } = await supabaseAdmin
    .from("anime_episode_artwork")
    .select("anime_episode_id, url")
    .in("anime_episode_id", episodeIds)
    .eq("source", "tmdb");

  if (eExist) throw eExist;

  const existingSet = new Set((existing ?? []).map((r: any) => `${r.anime_episode_id}||${r.url}`));
  let insertedForAnime = 0;

  for (const [seasonNumber, seasonEps] of bySeason.entries()) {
    const { data: seasonDetails } = await getTmdbSeasonDetails(tvId, seasonNumber);
    const primaryStillByEp = new Map<number, string | null>();

    for (const se of seasonDetails?.episodes ?? []) {
      primaryStillByEp.set(se.episode_number, se.still_path ?? null);
    }

    for (const ep of seasonEps) {
      const epNum = ep.season_episode_number!;
      const primaryStillPath = primaryStillByEp.get(epNum) ?? null;

      const { data: epImgs, error: eImgs } = await getTmdbEpisodeImages(tvId, seasonNumber, epNum);
      if (eImgs || !epImgs) continue;

      const stills = (epImgs.stills ?? []) as any[];

      const rowsToInsert: InsertEpisodeArtwork[] = stills
        .map((it) => {
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
        })
        .filter((r) => !!r.url);

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

      const deduped = rowsToInsert.filter(
        (r) => !existingSet.has(`${r.anime_episode_id}||${r.url}`)
      );

      if (deduped.length > 0) {
        const { error: eIns } = await supabaseAdmin
          .from("anime_episode_artwork")
          .insert(deduped);

        if (!eIns) {
          insertedForAnime += deduped.length;
          for (const r of deduped) {
            existingSet.add(`${r.anime_episode_id}||${r.url}`);
          }
        }
      }
    }
  }

  return {
    inserted: insertedForAnime,
    skippedUnmappableEpisodes: skippedUnmappable,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "POST") {
    return res.status(200).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const limitRaw = Number(req.body?.limit ?? req.query.limit ?? 10);
    const limit = Math.max(1, Math.min(50, Number.isFinite(limitRaw) ? limitRaw : 10));
    const cursor = typeof (req.body?.cursor ?? req.query.cursor) === "string"
      ? (req.body?.cursor ?? req.query.cursor)
      : null;

    let q = supabaseAdmin
      .from("anime")
      .select("id, anilist_id, tmdb_id, title")
      .not("anilist_id", "is", null)
      .not("tmdb_id", "is", null)
      .order("id", { ascending: true })
      .limit(limit);

    if (cursor) q = q.gt("id", cursor);

    const { data: animeRows, error } = await q;
    if (error) return res.status(500).json({ ok: false, error: error.message });

    const rows = (animeRows ?? []) as AnimeRow[];
    if (rows.length === 0) {
      return res.status(200).json({
        ok: true,
        done: true,
        processedAnime: 0,
        nextCursor: null,
        totals: {
          mappedEpisodes: 0,
          updatedEpisodeDetails: 0,
          insertedEpisodeStills: 0,
        },
        perAnime: [],
      });
    }

    let mappedEpisodesTotal = 0;
    let updatedEpisodeDetailsTotal = 0;
    let insertedEpisodeStillsTotal = 0;

    const perAnime: any[] = [];

    for (const anime of rows) {
      const startedAt = Date.now();

      try {
        const mapping = await mapEpisodesForAnime(anime.id, anime.tmdb_id!);
        const details = await importEpisodeDetailsForAnime(anime.id, anime.tmdb_id!);
        const stills = await importEpisodeStillsForAnime(anime.id, anime.tmdb_id!);

        mappedEpisodesTotal += mapping.mapped;
        updatedEpisodeDetailsTotal += details.updated;
        insertedEpisodeStillsTotal += stills.inserted;

        perAnime.push({
          animeId: anime.id,
          anilistId: anime.anilist_id,
          tmdbId: anime.tmdb_id,
          title: anime.title,
          ok: true,
          mappedEpisodes: mapping.mapped,
          mappingSkippedReason: mapping.skipped,
          mappingLocalUnmappedCount: mapping.localUnmappedCount,
          mappingTmdbFlatCount: mapping.tmdbFlatCount,
          mappingPartiallyMapped: mapping.partiallyMapped,
          updatedEpisodeDetails: details.updated,
          detailsSkippedUnmappable: details.skippedUnmappableEpisodes,
          insertedEpisodeStills: stills.inserted,
          stillsSkippedUnmappable: stills.skippedUnmappableEpisodes,
          ms: Date.now() - startedAt,
        });
      } catch (err: any) {
        perAnime.push({
          animeId: anime.id,
          anilistId: anime.anilist_id,
          tmdbId: anime.tmdb_id,
          title: anime.title,
          ok: false,
          error: err?.message ?? String(err),
          ms: Date.now() - startedAt,
        });
      }
    }

    const nextCursor = rows[rows.length - 1]?.id ?? null;

    return res.status(200).json({
      ok: true,
      done: false,
      processedAnime: rows.length,
      nextCursor,
      totals: {
        mappedEpisodes: mappedEpisodesTotal,
        updatedEpisodeDetails: updatedEpisodeDetailsTotal,
        insertedEpisodeStills: insertedEpisodeStillsTotal,
      },
      perAnime,
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: err?.message ?? String(err),
    });
  }
}