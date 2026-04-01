import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAniListMangaById } from "@/lib/anilist";
import type { AniListManga } from "@/lib/anilist";

function pickSnapshotTitle(m: AniListManga) {
  const t = m.title;
  return t.english || t.userPreferred || t.romaji || t.native || "Untitled";
}

export async function importMangaTagsFromAniList(
  mangaId: string,
  anilistId: number
) {
  // 1) confirm manga exists
  const { data: existingManga, error: mangaCheckError } = await supabaseAdmin
    .from("manga")
    .select("id, title, slug")
    .eq("id", mangaId)
    .maybeSingle();

  if (mangaCheckError) throw new Error(mangaCheckError.message);
  if (!existingManga) throw new Error("Manga not found");

  // 2) fetch AniList
  const { data: aniManga, error: aniError } =
    await getAniListMangaById(anilistId);

  if (aniError) throw new Error(aniError);
  if (!aniManga) throw new Error("AniList manga not found");

  const rawTags = aniManga.tags ?? [];

  const seen = new Set<string>();

  const normalizedIncomingTags = rawTags
    .filter((t) => t && typeof t.name === "string" && t.name.trim() !== "")
    .filter((t) => {
      const key = t.name.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((t) => ({
      normalized_name: t.name.trim().toLowerCase(),
      payload: {
        manga_id: mangaId,
        name: t.name.trim(),
        description: t.description ?? null,
        rank: t.rank ?? null,
        is_adult: t.isAdult ?? null,
        is_general_spoiler: t.isGeneralSpoiler ?? null,
        is_media_spoiler: t.isMediaSpoiler ?? null,
        category: t.category ?? null,
      },
    }));

  const { data: existingTags, error: existingTagsError } =
    await supabaseAdmin
      .from("manga_tags")
      .select("id, name")
      .eq("manga_id", mangaId);

  if (existingTagsError) throw new Error(existingTagsError.message);

  const existingByNormalizedName = new Map<string, any>();

  for (const row of existingTags ?? []) {
    const normalizedName =
      typeof row.name === "string" ? row.name.trim().toLowerCase() : "";

    if (!normalizedName) continue;
    if (!existingByNormalizedName.has(normalizedName)) {
      existingByNormalizedName.set(normalizedName, row);
    }
  }

  let updatedCount = 0;
  let insertedCount = 0;

  for (const item of normalizedIncomingTags) {
    const existing = existingByNormalizedName.get(item.normalized_name);

    if (existing) {
      const { error } = await supabaseAdmin
        .from("manga_tags")
        .update(item.payload)
        .eq("id", existing.id);

      if (error) throw new Error(error.message);
      updatedCount++;
    } else {
      const { error } = await supabaseAdmin
        .from("manga_tags")
        .insert(item.payload);

      if (error) throw new Error(error.message);
      insertedCount++;
    }
  }

  return {
    updatedCount,
    insertedCount,
    incomingCount: normalizedIncomingTags.length,
    anilistTitle: pickSnapshotTitle(aniManga),
  };
}