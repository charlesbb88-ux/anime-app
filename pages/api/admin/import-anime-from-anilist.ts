// pages/api/admin/import-anime-from-anilist.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAniListAnimeById } from "@/lib/anilist";

// Simple slugifier: "Attack on Titan" -> "attack-on-titan"
function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Convert AniList fuzzy date { year, month, day } to "YYYY-MM-DD" or null
function fuzzyDateToString(
  date: { year: number | null; month: number | null; day: number | null } | null
): string | null {
  if (!date || !date.year || !date.month || !date.day) {
    return null;
  }

  const y = date.year;
  const m = String(date.month).padStart(2, "0");
  const d = String(date.day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// OPTIONAL: simple dev-only secret. For now, you can leave it empty in dev.
// In production, set ANILIST_IMPORT_SECRET and require it.
const ADMIN_IMPORT_SECRET = process.env.ANILIST_IMPORT_SECRET || "";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Optional protection: require a secret token in header or body
  if (ADMIN_IMPORT_SECRET) {
    const token =
      (req.headers["x-import-secret"] as string | undefined) ||
      (req.body && (req.body.secret as string | undefined));

    if (!token || token !== ADMIN_IMPORT_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const { anilistId } = req.body as { anilistId?: number | string };

  if (!anilistId) {
    return res.status(400).json({ error: "Missing anilistId" });
  }

  const idNum =
    typeof anilistId === "string" ? parseInt(anilistId, 10) : anilistId;

  if (!idNum || Number.isNaN(idNum)) {
    return res.status(400).json({ error: "Invalid anilistId" });
  }

  // 1) Fetch from AniList (rich data)
  const { data: anime, error: aniError } = await getAniListAnimeById(idNum);

  if (aniError || !anime) {
    console.error("AniList fetch error:", aniError);
    return res.status(500).json({
      error: aniError || "Failed to fetch anime from AniList",
    });
  }

  // 2) Titles
  const titleRomaji = anime.title.romaji ?? null;
  const titleEnglish = anime.title.english ?? null;
  const titleNative = anime.title.native ?? null;
  const titlePreferred = anime.title.userPreferred ?? null;

  // Main display title for our DB "title" column
  const mainTitle =
    titlePreferred ||
    titleEnglish ||
    titleRomaji ||
    titleNative ||
    "Untitled";

  const slug = slugifyTitle(mainTitle);

  // 3) Core fields
  const totalEpisodes = anime.episodes ?? null;
  const imageUrl = anime.coverImage?.large || anime.coverImage?.medium || null;
  const bannerImageUrl = anime.bannerImage ?? null;

  const startDate = fuzzyDateToString(anime.startDate);
  const endDate = fuzzyDateToString(anime.endDate);

  const description = anime.description ?? null;
  const format = anime.format ?? null; // TV, MOVIE, etc.
  const status = anime.status ?? null; // FINISHED, RELEASING, etc.
  const season = anime.season ?? null; // WINTER, SPRING...
  const seasonYear = anime.seasonYear ?? null;
  const averageScore = anime.averageScore ?? null; // 0–100
  const source = anime.source ?? null; // ORIGINAL, MANGA, etc.

  const genres = anime.genres ?? null;

  // 4) Upsert into public.anime table
  const { data: upserted, error: dbError } = await supabaseAdmin
    .from("anime")
    .upsert(
      {
        title: mainTitle,
        slug,
        total_episodes: totalEpisodes,
        image_url: imageUrl,
        banner_image_url: bannerImageUrl,

        // extra titles
        title_english: titleEnglish,
        title_native: titleNative,
        title_preferred: titlePreferred,

        // rich metadata
        description,
        format,
        status,
        season,
        season_year: seasonYear,
        start_date: startDate,
        end_date: endDate,
        average_score: averageScore,
        source,
        genres,
      },
      { onConflict: "slug" } // uses the unique constraint on slug
    )
    .select(
      `
      id,
      title,
      slug,
      total_episodes,
      image_url,
      banner_image_url,
      title_english,
      title_native,
      title_preferred,
      description,
      format,
      status,
      season,
      season_year,
      start_date,
      end_date,
      average_score,
      source,
      genres,
      created_at
    `
    )
    .single();

  if (dbError || !upserted) {
    console.error("Error inserting anime into Supabase:", dbError);
    return res.status(500).json({ error: "Failed to insert anime into DB" });
  }

  const animeId = upserted.id as string;
  const finalTotalEpisodes =
    typeof upserted.total_episodes === "number" &&
    upserted.total_episodes > 0
      ? upserted.total_episodes
      : null;

  // 5) Auto-create anime_episodes rows for this anime (1..total_episodes)
  if (finalTotalEpisodes) {
    const episodesPayload = Array.from(
      { length: finalTotalEpisodes },
      (_, idx) => ({
        anime_id: animeId,
        episode_number: idx + 1,
      })
    );

    const { error: episodesError } = await supabaseAdmin
      .from("anime_episodes")
      .upsert(episodesPayload, {
        onConflict: "anime_id,episode_number",
      });

    if (episodesError) {
      console.error(
        "Error upserting anime_episodes for anime",
        animeId,
        episodesError
      );
      // We log this but don't fail the whole request;
      // the anime itself is still imported even if episode generation hiccups.
    }
  }

  // 6) Sync tags into anime_tags table (delete old, insert new)
  try {
    // Clear existing tags for this anime
    const { error: deleteError } = await supabaseAdmin
      .from("anime_tags")
      .delete()
      .eq("anime_id", animeId);

    if (deleteError) {
      console.error("Error clearing existing anime_tags:", deleteError);
    }

    const rawTags = anime.tags ?? [];

    const tagRows = rawTags
      .filter((t) => t && t.name)
      .map((t) => ({
        anime_id: animeId,
        name: t.name,
        description: t.description ?? null,
        rank: t.rank ?? null,
        is_adult: t.isAdult ?? null,
        is_general_spoiler: t.isGeneralSpoiler ?? null,
        is_media_spoiler: t.isMediaSpoiler ?? null,
        category: t.category ?? null,
      }));

    if (tagRows.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from("anime_tags")
        .insert(tagRows);

      if (insertError) {
        console.error("Error inserting anime_tags:", insertError);
      }
    }
  } catch (err) {
    console.error("Unexpected error syncing anime_tags:", err);
  }

  return res.status(200).json({
    success: true,
    anime: upserted,
  });
}
