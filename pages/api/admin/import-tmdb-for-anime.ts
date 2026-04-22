import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminGuard";
import {
  getTmdbTvDetails,
  getTmdbTvImages,
  getTmdbSeasonDetails,
  getTmdbSeasonImages,
  getTmdbEpisodeImages,
  getTmdbMovieDetails,
  getTmdbMovieImages,
  tmdbImageUrl,
  type TmdbImagesResponse,
  type TmdbTvDetails,
  type TmdbMovieDetails,
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
  title?: string | null;
  synopsis?: string | null;
  air_date?: string | null;
};

type InsertAnimeArtwork = {
  anime_id: string;
  source: string;
  kind: string;
  url: string;
  lang: string | null;
  width: number | null;
  height: number | null;
  vote: number | null;
  is_primary: boolean;
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

type TmdbMediaType = "tv" | "movie";

function parsePositiveInt(v: unknown): number | null {
  const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseMediaType(v: unknown): TmdbMediaType | null {
  if (v === "tv" || v === "movie") return v;
  return null;
}

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

function mapImages(
  animeId: string,
  kind: string,
  images: TmdbImagesResponse | null,
  key: "posters" | "backdrops" | "logos",
  primaryFilePath: string | null
): InsertAnimeArtwork[] {
  const arr = (images?.[key] ?? []) as any[];

  return arr
    .map((it) => {
      const url = tmdbImageUrl(it.file_path, "original");
      if (!url) return null;

      return {
        anime_id: animeId,
        source: "tmdb",
        kind,
        url,
        lang: it.iso_639_1 ?? null,
        width: it.width ?? null,
        height: it.height ?? null,
        vote: it.vote_average ?? null,
        is_primary: primaryFilePath ? it.file_path === primaryFilePath : false,
      } satisfies InsertAnimeArtwork;
    })
    .filter(Boolean) as InsertAnimeArtwork[];
}

function bestVotedPrimary<T extends { vote: number | null; is_primary: boolean }>(rows: T[]) {
  const copy = rows.map((r) => ({ ...r }));
  const hasPrimary = copy.some((r) => r.is_primary);
  if (hasPrimary) return copy;

  let bestIdx = -1;
  let bestVote = -Infinity;

  for (let i = 0; i < copy.length; i++) {
    const v = copy[i].vote ?? -Infinity;
    if (v > bestVote) {
      bestVote = v;
      bestIdx = i;
    }
  }

  if (bestIdx >= 0) copy[bestIdx].is_primary = true;
  return copy;
}

function dedupeArtworkRows(rows: InsertAnimeArtwork[]) {
  const seen = new Set<string>();
  const out: InsertAnimeArtwork[] = [];

  for (const row of rows) {
    const key = `${row.anime_id}||${row.source}||${row.kind}||${row.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  return out;
}

async function getAnimeByAniListId(anilistId: number) {
  const { data, error } = await supabaseAdmin
    .from("anime")
    .select("id, anilist_id, tmdb_id, title")
    .eq("anilist_id", anilistId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(`No anime row found where anime.anilist_id = ${anilistId}`);
  }

  return data as AnimeRow;
}

async function setTmdbOnAnime(animeId: string, tmdbId: number, tmdbMediaType: TmdbMediaType) {
  const patch: Record<string, any> = {
    tmdb_id: tmdbId,
  };

  // only include this if your anime table actually has a tmdb_media_type column
  patch.tmdb_media_type = tmdbMediaType;

  const { error } = await supabaseAdmin
    .from("anime")
    .update(patch)
    .eq("id", animeId);

  if (error) {
    // fallback in case tmdb_media_type column does not exist yet
    if (String(error.message || "").toLowerCase().includes("tmdb_media_type")) {
      const { error: fallbackError } = await supabaseAdmin
        .from("anime")
        .update({ tmdb_id: tmdbId })
        .eq("id", animeId);

      if (fallbackError) throw fallbackError;
      return;
    }

    throw error;
  }
}

async function insertAnimeArtworkSafely(rows: InsertAnimeArtwork[]) {
  if (rows.length === 0) return 0;

  const deduped = dedupeArtworkRows(rows);

  const { error } = await supabaseAdmin
    .from("anime_artwork")
    .upsert(deduped, {
      onConflict: "anime_id,source,kind,url",
      ignoreDuplicates: true,
    });

  if (error) throw error;

  return deduped.length;
}

async function importTvSeriesArtworkForAnime(animeId: string, tvId: number) {
  const { data: details, error: eDet } = await getTmdbTvDetails(tvId);
  if (eDet || !details) throw new Error(eDet || "No TMDB TV details");

  const { data: images, error: eImg } = await getTmdbTvImages(tvId);
  if (eImg || !images) throw new Error(eImg || "No TMDB TV images");

  const d = details as TmdbTvDetails;

  let posters = mapImages(animeId, "poster", images, "posters", d.poster_path);
  let backdrops = mapImages(animeId, "backdrop", images, "backdrops", d.backdrop_path);
  let logos = mapImages(animeId, "logo", images, "logos", null);

  posters = bestVotedPrimary(posters);
  backdrops = bestVotedPrimary(backdrops);
  logos = bestVotedPrimary(logos);

  const seasonRows: InsertAnimeArtwork[] = [];
  const seasons = d.seasons ?? [];

  for (const s of seasons) {
    const sn = s.season_number;
    if (sn == null) continue;

    const { data: sImgs } = await getTmdbSeasonImages(tvId, sn);

    const sp = mapImages(animeId, `season_${sn}_poster`, sImgs ?? null, "posters", s.poster_path);
    const sb = mapImages(animeId, `season_${sn}_backdrop`, sImgs ?? null, "backdrops", null);
    const sl = mapImages(animeId, `season_${sn}_logo`, sImgs ?? null, "logos", null);

    seasonRows.push(...bestVotedPrimary(sp), ...bestVotedPrimary(sb), ...bestVotedPrimary(sl));
  }

  const all = [...posters, ...backdrops, ...logos, ...seasonRows];
  const inserted = await insertAnimeArtworkSafely(all);

  return {
    inserted,
    totalFetched: all.length,
  };
}

async function importMovieArtworkForAnime(animeId: string, movieId: number) {
  const { data: details, error: eDet } = await getTmdbMovieDetails(movieId);
  if (eDet || !details) throw new Error(eDet || "No TMDB movie details");

  const { data: images, error: eImg } = await getTmdbMovieImages(movieId);
  if (eImg || !images) throw new Error(eImg || "No TMDB movie images");

  const d = details as TmdbMovieDetails;

  let posters = mapImages(animeId, "poster", images, "posters", d.poster_path);
  let backdrops = mapImages(animeId, "backdrop", images, "backdrops", d.backdrop_path);
  let logos = mapImages(animeId, "logo", images, "logos", null);

  posters = bestVotedPrimary(posters);
  backdrops = bestVotedPrimary(backdrops);
  logos = bestVotedPrimary(logos);

  const all = [...posters, ...backdrops, ...logos];
  const inserted = await insertAnimeArtworkSafely(all);

  return {
    inserted,
    totalFetched: all.length,
  };
}

async function importMovieDetailsForAnime(animeId: string, movieId: number) {
  const { data: movie, error } = await getTmdbMovieDetails(movieId);
  if (error || !movie) throw new Error(error || "No TMDB movie details");

  const patch: Record<string, any> = {};
if (hasMeaningfulText(movie.title)) {
  patch.title = movie.title;
}

  // If you do not want TMDB overwriting anime title ever, delete the block above and just return updated: 0

  if (Object.keys(patch).length === 0) {
    return { updated: 0 };
  }

  const { error: upErr } = await supabaseAdmin
    .from("anime")
    .update(patch)
    .eq("id", animeId);

  if (upErr) throw upErr;

  return { updated: 1 };
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
  if (eDet || !details) throw new Error(eDet || "No TMDB TV details");

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
        title: hasMeaningfulText(local.title) ? local.title! : (tmdbEp.name ?? null),
        synopsis: hasMeaningfulText(local.synopsis) ? local.synopsis! : (tmdbEp.overview ?? null),
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
          if (!url) return null;

          return {
            anime_episode_id: ep.id,
            source: "tmdb",
            kind: "still",
            url,
            lang: it.iso_639_1 ?? null,
            width: it.width ?? null,
            height: it.height ?? null,
            vote: it.vote_average ?? null,
            is_primary: primaryStillPath ? it.file_path === primaryStillPath : false,
          } satisfies InsertEpisodeArtwork;
        })
        .filter(Boolean) as InsertEpisodeArtwork[];

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

        if (eIns) throw eIns;

        insertedForAnime += deduped.length;
        for (const r of deduped) {
          existingSet.add(`${r.anime_episode_id}||${r.url}`);
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
    const body = (req.body ?? {}) as {
      anilistId?: number | string;
      tmdbId?: number | string | null;
      tmdbMediaType?: "tv" | "movie" | null;
    };

    const anilistId = parsePositiveInt(body.anilistId);
    const tmdbId = parsePositiveInt(body.tmdbId);
const requestedType = parseMediaType(body.tmdbMediaType);
let tmdbMediaType: "tv" | "movie" = requestedType ?? "tv";

    if (!anilistId) {
      return res.status(200).json({ ok: false, error: "Missing or invalid anilistId" });
    }

    if (!tmdbId) {
      return res.status(200).json({ ok: false, error: "Missing or invalid tmdbId" });
    }

    try {
  const tvCheck = await getTmdbTvDetails(tmdbId);

  if (tvCheck.data) {
    tmdbMediaType = "tv";
  } else {
    const movieCheck = await getTmdbMovieDetails(tmdbId);

    if (movieCheck.data) {
      tmdbMediaType = "movie";
    }
  }
} catch {}

    const anime = await getAnimeByAniListId(anilistId);
    await setTmdbOnAnime(anime.id, tmdbId, tmdbMediaType);

    if (tmdbMediaType === "movie") {
      const artwork = await importMovieArtworkForAnime(anime.id, tmdbId);
      const details = await importMovieDetailsForAnime(anime.id, tmdbId);

      const { data: refreshedAnime, error: refreshErr } = await supabaseAdmin
        .from("anime")
        .select("id, anilist_id, tmdb_id, title")
        .eq("id", anime.id)
        .single();

      if (refreshErr) throw refreshErr;

      return res.status(200).json({
        ok: true,
        anime: refreshedAnime,
        tmdb: {
          mediaType: "movie",
          seriesArtworkInserted: artwork.inserted,
          episodeMappingsAdded: 0,
          episodeMappingSkippedReason: "movie import: no episode mapping",
          episodeMappingLocalUnmappedCount: 0,
          episodeMappingTmdbFlatCount: 0,
          episodeMappingPartiallyMapped: false,
          episodeDetailsUpdated: details.updated,
          episodeDetailsSkippedUnmappable: 0,
          episodeStillsInserted: 0,
          episodeStillsSkippedUnmappable: 0,
        },
      });
    }

    const artwork = await importTvSeriesArtworkForAnime(anime.id, tmdbId);
    const mapping = await mapEpisodesForAnime(anime.id, tmdbId);
    const details = await importEpisodeDetailsForAnime(anime.id, tmdbId);
    const stills = await importEpisodeStillsForAnime(anime.id, tmdbId);

    const { data: refreshedAnime, error: refreshErr } = await supabaseAdmin
      .from("anime")
      .select("id, anilist_id, tmdb_id, title")
      .eq("id", anime.id)
      .single();

    if (refreshErr) throw refreshErr;

    return res.status(200).json({
      ok: true,
      anime: refreshedAnime,
      tmdb: {
        mediaType: "tv",
        seriesArtworkInserted: artwork.inserted,
        episodeMappingsAdded: mapping.mapped,
        episodeMappingSkippedReason: mapping.skipped,
        episodeMappingLocalUnmappedCount: mapping.localUnmappedCount,
        episodeMappingTmdbFlatCount: mapping.tmdbFlatCount,
        episodeMappingPartiallyMapped: mapping.partiallyMapped,
        episodeDetailsUpdated: details.updated,
        episodeDetailsSkippedUnmappable: details.skippedUnmappableEpisodes,
        episodeStillsInserted: stills.inserted,
        episodeStillsSkippedUnmappable: stills.skippedUnmappableEpisodes,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: err?.message ?? String(err),
    });
  }
}