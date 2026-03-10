import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminGuard";
import { getTmdbSeasonDetails } from "@/lib/tmdb";

type AnimeRow = {
  id: string;
  tmdb_id: number;
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

type TmdbEpisodeLite = {
  id: number;
  episode_number: number;
  name: string | null;
  overview: string | null;
  air_date: string | null;
};

function hasMeaningfulText(v: unknown) {
  return typeof v === "string" && v.trim().length > 0;
}

function shouldFillEpisode(local: EpisodeRow, tmdbEp: TmdbEpisodeLite) {
  const missingTitle = !hasMeaningfulText(local.title) && hasMeaningfulText(tmdbEp.name);
  const missingSynopsis = !hasMeaningfulText(local.synopsis) && hasMeaningfulText(tmdbEp.overview);
  const missingAirDate = !local.air_date && !!tmdbEp.air_date;
  const missingTmdbEpisodeId = local.tmdb_episode_id == null && Number.isFinite(tmdbEp.id);

  return missingTitle || missingSynopsis || missingAirDate || missingTmdbEpisodeId;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) return;

  const limit = Math.min(parseInt(String(req.query.limit ?? "2"), 10) || 2, 25);
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : null;

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
    return res.status(200).json({
      done: true,
      processedAnime: 0,
      updatedEpisodes: 0,
      nextCursor: null,
    });
  }

  let updatedEpisodesTotal = 0;
  const perAnime: any[] = [];

  for (const a of rows) {
    const animeId = a.id;
    const tvId = a.tmdb_id;
    const startedAt = Date.now();

    const { data: localEps, error: eEps } = await supabaseAdmin
      .from("anime_episodes")
      .select(
        "id, anime_id, episode_number, season_number, season_episode_number, tmdb_episode_id, title, synopsis, air_date"
      )
      .eq("anime_id", animeId)
      .order("episode_number", { ascending: true });

    if (eEps) {
      perAnime.push({ animeId, tvId, ok: false, error: eEps.message });
      continue;
    }

    const episodes = (localEps ?? []) as EpisodeRow[];
    if (episodes.length === 0) {
      perAnime.push({ animeId, tvId, ok: true, updated: 0, note: "no local episodes" });
      continue;
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

      const tmdbBySeasonEpisode = new Map<number, TmdbEpisodeLite>();

      for (const ep of seasonDetails.episodes ?? []) {
        if (typeof ep.episode_number !== "number") continue;

        tmdbBySeasonEpisode.set(ep.episode_number, {
          id: ep.id,
          episode_number: ep.episode_number,
          name: ep.name ?? null,
          overview: ep.overview ?? null,
          air_date: ep.air_date ?? null,
        });
      }

      for (const local of seasonEpisodes) {
        const tmdbEp = tmdbBySeasonEpisode.get(local.season_episode_number!);
        if (!tmdbEp) continue;

        if (!shouldFillEpisode(local, tmdbEp)) continue;

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

      if (eUp) {
        perAnime.push({ animeId, tvId, ok: false, error: eUp.message });
        continue;
      }
    }

    updatedEpisodesTotal += updates.length;

    perAnime.push({
      animeId,
      tvId,
      ok: true,
      updated: updates.length,
      skippedUnmappableEpisodes: skippedUnmappable,
      ms: Date.now() - startedAt,
    });
  }

  const nextCursor = rows[rows.length - 1]?.id ?? null;

  return res.status(200).json({
    done: false,
    processedAnime: rows.length,
    updatedEpisodes: updatedEpisodesTotal,
    nextCursor,
    perAnime,
  });
}