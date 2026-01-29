// pages/api/admin/import-anime-from-anilist.ts
// ✅ FIX: robust page-based import that can run start->end without dying on MAL collisions

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAniListAnimeById, listAniListAnimePage } from "@/lib/anilist";
import type { AniListAnime } from "@/lib/anilist";

function slugifyTitle(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function fuzzyDateToString(
  date: { year: number | null; month: number | null; day: number | null } | null
): string | null {
  if (!date || !date.year) return null;
  const y = date.year;
  const m = String(date.month ?? 1).padStart(2, "0");
  const d = String(date.day ?? 1).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

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
  const baseSlug = slugifyTitle(mainTitle);
  const slug = `${baseSlug}-${a.id}`;
  const imageUrl = a.coverImage?.extraLarge || a.coverImage?.large || a.coverImage?.medium || null;

  return {
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

async function getDbImportedCount() {
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

/**
 * ✅ Prevent duplicate key violations for anime_unique_mal_id:
 * - Dedupes mal_id inside the batch (keep first, null rest)
 * - Nulls mal_id that already exists in DB for a DIFFERENT anilist_id
 */
async function sanitizeMalIdsForBatch(rows: any[]) {
  // 1) Deduplicate mal_id inside this batch
  const seenInBatch = new Set<number>();
  const batchDeduped = rows.map((r) => {
    const mal = r?.mal_id ? Number(r.mal_id) : null;
    if (!mal || !Number.isFinite(mal) || mal <= 0) return r;

    if (seenInBatch.has(mal)) {
      return { ...r, mal_id: null };
    }
    seenInBatch.add(mal);
    return r;
  });

  // 2) Check collisions against DB
  const malIds = Array.from(
    new Set(
      batchDeduped
        .map((r) => (r?.mal_id ? Number(r.mal_id) : null))
        .filter((n) => Number.isFinite(n) && (n as number) > 0) as number[]
    )
  );

  if (malIds.length === 0) return batchDeduped;

  const { data: existing, error } = await supabaseAdmin
    .from("anime")
    .select("id, anilist_id, mal_id")
    .in("mal_id", malIds);

  if (error) {
    console.error("Error checking existing mal_id collisions:", error);
    // If we can't check, return as-is; worst case the upsert errors and we’ll report it
    return batchDeduped;
  }

  const malToExisting = new Map<number, { anilist_id: number | null; id: string }>();
  for (const e of existing ?? []) {
    const mal = e?.mal_id ? Number(e.mal_id) : null;
    if (!mal) continue;
    malToExisting.set(mal, { anilist_id: e.anilist_id ?? null, id: e.id });
  }

  const fixed = batchDeduped.map((r) => {
    const mal = r?.mal_id ? Number(r.mal_id) : null;
    if (!mal) return r;

    const ex = malToExisting.get(mal);
    if (!ex) return r;

    const incomingAni = r?.anilist_id ? Number(r.anilist_id) : null;

    // If it's the same AniList record, keep mal_id (this is a safe update)
    if (incomingAni && ex.anilist_id && incomingAni === ex.anilist_id) return r;

    // Otherwise, collision -> drop mal_id so unique constraint won’t kill the batch
    return { ...r, mal_id: null };
  });

  return fixed;
}

async function importSingleById(idNum: number) {
  const { data: anime, error: aniError } = await getAniListAnimeById(idNum);

  if (aniError || !anime) {
    return { ok: false as const, error: aniError || "Failed to fetch anime from AniList" };
  }

  const row = mapAniListToAnimeRow(anime);
  const safe = await sanitizeMalIdsForBatch([row]);

  const { data: upserted, error: dbError } = await supabaseAdmin
    .from("anime")
    .upsert(safe[0], { onConflict: "anilist_id" })
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

  if (finalTotalEpisodes) {
    const episodesPayload = Array.from({ length: finalTotalEpisodes }, (_, idx) => ({
      anime_id: animeId,
      episode_number: idx + 1,
    }));

    const { error: episodesError } = await supabaseAdmin
      .from("anime_episodes")
      .upsert(episodesPayload, { onConflict: "anime_id,episode_number" });

    if (episodesError) console.error("Error upserting anime_episodes", animeId, episodesError);
  }

  // tags
  try {
    const { error: deleteError } = await supabaseAdmin.from("anime_tags").delete().eq("anime_id", animeId);
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

function okJson(res: NextApiResponse, payload: any) {
  // ✅ ALWAYS return 200 so PowerShell loop doesn’t throw
  return res.status(200).json(payload);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log("IMPORTER BUILD STAMP", "cursor-page-v2-mal-safe");

  if (req.method !== "POST") return okJson(res, { success: false, error: "Method not allowed" });

  if (ADMIN_IMPORT_SECRET) {
    const token =
      (req.headers["x-import-secret"] as string | undefined) ||
      (req.body && (req.body.secret as string | undefined));

    if (!token || token !== ADMIN_IMPORT_SECRET) {
      return okJson(res, { success: false, error: "Unauthorized" });
    }
  }

  const body = (req.body ?? {}) as any;

  // =========================
  // CURSOR MODE (page cursor)
  // Input: { mode:"cursor", afterId:<pageNumber>, perPage:number }
  // =========================
  if (body.mode === "cursor") {
    const startedAt = Date.now();
    const perPage = Math.min(50, Math.max(5, parseIntSafe(body.perPage, 25)));
    const page = Math.max(1, parseIntSafe(body.afterId, 1));

    const { data: animes, pageInfo, error } = await listAniListAnimePage(page, perPage);

    if (error) {
      return okJson(res, {
        success: false,
        mode: "cursor",
        perPage,
        afterId: page,
        nextAfterId: page, // retry same page
        done: false,
        hasNextPage: true,
        lastPage: null,
        dbImported: await getDbImportedCount(),
        error,
        retry: true,
        duration_ms: Date.now() - startedAt,
      });
    }

    const hasNextPage = pageInfo?.hasNextPage ?? false;
    const done = hasNextPage === false;

    // upsert anime (MAL-safe)
    const animeRows = animes.map(mapAniListToAnimeRow);
    const safeRows = await sanitizeMalIdsForBatch(animeRows);

    const { data: upsertedRows, error: upsertErr } = await supabaseAdmin
      .from("anime")
      .upsert(safeRows, { onConflict: "anilist_id" })
      .select("id, anilist_id, total_episodes");

    if (upsertErr || !upsertedRows) {
      console.error("Cursor(page) anime upsert error:", upsertErr);
      return okJson(res, {
        success: false,
        mode: "cursor",
        perPage,
        afterId: page,
        nextAfterId: page, // retry same page (or you can skip manually)
        done: false,
        hasNextPage,
        lastPage: pageInfo?.lastPage ?? null,
        dbImported: await getDbImportedCount(),
        error: "Failed to upsert anime rows",
        details: upsertErr,
        sampleRow: safeRows?.[0] ?? null,
        retry: true,
        duration_ms: Date.now() - startedAt,
      });
    }

    // map anilist_id -> uuid
    const idMap = new Map<number, { anime_id: string; total_episodes: number | null }>();
    for (const r of upsertedRows as any[]) {
      if (typeof r.anilist_id === "number" && typeof r.id === "string") {
        idMap.set(r.anilist_id, {
          anime_id: r.id,
          total_episodes:
            typeof r.total_episodes === "number" && r.total_episodes > 0 ? r.total_episodes : null,
        });
      }
    }

    // episodes
    const episodesPayload: { anime_id: string; episode_number: number }[] = [];
    for (const a of animes) {
      const rec = idMap.get(a.id);
      const n = rec?.total_episodes ?? (a.episodes ?? null);
      if (!rec?.anime_id || !n || n <= 0) continue;
      for (let ep = 1; ep <= n; ep++) episodesPayload.push({ anime_id: rec.anime_id, episode_number: ep });
    }

    const epChunkSize = 5000;
    for (let i = 0; i < episodesPayload.length; i += epChunkSize) {
      const chunk = episodesPayload.slice(i, i + epChunkSize);
      const { error: episodesError } = await supabaseAdmin
        .from("anime_episodes")
        .upsert(chunk, { onConflict: "anime_id,episode_number" });
      if (episodesError) {
        console.error("Cursor(page) episodes upsert error:", episodesError);
        break;
      }
    }

    // tags: delete then insert for this batch
    const animeIdsInBatch = Array.from(idMap.values()).map((x) => x.anime_id);

    if (animeIdsInBatch.length > 0) {
      const { error: delTagsErr } = await supabaseAdmin.from("anime_tags").delete().in("anime_id", animeIdsInBatch);
      if (delTagsErr) console.error("Cursor(page) delete tags error:", delTagsErr);
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
      const tagChunkSize = 2000;
      for (let i = 0; i < allTagRows.length; i += tagChunkSize) {
        const chunk = allTagRows.slice(i, i + tagChunkSize);
        const { error: insTagsErr } = await supabaseAdmin.from("anime_tags").insert(chunk);
        if (insTagsErr) {
          console.error("Cursor(page) insert tags error:", insTagsErr);
          break;
        }
      }
    }

    const dbImported = await getDbImportedCount();

    return okJson(res, {
      success: true,
      mode: "cursor",

      perPage,
      afterId: page,
      nextAfterId: done ? null : page + 1,
      done,

      batchFetched: animes.length,

      hasNextPage,
      lastPage: pageInfo?.lastPage ?? null,
      dbImported,

      duration_ms: Date.now() - startedAt,
    });
  }

  // =========================
  // BULK MODE (page/perPage)
  // =========================
  if (body.mode === "bulk") {
    const startedAt = Date.now();
    const page = Math.max(1, parseIntSafe(body.page, 1));
    const perPage = Math.min(50, Math.max(5, parseIntSafe(body.perPage, 25)));

    const { data: animes, pageInfo, error } = await listAniListAnimePage(page, perPage);
    if (error) {
      return okJson(res, {
        success: false,
        mode: "bulk",
        page,
        perPage,
        imported: 0,
        failed: 0,
        hasNextPage: true,
        nextPage: page, // retry same page
        lastPage: null,
        dbImported: await getDbImportedCount(),
        processedByPaging: (page - 1) * perPage,
        error,
        retry: true,
        duration_ms: Date.now() - startedAt,
        done: false,
      });
    }

    const animeRows = animes.map(mapAniListToAnimeRow);
    const safeRows = await sanitizeMalIdsForBatch(animeRows);

    const { data: upsertedRows, error: upsertErr } = await supabaseAdmin
      .from("anime")
      .upsert(safeRows, { onConflict: "anilist_id" })
      .select("id, anilist_id, total_episodes");

    if (upsertErr || !upsertedRows) {
      console.error("Bulk anime upsert error:", upsertErr);
      return okJson(res, {
        success: false,
        mode: "bulk",
        page,
        perPage,
        imported: 0,
        failed: safeRows.length,
        hasNextPage: true,
        nextPage: page, // retry same page
        lastPage: pageInfo?.lastPage ?? null,
        dbImported: await getDbImportedCount(),
        processedByPaging: (page - 1) * perPage,
        error: "Failed to upsert anime rows",
        details: upsertErr,
        sampleRow: safeRows?.[0] ?? null,
        retry: true,
        duration_ms: Date.now() - startedAt,
        done: false,
      });
    }

    const idMap = new Map<number, { anime_id: string; total_episodes: number | null }>();
    for (const r of upsertedRows as any[]) {
      if (typeof r.anilist_id === "number" && typeof r.id === "string") {
        idMap.set(r.anilist_id, {
          anime_id: r.id,
          total_episodes:
            typeof r.total_episodes === "number" && r.total_episodes > 0 ? r.total_episodes : null,
        });
      }
    }

    // episodes
    const episodesPayload: { anime_id: string; episode_number: number }[] = [];
    for (const a of animes) {
      const rec = idMap.get(a.id);
      const n = rec?.total_episodes ?? (a.episodes ?? null);
      if (!rec?.anime_id || !n || n <= 0) continue;
      for (let ep = 1; ep <= n; ep++) episodesPayload.push({ anime_id: rec.anime_id, episode_number: ep });
    }

    const chunkSize = 5000;
    for (let i = 0; i < episodesPayload.length; i += chunkSize) {
      const chunk = episodesPayload.slice(i, i + chunkSize);
      const { error: episodesError } = await supabaseAdmin
        .from("anime_episodes")
        .upsert(chunk, { onConflict: "anime_id,episode_number" });
      if (episodesError) {
        console.error("Bulk episodes upsert error:", episodesError);
        break;
      }
    }

    // tags
    const animeIdsInPage = Array.from(idMap.values()).map((x) => x.anime_id);

    if (animeIdsInPage.length > 0) {
      const { error: delTagsErr } = await supabaseAdmin.from("anime_tags").delete().in("anime_id", animeIdsInPage);
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

    const hasNextPage = pageInfo?.hasNextPage ?? false;
    const lastPage = pageInfo?.lastPage ?? null;
    const done = hasNextPage === false;
    const dbImported = await getDbImportedCount();
    const processedByPaging = (page - 1) * perPage + animes.length;

    return okJson(res, {
      success: true,
      mode: "bulk",
      page,
      perPage,
      imported: animes.length,
      failed: 0,
      hasNextPage,
      nextPage: hasNextPage ? page + 1 : null,
      lastPage,
      dbImported,
      processedByPaging,
      duration_ms: Date.now() - startedAt,
      pct_db: null,
      done,
    });
  }

  // =========================
  // SINGLE MODE
  // =========================
  const { anilistId } = body as { anilistId?: number | string };
  if (!anilistId) return okJson(res, { success: false, error: "Missing anilistId" });

  const idNum = typeof anilistId === "string" ? parseInt(anilistId, 10) : anilistId;
  if (!idNum || Number.isNaN(idNum)) return okJson(res, { success: false, error: "Invalid anilistId" });

  const r = await importSingleById(idNum);
  if (!r.ok) return okJson(res, { success: false, error: r.error });

  return okJson(res, { success: true, anime: r.anime });
}
