import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminGuard";

function parsePositiveInt(v: unknown): number | null {
  const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) return;

  const anilistId = parsePositiveInt(req.query.anilistId);
  if (!anilistId) {
    return res.status(200).json({ ok: false, error: "Missing or invalid anilistId" });
  }

  const { data: anime, error: animeErr } = await supabaseAdmin
    .from("anime")
    .select("id, anilist_id, tmdb_id, title, slug")
    .eq("anilist_id", anilistId)
    .maybeSingle();

  if (animeErr) {
    return res.status(500).json({ ok: false, error: animeErr.message });
  }

  if (!anime) {
    return res.status(200).json({ ok: false, error: `No anime row found for anilist_id=${anilistId}` });
  }

  const animeId = anime.id as string;

  const { data: seriesArtwork, error: seriesErr } = await supabaseAdmin
    .from("anime_artwork")
    .select("id, anime_id, source, kind, url, lang, width, height, vote, is_primary")
    .eq("anime_id", animeId)
    .order("kind", { ascending: true })
    .order("is_primary", { ascending: false });

  if (seriesErr) {
    return res.status(500).json({ ok: false, error: seriesErr.message });
  }

  const { data: episodes, error: epsErr } = await supabaseAdmin
    .from("anime_episodes")
    .select(`
      id,
      anime_id,
      episode_number,
      title,
      synopsis,
      air_date,
      season_number,
      season_episode_number,
      tmdb_episode_id
    `)
    .eq("anime_id", animeId)
    .order("episode_number", { ascending: true });

  if (epsErr) {
    return res.status(500).json({ ok: false, error: epsErr.message });
  }

  const episodeIds = (episodes ?? []).map((e: any) => e.id);

  let episodeArtwork: any[] = [];
  if (episodeIds.length > 0) {
    const { data: epArt, error: epArtErr } = await supabaseAdmin
      .from("anime_episode_artwork")
      .select("id, anime_episode_id, source, kind, url, lang, width, height, vote, is_primary")
      .in("anime_episode_id", episodeIds)
      .order("is_primary", { ascending: false });

    if (epArtErr) {
      return res.status(500).json({ ok: false, error: epArtErr.message });
    }

    episodeArtwork = epArt ?? [];
  }

  const artByEpisode = new Map<string, any[]>();
  for (const row of episodeArtwork) {
    const key = row.anime_episode_id as string;
    if (!artByEpisode.has(key)) artByEpisode.set(key, []);
    artByEpisode.get(key)!.push(row);
  }

  const episodesWithArtwork = (episodes ?? []).map((ep: any) => ({
    ...ep,
    artwork: artByEpisode.get(ep.id) ?? [],
  }));

  return res.status(200).json({
    ok: true,
    anime,
    counts: {
      seriesArtwork: (seriesArtwork ?? []).length,
      episodes: episodesWithArtwork.length,
      episodeArtwork: episodeArtwork.length,
    },
    seriesArtwork: seriesArtwork ?? [],
    episodes: episodesWithArtwork,
  });
}