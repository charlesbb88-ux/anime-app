import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminGuard";
import { getAniListMangaById } from "@/lib/anilist";
import type { AniListManga } from "@/lib/anilist";

function parsePositiveInt(v: unknown): number | null {
  const n =
    typeof v === "string" ? parseInt(v, 10) :
    typeof v === "number" ? v :
    NaN;

  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function cleanUuid(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function pickSnapshotTitle(m: AniListManga) {
  const t = m.title;
  return t.english || t.userPreferred || t.romaji || t.native || "Untitled";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) return;

  if (req.method !== "POST") {
    return res.status(200).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const body = (req.body ?? {}) as {
      mangaId?: string;
      anilistId?: number | string;
    };

    const mangaId = cleanUuid(body.mangaId);
    const anilistId = parsePositiveInt(body.anilistId);

    if (!mangaId) {
      return res.status(200).json({ ok: false, error: "Missing mangaId" });
    }

    if (!anilistId) {
      return res.status(200).json({ ok: false, error: "Missing or invalid anilistId" });
    }

    // 1) Confirm manga exists in your DB
    const { data: existingManga, error: mangaCheckError } = await supabaseAdmin
      .from("manga")
      .select("id, title, slug")
      .eq("id", mangaId)
      .maybeSingle();

    if (mangaCheckError) {
      return res.status(500).json({ ok: false, error: mangaCheckError.message });
    }

    if (!existingManga) {
      return res.status(200).json({ ok: false, error: "Manga not found in database" });
    }

    // 2) Fetch AniList manga
    const { data: aniManga, error: aniError } = await getAniListMangaById(anilistId);

    if (aniError) {
      return res.status(200).json({ ok: false, error: aniError });
    }

    if (!aniManga) {
      return res.status(200).json({ ok: false, error: "AniList manga not found" });
    }

    const rawTags = aniManga.tags ?? [];

    // 3) Deduplicate the incoming AniList tag list by normalized name
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

    // 4) Load existing tags for this manga once
    const { data: existingTags, error: existingTagsError } = await supabaseAdmin
      .from("manga_tags")
      .select("id, name")
      .eq("manga_id", mangaId);

    if (existingTagsError) {
      return res.status(500).json({ ok: false, error: existingTagsError.message });
    }

    const existingByNormalizedName = new Map<string, { id: string; name: string }>();

    for (const row of existingTags ?? []) {
      const normalizedName =
        typeof row.name === "string" ? row.name.trim().toLowerCase() : "";

      if (!normalizedName) continue;
      if (!existingByNormalizedName.has(normalizedName)) {
        existingByNormalizedName.set(normalizedName, {
          id: row.id as string,
          name: row.name as string,
        });
      }
    }

    let updatedCount = 0;
    let insertedCount = 0;

    // 5) Update existing rows or insert new rows. Never delete.
    for (const item of normalizedIncomingTags) {
      const existing = existingByNormalizedName.get(item.normalized_name);

      if (existing) {
        const { error: updateError } = await supabaseAdmin
          .from("manga_tags")
          .update({
            name: item.payload.name,
            description: item.payload.description,
            rank: item.payload.rank,
            is_adult: item.payload.is_adult,
            is_general_spoiler: item.payload.is_general_spoiler,
            is_media_spoiler: item.payload.is_media_spoiler,
            category: item.payload.category,
          })
          .eq("id", existing.id);

        if (updateError) {
          return res.status(500).json({ ok: false, error: updateError.message });
        }

        updatedCount++;
      } else {
        const { error: insertError } = await supabaseAdmin
          .from("manga_tags")
          .insert(item.payload);

        if (insertError) {
          return res.status(500).json({ ok: false, error: insertError.message });
        }

        insertedCount++;
      }
    }

    const { count: tagCount, error: countError } = await supabaseAdmin
      .from("manga_tags")
      .select("id", { count: "exact", head: true })
      .eq("manga_id", mangaId);

    if (countError) {
      return res.status(500).json({ ok: false, error: countError.message });
    }

    return res.status(200).json({
      ok: true,
      mangaId,
      mangaTitleInDb: existingManga.title ?? null,
      mangaSlugInDb: existingManga.slug ?? null,
      anilistId,
      anilistTitle: pickSnapshotTitle(aniManga),
      incomingUniqueTagCount: normalizedIncomingTags.length,
      updatedCount,
      insertedCount,
      totalTagCountNowOnManga: typeof tagCount === "number" ? tagCount : null,
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: err?.message ?? String(err),
    });
  }
}