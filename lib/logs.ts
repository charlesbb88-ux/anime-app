// lib/logs.ts
"use client";

import { supabase } from "@/lib/supabaseClient";

export type Visibility = "public" | "friends" | "private";

/* ============================================================
   Shared helpers
============================================================ */

async function getVisibilityToUse(userId: string, visibility?: Visibility) {
  if (visibility) return visibility;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("default_visibility")
    .eq("id", userId)
    .maybeSingle();

  if (!error && profile?.default_visibility) {
    return profile.default_visibility as Visibility;
  }

  return "public" as Visibility;
}

async function getAuthedUserId(): Promise<{ userId: string | null; error: any }> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) return { userId: null, error };
  if (!user) return { userId: null, error: new Error("Not authenticated") };

  return { userId: user.id, error: null };
}

/**
 * ✅ Best-effort feed post creation for logs.
 * This is intentionally "soft fail":
 * - If your posts schema doesn't match, we do NOT break logging.
 *
 * Adjust these fields if your posts table uses different column names.
 */
async function tryCreatePostForLog(input: {
  user_id: string;
  visibility: Visibility;
  contains_spoilers: boolean;

  // targets
  anime_id?: string | null;
  anime_episode_id?: string | null;
  manga_id?: string | null;
  manga_chapter_id?: string | null;

  // snapshot fields
  rating: number | null;
  liked: boolean;
  review_id: string | null;

  // log note
  note: string | null;

  // timestamp
  created_at_iso: string;
}) {
  try {
    // ⚠️ These column names are "best guess".
    // If your posts table uses different ones, the insert will error,
    // but we swallow it so logs still work.
    const payload: any = {
      user_id: input.user_id,

      // common feed fields
      visibility: input.visibility,
      contains_spoilers: input.contains_spoilers,

      // link targets so PostFeed can filter by anime/manga page
      anime_id: input.anime_id ?? null,
      anime_episode_id: input.anime_episode_id ?? null,
      manga_id: input.manga_id ?? null,
      manga_chapter_id: input.manga_chapter_id ?? null,

      // snapshot (so feed cards can show rating/like even without a review body)
      rating: input.rating,
      liked: input.liked,
      review_id: input.review_id,

      // text (if your feed reads a different column name, rename this)
      content: input.note ?? null,

      // type/kind (rename if your schema uses post_type, kind, etc.)
      type: "log",

      created_at: input.created_at_iso,
    };

    const { error } = await supabase.from("posts").insert(payload);

    if (error) {
      // Soft fail: don't break logging
      console.warn("[logs] Could not create feed post for log:", error);
    }
  } catch (e) {
    // Soft fail: don't break logging
    console.warn("[logs] Exception creating feed post for log:", e);
  }
}

/* ============================================================
   ANIME: Episode Log
============================================================ */

export type AnimeEpisodeLogRow = {
  id: string;
  user_id: string;

  anime_id: string;
  anime_episode_id: string;

  logged_at: string;
  rating: number | null;
  liked: boolean;
  review_id: string | null;

  is_rewatch: boolean;

  note: string | null;
  contains_spoilers: boolean;
  visibility: Visibility;

  created_at: string;
  updated_at: string | null;
};

export type CreateAnimeEpisodeLogInput = {
  anime_id: string;
  anime_episode_id: string;

  logged_at?: string;

  rating?: number | null;
  liked?: boolean;
  review_id?: string | null;

  is_rewatch?: boolean;

  note?: string | null;
  contains_spoilers?: boolean;

  visibility?: Visibility;
};

export async function createAnimeEpisodeLog(
  input: CreateAnimeEpisodeLogInput
): Promise<{ data: AnimeEpisodeLogRow | null; error: any }> {
  const { userId, error: userError } = await getAuthedUserId();
  if (userError) return { data: null, error: userError };
  if (!userId) return { data: null, error: new Error("Not authenticated") };

  const visibilityToUse = await getVisibilityToUse(userId, input.visibility);

  const loggedAt = input.logged_at ?? new Date().toISOString();

  const { data: log, error: logError } = await supabase
    .from("anime_episode_logs")
    .insert({
      user_id: userId,

      anime_id: input.anime_id,
      anime_episode_id: input.anime_episode_id,

      logged_at: loggedAt,

      rating: input.rating ?? null,
      liked: input.liked ?? false,
      review_id: input.review_id ?? null,

      is_rewatch: input.is_rewatch ?? false,

      note: input.note ?? null,
      contains_spoilers: input.contains_spoilers ?? false,
      visibility: visibilityToUse,
    })
    .select("*")
    .single();

  if (logError || !log) return { data: null, error: logError };

  // ✅ ALSO create a feed post (soft fail, won't break logging)
  await tryCreatePostForLog({
    user_id: userId,
    visibility: visibilityToUse,
    contains_spoilers: (log as any).contains_spoilers ?? false,

    anime_id: (log as any).anime_id ?? input.anime_id,
    anime_episode_id: (log as any).anime_episode_id ?? input.anime_episode_id,

    rating: (log as any).rating ?? null,
    liked: Boolean((log as any).liked),
    review_id: (log as any).review_id ?? null,

    note: (log as any).note ?? null,
    created_at_iso: (log as any).logged_at ?? loggedAt,
  });

  return { data: log as AnimeEpisodeLogRow, error: null };
}

