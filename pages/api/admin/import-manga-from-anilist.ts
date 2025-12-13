// pages/api/admin/import-manga-from-anilist.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAniListMangaById } from "@/lib/anilist";

// Simple slugifier: "Berserk" -> "berserk"
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
const ADMIN_IMPORT_SECRET = process.env.ANILIST_IMPORT_SECRET || "";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Debug: confirm what we actually imported
  console.log(
    "[import-manga-from-anilist] typeof getAniListMangaById:",
    typeof getAniListMangaById
  );

  if (typeof getAniListMangaById !== "function") {
    console.error(
      "[import-manga-from-anilist] getAniListMangaById is not a function at runtime:",
      getAniListMangaById
    );
    return res.status(500).json({
      error:
        "Server misconfiguration: getAniListMangaById is not a function. Check lib/anilist.ts exports.",
    });
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

  // 1) Fetch from AniList (MANGA)
  const { data: manga, error: aniError } = await getAniListMangaById(idNum);

  if (aniError || !manga) {
    console.error("AniList manga fetch error:", aniError);
    return res.status(500).json({
      error: aniError || "Failed to fetch manga from AniList",
    });
  }

  // 2) Titles
  const titleRomaji = manga.title.romaji ?? null;
  const titleEnglish = manga.title.english ?? null;
  const titleNative = manga.title.native ?? null;
  const titlePreferred = manga.title.userPreferred ?? null;

  const mainTitle =
    titlePreferred ||
    titleEnglish ||
    titleRomaji ||
    titleNative ||
    "Untitled";

  const slug = slugifyTitle(mainTitle);

  // 3) Core fields
  const totalChapters = manga.chapters ?? null;
  const totalVolumes = manga.volumes ?? null;

  const imageUrl =
    manga.coverImage?.large || manga.coverImage?.medium || null;
  const bannerImageUrl = manga.bannerImage ?? null;

  const startDate = fuzzyDateToString(manga.startDate);
  const endDate = fuzzyDateToString(manga.endDate);

  const description = manga.description ?? null;
  const format = manga.format ?? null; // MANGA, NOVEL, etc.
  const status = manga.status ?? null; // FINISHED, RELEASING...
  const season = manga.season ?? null;
  const seasonYear = manga.seasonYear ?? null;
  const averageScore = manga.averageScore ?? null;
  const source = manga.source ?? null;

  const genres = manga.genres ?? null;

  // 4) Upsert into public.manga table
  const { data: upserted, error: dbError } = await supabaseAdmin
    .from("manga")
    .upsert(
      {
        title: mainTitle,
        slug,
        total_chapters: totalChapters,
        total_volumes: totalVolumes,
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
      { onConflict: "slug" }
    )
    .select(
      `
      id,
      title,
      slug,
      total_chapters,
      total_volumes,
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
    console.error("Error inserting manga into Supabase:", dbError);
    // IMPORTANT: expose the actual DB error message in the JSON
    return res.status(500).json({
      error:
        dbError?.message ||
        "Failed to insert manga into DB (no further error message).",
    });
  }

  // 5) Auto-create manga_chapters rows for this manga (1..total_chapters)
  const mangaId = upserted.id as string;
  const finalTotalChapters =
    typeof upserted.total_chapters === "number" &&
    upserted.total_chapters > 0
      ? upserted.total_chapters
      : null;

  if (finalTotalChapters) {
    const chaptersPayload = Array.from(
      { length: finalTotalChapters },
      (_, idx) => ({
        manga_id: mangaId,
        chapter_number: idx + 1,
      })
    );

    const { error: chaptersError } = await supabaseAdmin
      .from("manga_chapters")
      .upsert(chaptersPayload, {
        onConflict: "manga_id,chapter_number",
      });

    if (chaptersError) {
      console.error(
        "Error upserting manga_chapters for manga",
        mangaId,
        chaptersError
      );
      // Same as anime: we log this but don't fail the whole request
    }
  }

  // 6) Sync tags into manga_tags table (if you have one)
  try {
    const rawTags = manga.tags ?? [];

    const { error: deleteError } = await supabaseAdmin
      .from("manga_tags")
      .delete()
      .eq("manga_id", mangaId);

    if (deleteError) {
      console.error("Error clearing existing manga_tags:", deleteError);
    }

    const tagRows = rawTags
      .filter((t) => t && t.name)
      .map((t) => ({
        manga_id: mangaId,
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
        .from("manga_tags")
        .insert(tagRows);

      if (insertError) {
        console.error("Error inserting manga_tags:", insertError);
      }
    }
  } catch (err) {
    console.error("Unexpected error syncing manga_tags:", err);
  }

  return res.status(200).json({
    success: true,
    manga: upserted,
  });
}
