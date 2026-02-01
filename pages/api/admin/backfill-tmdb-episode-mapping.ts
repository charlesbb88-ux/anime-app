import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminGuard";
import { getTmdbTvDetails, getTmdbSeasonDetails } from "@/lib/tmdb";

type AnimeRow = { id: string; tmdb_id: number };
type EpisodeRow = {
    id: string;
    anime_id: string;
    episode_number: number;
    season_number: number | null;
    season_episode_number: number | null;
    tmdb_episode_id: number | null;
};

type FlatTmdbEp = {
    season_number: number;
    season_episode_number: number;
    tmdb_episode_id: number;
};

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // TEMP: disable admin guard locally so we can backfill mappings
    // if (!requireAdmin(req, res)) return;

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
        return res.status(200).json({ done: true, processedAnime: 0, mappedEpisodes: 0, nextCursor: null });
    }

    let mappedEpisodesTotal = 0;
    const perAnime: any[] = [];

    for (const a of rows) {
        const animeId = a.id;
        const tvId = a.tmdb_id;
        const startedAt = Date.now();

        // Load local episodes for this anime
        const { data: localEps, error: eEps } = await supabaseAdmin
            .from("anime_episodes")
            .select("id, anime_id, episode_number, season_number, season_episode_number, tmdb_episode_id")
            .eq("anime_id", animeId)
            .order("episode_number", { ascending: true });

        if (eEps) {
            perAnime.push({ animeId, tvId, ok: false, error: eEps.message });
            continue;
        }

        const episodes = (localEps ?? []) as EpisodeRow[];
        if (episodes.length === 0) {
            perAnime.push({ animeId, tvId, ok: true, mapped: 0, note: "no local episodes" });
            continue;
        }

        // Strict: only map episodes that are not already mapped (we leave mapped ones alone)
        const unmapped = episodes.filter(
            (e) => e.season_number == null && e.season_episode_number == null
        );

        if (unmapped.length === 0) {
            perAnime.push({ animeId, tvId, ok: true, mapped: 0, note: "already mapped" });
            continue;
        }

        const nums = unmapped.map((e) => e.episode_number);
        if (!isContiguousOneToN(nums)) {
            perAnime.push({
                animeId,
                tvId,
                ok: true,
                mapped: 0,
                skipped: true,
                reason: "local episode_number not contiguous 1..N (or duplicates/gaps)",
            });
            continue;
        }

        // Fetch TMDB tv details to get seasons list
        const { data: details, error: eDet } = await getTmdbTvDetails(tvId);
        if (eDet || !details) {
            perAnime.push({ animeId, tvId, ok: false, error: eDet || "no tmdb details" });
            continue;
        }

        // Build flattened TMDB episode list across seasons (exclude season 0 specials)
        const seasonNums =
            (details.seasons ?? [])
                .map((s) => s.season_number)
                .filter((sn) => typeof sn === "number" && sn >= 1)
                .sort((x, y) => x - y);

        if (seasonNums.length === 0) {
            perAnime.push({ animeId, tvId, ok: true, mapped: 0, skipped: true, reason: "tmdb has no seasons >= 1" });
            continue;
        }

        const flat: FlatTmdbEp[] = [];
        for (const sn of seasonNums) {
            const { data: sd, error: eSd } = await getTmdbSeasonDetails(tvId, sn);
            if (eSd || !sd) continue;

            // sd.episodes are already season episode_numbers
            for (const ep of sd.episodes ?? []) {
                // TMDB episode_number is within-season
                if (typeof ep.episode_number !== "number") continue;
                flat.push({
                    season_number: sn,
                    season_episode_number: ep.episode_number,
                    tmdb_episode_id: ep.id,
                });
            }
        }

        if (flat.length !== unmapped.length) {
            perAnime.push({
                animeId,
                tvId,
                ok: true,
                mapped: 0,
                skipped: true,
                reason: `count mismatch: local_unmapped=${unmapped.length} tmdb_flat=${flat.length}`,
            });
            continue;
        }

        // Map local ep #k -> flat[k-1]
        // (Unmapped list is contiguous 1..N, so this is safe)
        const updates = unmapped.map((e) => {
            const idx = e.episode_number - 1;
            const tm = flat[idx];
            return {
                id: e.id,

                // ✅ required columns (prevents null constraint if upsert inserts)
                anime_id: e.anime_id,
                episode_number: e.episode_number,

                season_number: tm.season_number,
                season_episode_number: tm.season_episode_number,
                tmdb_episode_id: tm.tmdb_episode_id,

                updated_at: new Date().toISOString(),
            };
        });

        // Bulk upsert by primary key id
        const { error: eUp } = await supabaseAdmin
            .from("anime_episodes")
            .upsert(updates, { onConflict: "id" });

        if (eUp) {
            perAnime.push({ animeId, tvId, ok: false, error: eUp.message });
            continue;
        }

        mappedEpisodesTotal += updates.length;

        perAnime.push({
            animeId,
            tvId,
            ok: true,
            mapped: updates.length,
            ms: Date.now() - startedAt,
        });
    }

    const nextCursor = rows[rows.length - 1]?.id ?? null;

    return res.status(200).json({
        done: false,
        processedAnime: rows.length,
        mappedEpisodes: mappedEpisodesTotal,
        nextCursor,
        perAnime,
    });
}