export async function getMyAnimeEpisodeLogCount(
  anime_episode_id: string
): Promise<{ count: number; error: any }> {
  const { userId, error: userError } = await getAuthedUserId();
  if (userError) return { count: 0, error: userError };
  if (!userId) return { count: 0, error: new Error("Not authenticated") };

  const { count, error } = await supabase
    .from("anime_episode_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("anime_episode_id", anime_episode_id);

  if (error) return { count: 0, error };
  return { count: count ?? 0, error: null };
}

/* ============================================================
   ANIME: Series Log
============================================================ */

export type AnimeSeriesLogRow = {
  id: string;
  user_id: string;

  anime_id: string;

  logged_at: string;
  rating: number | null;
  liked: boolean;
  review_id: string | null;

  is_rewatch: boolean;

  note: string | null;
  contains_spoilers: boolean;
  visibility: Visibility;

  created_at: string;
  updated_at: string | null;
};

export type CreateAnimeSeriesLogInput = {
  anime_id: string;

  logged_at?: string;

  rating?: number | null;
  liked?: boolean;
  review_id?: string | null;

  is_rewatch?: boolean;

  note?: string | null;
  contains_spoilers?: boolean;

  visibility?: Visibility;
};

export async function createAnimeSeriesLog(
  input: CreateAnimeSeriesLogInput
): Promise<{ data: AnimeSeriesLogRow | null; error: any }> {
  const { userId, error: userError } = await getAuthedUserId();
  if (userError) return { data: null, error: userError };
  if (!userId) return { data: null, error: new Error("Not authenticated") };

  const visibilityToUse = await getVisibilityToUse(userId, input.visibility);

  const loggedAt = input.logged_at ?? new Date().toISOString();

  const { data: log, error: logError } = await supabase
    .from("anime_series_logs")
    .insert({
      user_id: userId,
      anime_id: input.anime_id,

      logged_at: loggedAt,

      rating: input.rating ?? null,
      liked: input.liked ?? false,
      review_id: input.review_id ?? null,

      is_rewatch: input.is_rewatch ?? false,

      note: input.note ?? null,
      contains_spoilers: input.contains_spoilers ?? false,
      visibility: visibilityToUse,
    })
    .select("*")
    .single();

  if (logError || !log) return { data: null, error: logError };

  await tryCreatePostForLog({
    user_id: userId,
    visibility: visibilityToUse,
    contains_spoilers: (log as any).contains_spoilers ?? false,

    anime_id: (log as any).anime_id ?? input.anime_id,

    rating: (log as any).rating ?? null,
    liked: Boolean((log as any).liked),
    review_id: (log as any).review_id ?? null,

    note: (log as any).note ?? null,
    created_at_iso: (log as any).logged_at ?? loggedAt,
  });

  return { data: log as AnimeSeriesLogRow, error: null };
}

/* ============================================================
   MANGA: Series Log
============================================================ */

export type MangaSeriesLogRow = {
  id: string;
  user_id: string;

  manga_id: string;

  logged_at: string;
  rating: number | null;
  liked: boolean;
  review_id: string | null;

  is_reread: boolean;
  is_rewatch?: boolean;

  note: string | null;
  contains_spoilers: boolean;
  visibility: Visibility;

  created_at: string;
  updated_at: string | null;
};

export type CreateMangaSeriesLogInput = {
  manga_id: string;

  logged_at?: string;

  rating?: number | null;
  liked?: boolean;
  review_id?: string | null;

  is_reread?: boolean;
  is_rewatch?: boolean;

  note?: string | null;
  contains_spoilers?: boolean;

  visibility?: Visibility;
};

export async function createMangaSeriesLog(
  input: CreateMangaSeriesLogInput
): Promise<{ data: MangaSeriesLogRow | null; error: any }> {
  const { userId, error: userError } = await getAuthedUserId();
  if (userError) return { data: null, error: userError };
  if (!userId) return { data: null, error: new Error("Not authenticated") };

  const visibilityToUse = await getVisibilityToUse(userId, input.visibility);

  const isReread = input.is_reread ?? input.is_rewatch ?? false;
  const loggedAt = input.logged_at ?? new Date().toISOString();

  const { data: log, error: logError } = await supabase
    .from("manga_series_logs")
    .insert({
      user_id: userId,
      manga_id: input.manga_id,

      logged_at: loggedAt,

      rating: input.rating ?? null,
      liked: input.liked ?? false,
      review_id: input.review_id ?? null,

      is_reread: isReread,

      note: input.note ?? null,
      contains_spoilers: input.contains_spoilers ?? false,
      visibility: visibilityToUse,
    })
    .select("*")
    .single();

  if (logError || !log) return { data: null, error: logError };

  await tryCreatePostForLog({
    user_id: userId,
    visibility: visibilityToUse,
    contains_spoilers: (log as any).contains_spoilers ?? false,

    manga_id: (log as any).manga_id ?? input.manga_id,

    rating: (log as any).rating ?? null,
    liked: Boolean((log as any).liked),
    review_id: (log as any).review_id ?? null,

    note: (log as any).note ?? null,
    created_at_iso: (log as any).logged_at ?? loggedAt,
  });

  const normalized = { ...(log as any), is_rewatch: (log as any).is_reread } as MangaSeriesLogRow;
  return { data: normalized, error: null };
}

/* ============================================================
   MANGA: Chapter Log
============================================================ */

export type MangaChapterLogRow = {
  id: string;
  user_id: string;

  manga_id: string;
  manga_chapter_id: string;

  logged_at: string;
  rating: number | null;
  liked: boolean;
  review_id: string | null;

  is_reread: boolean;
  is_rewatch?: boolean;

  note: string | null;
  contains_spoilers: boolean;
  visibility: Visibility;

  created_at: string;
  updated_at: string | null;
};

export type CreateMangaChapterLogInput = {
  manga_id: string;
  manga_chapter_id: string;

  logged_at?: string;

  rating?: number | null;
  liked?: boolean;
  review_id?: string | null;

  is_reread?: boolean;
  is_rewatch?: boolean;

  note?: string | null;
  contains_spoilers?: boolean;

  visibility?: Visibility;
};

export async function createMangaChapterLog(
  input: CreateMangaChapterLogInput
): Promise<{ data: MangaChapterLogRow | null; error: any }> {
  const { userId, error: userError } = await getAuthedUserId();
  if (userError) return { data: null, error: userError };
  if (!userId) return { data: null, error: new Error("Not authenticated") };

  const visibilityToUse = await getVisibilityToUse(userId, input.visibility);

  const isReread = input.is_reread ?? input.is_rewatch ?? false;
  const loggedAt = input.logged_at ?? new Date().toISOString();

  const { data: log, error: logError } = await supabase
    .from("manga_chapter_logs")
    .insert({
      user_id: userId,

      manga_id: input.manga_id,
      manga_chapter_id: input.manga_chapter_id,

      logged_at: loggedAt,

      rating: input.rating ?? null,
      liked: input.liked ?? false,
      review_id: input.review_id ?? null,

      is_reread: isReread,

      note: input.note ?? null,
      contains_spoilers: input.contains_spoilers ?? false,
      visibility: visibilityToUse,
    })
    .select("*")
    .single();

  if (logError || !log) return { data: null, error: logError };

  await tryCreatePostForLog({
    user_id: userId,
    visibility: visibilityToUse,
    contains_spoilers: (log as any).contains_spoilers ?? false,

    manga_id: (log as any).manga_id ?? input.manga_id,
    manga_chapter_id: (log as any).manga_chapter_id ?? input.manga_chapter_id,

    rating: (log as any).rating ?? null,
    liked: Boolean((log as any).liked),
    review_id: (log as any).review_id ?? null,

    note: (log as any).note ?? null,
    created_at_iso: (log as any).logged_at ?? loggedAt,
  });

  const normalized = { ...(log as any), is_rewatch: (log as any).is_reread } as MangaChapterLogRow;
  return { data: normalized, error: null };
}

export async function getMyMangaChapterLogCount(
  manga_chapter_id: string
): Promise<{ count: number; error: any }> {
  const { userId, error: userError } = await getAuthedUserId();
  if (userError) return { count: 0, error: userError };
  if (!userId) return { count: 0, error: new Error("Not authenticated") };

  const { count, error } = await supabase
    .from("manga_chapter_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("manga_chapter_id", manga_chapter_id);

  if (error) return { count: 0, error };
  return { count: count ?? 0, error: null };
}
