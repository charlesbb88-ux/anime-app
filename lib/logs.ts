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

  // optional
  logged_at?: string; // defaults to now

  // ✅ snapshot fields
  rating?: number | null;
  liked?: boolean;
  review_id?: string | null;

  is_rewatch?: boolean;

  note?: string | null;
  contains_spoilers?: boolean;

  // if you don't pass this, we use the user's profile default_visibility if present
  visibility?: Visibility;
};

export async function createAnimeEpisodeLog(
  input: CreateAnimeEpisodeLogInput
): Promise<{ data: AnimeEpisodeLogRow | null; error: any }> {
  const { userId, error: userError } = await getAuthedUserId();
  if (userError) return { data: null, error: userError };
  if (!userId) return { data: null, error: new Error("Not authenticated") };

  const visibilityToUse = await getVisibilityToUse(userId, input.visibility);

  const { data: log, error: logError } = await supabase
    .from("anime_episode_logs")
    .insert({
      user_id: userId,

      anime_id: input.anime_id,
      anime_episode_id: input.anime_episode_id,

      logged_at: input.logged_at ?? new Date().toISOString(),

      // ✅ snapshot stored on log
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

  // ✅ snapshot fields
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

  const { data: log, error: logError } = await supabase
    .from("anime_series_logs")
    .insert({
      user_id: userId,
      anime_id: input.anime_id,

      logged_at: input.logged_at ?? new Date().toISOString(),

      // ✅ snapshot stored on log
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
  return { data: log as AnimeSeriesLogRow, error: null };
}

/* ============================================================
   MANGA: Series Log
   DB uses: is_reread (boolean)
   We keep an is_rewatch alias in the returned type for backward compatibility.
============================================================ */

export type MangaSeriesLogRow = {
  id: string;
  user_id: string;

  manga_id: string;

  logged_at: string;
  rating: number | null;
  liked: boolean;
  review_id: string | null;

  // DB column:
  is_reread: boolean;

  // Back-compat alias (some code may still reference is_rewatch):
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

  // ✅ snapshot fields
  rating?: number | null;
  liked?: boolean;
  review_id?: string | null;

  // Prefer is_reread; accept is_rewatch too so old callers don’t break:
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

  const { data: log, error: logError } = await supabase
    .from("manga_series_logs")
    .insert({
      user_id: userId,
      manga_id: input.manga_id,

      logged_at: input.logged_at ?? new Date().toISOString(),

      // ✅ snapshot stored on log
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

  // add alias so older code reading is_rewatch won’t break
  const normalized = { ...(log as any), is_rewatch: (log as any).is_reread } as MangaSeriesLogRow;

  return { data: normalized, error: null };
}

/* ============================================================
   MANGA: Chapter Log
   DB uses: is_reread (boolean)
   We keep an is_rewatch alias in the returned type for backward compatibility.
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

  // DB column:
  is_reread: boolean;

  // Back-compat alias:
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

  // ✅ snapshot fields
  rating?: number | null;
  liked?: boolean;
  review_id?: string | null;

  // Prefer is_reread; accept is_rewatch too so old callers don’t break:
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

  const { data: log, error: logError } = await supabase
    .from("manga_chapter_logs")
    .insert({
      user_id: userId,

      manga_id: input.manga_id,
      manga_chapter_id: input.manga_chapter_id,

      logged_at: input.logged_at ?? new Date().toISOString(),

      // ✅ snapshot stored on log
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
