// pages/api/admin/import-anime-from-anilist.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAniListAnimeById, listAniListAnimePage } from "@/lib/anilist";
import type { AniListAnime } from "@/lib/anilist";

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
  if (!date || !date.year) return null;

  const y = date.year;
  const m = String(date.month ?? 1).padStart(2, "0");
  const d = String(date.day ?? 1).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// OPTIONAL protection
const ADMIN_IMPORT_SECRET = process.env.ANILIST_IMPORT_SECRET || "";

function parseIntSafe(v: unknown, fallback: number) {
  const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function pickMainTitle(a: AniListAnime) {
  const t = a.title;
  return t.userPreferred || t.english || t.romaji || t.native || "Untitled";
}

function mapAniListToAnimeRow(a: AniListAnime) {
  const mainTitle = pickMainTitle(a);

  // Make slug stable + collision-proof for bulk
  const baseSlug = slugifyTitle(mainTitle);
  const slug = `${baseSlug}-${a.id}`;

  const imageUrl =
    a.coverImage?.extraLarge ||
    a.coverImage?.large ||
    a.coverImage?.medium ||
    null;

  return {
    // IMPORTANT: persist external ids
    anilist_id: a.id,
    mal_id: a.idMal ?? null,

    title: mainTitle,
    slug,

    total_episodes: a.episodes ?? null,
    image_url: imageUrl,
    banner_image_url: a.bannerImage ?? null,

    trailer_site: a.trailer?.site ?? null,
    trailer_id: a.trailer?.id ?? null,
    trailer_thumbnail_url: a.trailer?.thumbnail ?? null,

    title_english: a.title.english ?? null,
    title_native: a.title.native ?? null,
    title_preferred: a.title.userPreferred ?? null,

    description: a.description ?? null,
    format: a.format ?? null,
    status: a.status ?? null,
    season: a.season ?? null,
    season_year: a.seasonYear ?? null,
    start_date: fuzzyDateToString(a.startDate),
    end_date: fuzzyDateToString(a.endDate),
    average_score: a.averageScore ?? null,
    source: a.source ?? null,
    genres: a.genres ?? null,
  };
}

/** ✅ DB-backed progress helper (truth source) */
async function getDbImportedCount() {
  // How many anime rows have an AniList id stored
  const { count, error } = await supabaseAdmin
    .from("anime")
    .select("id", { count: "exact", head: true })
    .not("anilist_id", "is", null);

  if (error) {
    console.error("Error counting imported anime:", error);
    return null;
  }
  return typeof count === "number" ? count : null;
}

async function importSingleById(idNum: number) {
  const { data: anime, error: aniError } = await getAniListAnimeById(idNum);

  if (aniError || !anime) {
    return {
      ok: false as const,
      error: aniError || "Failed to fetch anime from AniList",
    };
  }

  // 4) Upsert into public.anime table (use anilist_id)
  const row = mapAniListToAnimeRow(anime);

  const { data: upserted, error: dbError } = await supabaseAdmin
    .from("anime")
    .upsert(row, { onConflict: "anilist_id" })
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
      created_at,
      anilist_id,
      mal_id
    `
    )
    .single();

  if (dbError || !upserted) {
    console.error("Error inserting anime into Supabase:", dbError);
    return { ok: false as const, error: "Failed to insert anime into DB" };
  }

  const animeId = upserted.id as string;
  const finalTotalEpisodes =
    typeof upserted.total_episodes === "number" && upserted.total_episodes > 0
      ? upserted.total_episodes
      : null;

  // episodes
  if (finalTotalEpisodes) {
    const episodesPayload = Array.from({ length: finalTotalEpisodes }, (_, idx) => ({
      anime_id: animeId,
      episode_number: idx + 1,
    }));

    const { error: episodesError } = await supabaseAdmin
      .from("anime_episodes")
      .upsert(episodesPayload, { onConflict: "anime_id,episode_number" });

    if (episodesError) {
      console.error("Error upserting anime_episodes for anime", animeId, episodesError);
    }
  }

  // tags
  try {
    const { error: deleteError } = await supabaseAdmin
      .from("anime_tags")
      .delete()
      .eq("anime_id", animeId);

    if (deleteError) console.error("Error clearing existing anime_tags:", deleteError);

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
      const { error: insertError } = await supabaseAdmin.from("anime_tags").insert(tagRows);
      if (insertError) console.error("Error inserting anime_tags:", insertError);
    }
  } catch (err) {
    console.error("Unexpected error syncing anime_tags:", err);
  }

  return { ok: true as const, anime: upserted };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log("IMPORTER BUILD STAMP", "bulk-onconflict-anilist-id-v2");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Optional protection
  if (ADMIN_IMPORT_SECRET) {
    const token =
      (req.headers["x-import-secret"] as string | undefined) ||
      (req.body && (req.body.secret as string | undefined));

    if (!token || token !== ADMIN_IMPORT_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const body = (req.body ?? {}) as any;

  // ✅ BULK MODE (1 AniList request per page)
  if (body.mode === "bulk") {
    const page = Math.max(1, parseIntSafe(body.page, 1));
    const perPage = Math.min(50, Math.max(5, parseIntSafe(body.perPage, 25))); // default 25 for safety
    const startedAt = Date.now();

    const { data: animes, pageInfo, error } = await listAniListAnimePage(page, perPage);
    if (error) return res.status(500).json({ error });

    // 1) upsert anime rows
    const animeRows = animes.map(mapAniListToAnimeRow);
    const { data: upsertedRows, error: upsertErr } = await supabaseAdmin
      .from("anime")
      .upsert(animeRows, { onConflict: "anilist_id" })
      .select("id, anilist_id, total_episodes");

    if (upsertErr || !upsertedRows) {
      console.error("Bulk anime upsert error:", upsertErr);
      return res.status(500).json({
        error: "Failed to upsert anime rows",
        details: upsertErr, // ✅ show me this
        sampleRow: animeRows?.[0] ?? null, // ✅ also helpful
      });
    }

    // Build map anilist_id -> anime uuid
    const idMap = new Map<number, { anime_id: string; total_episodes: number | null }>();
    for (const r of upsertedRows as any[]) {
      if (typeof r.anilist_id === "number" && typeof r.id === "string") {
        idMap.set(r.anilist_id, {
          anime_id: r.id,
          total_episodes:
            typeof r.total_episodes === "number" && r.total_episodes > 0
              ? r.total_episodes
              : null,
        });
      }
    }

    // 2) episodes: generate payload (can be big; do it in chunks)
    const episodesPayload: { anime_id: string; episode_number: number }[] = [];
    for (const a of animes) {
      const rec = idMap.get(a.id);
      const n = rec?.total_episodes ?? (a.episodes ?? null);
      if (!rec?.anime_id || !n || n <= 0) continue;

      for (let ep = 1; ep <= n; ep++) {
        episodesPayload.push({ anime_id: rec.anime_id, episode_number: ep });
      }
    }

    // chunk upserts to avoid massive request bodies
    const chunkSize = 5000;
    for (let i = 0; i < episodesPayload.length; i += chunkSize) {
      const chunk = episodesPayload.slice(i, i + chunkSize);
      const { error: episodesError } = await supabaseAdmin
        .from("anime_episodes")
        .upsert(chunk, { onConflict: "anime_id,episode_number" });

      if (episodesError) {
        console.error("Bulk episodes upsert error:", episodesError);
        // don't fail whole page
        break;
      }
    }

    // 3) tags: delete existing for these anime_ids, then insert all tags for page
    const animeIdsInPage = Array.from(idMap.values()).map((x) => x.anime_id);

    if (animeIdsInPage.length > 0) {
      const { error: delTagsErr } = await supabaseAdmin
        .from("anime_tags")
        .delete()
        .in("anime_id", animeIdsInPage);

      if (delTagsErr) console.error("Bulk delete tags error:", delTagsErr);
    }

    const allTagRows: any[] = [];
    for (const a of animes) {
      const rec = idMap.get(a.id);
      if (!rec?.anime_id) continue;

      for (const t of a.tags ?? []) {
        if (!t?.name) continue;
        allTagRows.push({
          anime_id: rec.anime_id,
          name: t.name,
          description: t.description ?? null,
          rank: t.rank ?? null,
          is_adult: t.isAdult ?? null,
          is_general_spoiler: t.isGeneralSpoiler ?? null,
          is_media_spoiler: t.isMediaSpoiler ?? null,
          category: t.category ?? null,
        });
      }
    }

    if (allTagRows.length > 0) {
      // chunk inserts as well
      const tagChunkSize = 2000;
      for (let i = 0; i < allTagRows.length; i += tagChunkSize) {
        const chunk = allTagRows.slice(i, i + tagChunkSize);
        const { error: insTagsErr } = await supabaseAdmin.from("anime_tags").insert(chunk);
        if (insTagsErr) {
          console.error("Bulk insert tags error:", insTagsErr);
          break;
        }
      }
    }

    // ✅ REPLACED: total/processed/pct block + response (bulk mode)
    const hasNextPage = pageInfo?.hasNextPage ?? false;
    const lastPage = pageInfo?.lastPage ?? null;

    // ✅ “done” is ONLY based on AniList paging signal
    const done = hasNextPage === false;

    // ✅ DB-backed progress (truth source)
    const dbImported = await getDbImportedCount();

    // ✅ How many items we *think* we processed by paging
    // (useful for logging, but NOT truth)
    const processedByPaging = (page - 1) * perPage + animes.length;

    // ✅ Percent based on DB count (optional)
    // We do NOT trust AniList total; it can be capped/odd.
    const pct_db = null; // leave null unless you want a chosen target

    const duration_ms = Date.now() - startedAt;

    return res.status(200).json({
      success: true,
      mode: "bulk",
      page,
      perPage,

      imported: animes.length,
      failed: 0,

      // Paging signals (source: AniList)
      hasNextPage,
      nextPage: hasNextPage ? page + 1 : null,
      lastPage,

      // Progress signals (source: your DB)
      dbImported,

      // Debug / logging helpers
      processedByPaging,
      duration_ms,

      // Optional placeholder
      pct_db,

      // ✅ The only thing you actually need to know
      done,
    });
  }

  // ✅ SINGLE MODE (your original behavior)
  const { anilistId } = body as { anilistId?: number | string };

  if (!anilistId) return res.status(400).json({ error: "Missing anilistId" });

  const idNum = typeof anilistId === "string" ? parseInt(anilistId, 10) : anilistId;

  if (!idNum || Number.isNaN(idNum)) {
    return res.status(400).json({ error: "Invalid anilistId" });
  }

  const r = await importSingleById(idNum);

  if (!r.ok) {
    console.error("AniList import error:", r.error);
    return res.status(500).json({ error: r.error });
  }

  return res.status(200).json({
    success: true,
    anime: r.anime,
  });
}
