import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminGuard";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) return;

  // total anime with tmdb_id
  const { count: totalAnime, error: e1 } = await supabaseAdmin
    .from("anime")
    .select("id", { count: "exact", head: true })
    .not("tmdb_id", "is", null);

  if (e1) return res.status(500).json({ error: e1.message });

  // total episodes that are mappable to TMDB episode endpoint
  const { count: totalEpisodes, error: e2 } = await supabaseAdmin
    .from("anime_episode")
    .select("id", { count: "exact", head: true })
    .not("season_number", "is", null)
    .not("season_episode_number", "is", null);

  if (e2) return res.status(500).json({ error: e2.message });

  // (optional) how many already have artwork rows
  const { count: seriesArtworkRows } = await supabaseAdmin
    .from("anime_artwork")
    .select("id", { count: "exact", head: true });

  const { count: episodeArtworkRows } = await supabaseAdmin
    .from("anime_episode_artwork")
    .select("id", { count: "exact", head: true });

  return res.status(200).json({
    totalAnime: totalAnime ?? 0,
    totalEpisodes: totalEpisodes ?? 0,
    seriesArtworkRows: seriesArtworkRows ?? 0,
    episodeArtworkRows: episodeArtworkRows ?? 0,
  });
}
