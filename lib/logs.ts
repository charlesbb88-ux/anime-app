// lib/logs.ts
"use client";

import { supabase } from "@/lib/supabaseClient";

export type Visibility = "public" | "friends" | "private";

/* ============================================================
   ANIME: Episode Log (existing)
============================================================ */

export type AnimeEpisodeLogRow = {
  id: string;
  user_id: string;

  anime_id: string;
  anime_episode_id: string;

  logged_at: string;
  rating: number | null;
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
  rating?: number | null;
  is_rewatch?: boolean;

  note?: string | null;
  contains_spoilers?: boolean;

  // if you don't pass this, we use the user's profile default_visibility if present
  visibility?: Visibility;
};

// ------------------------------------------------------------
// ANIME: Episode Log
// ------------------------------------------------------------
export async function createAnimeEpisodeLog(
  input: CreateAnimeEpisodeLogInput
): Promise<{ data: AnimeEpisodeLogRow | null; error: any }> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) return { data: null, error: userError };
  if (!user) return { data: null, error: new Error("Not authenticated") };

  // Pull default visibility from profile if caller didn't supply it
  let visibilityToUse: Visibility = input.visibility ?? "public";

  if (!input.visibility) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("default_visibility")
      .eq("id", user.id)
      .maybeSingle();

    if (!profileError && profile?.default_visibility) {
      visibilityToUse = profile.default_visibility as Visibility;
    }
  }

  const { data: log, error: logError } = await supabase
    .from("anime_episode_logs")
    .insert({
      user_id: user.id,

      anime_id: input.anime_id,
      anime_episode_id: input.anime_episode_id,

      logged_at: input.logged_at ?? new Date().toISOString(),
      rating: input.rating ?? null,
      is_rewatch: input.is_rewatch ?? false,

      note: input.note ?? null,
      contains_spoilers: input.contains_spoilers ?? false,
      visibility: visibilityToUse,
    })
    .select("*")
    .single();

  if (logError || !log) return { data: null, error: logError };

  // NOTE: no "posts" insert here.
  // Your DB trigger auto-creates the activity feed item.

  return { data: log as AnimeEpisodeLogRow, error: null };
}

// ------------------------------------------------------------
// ANIME: Episode Log (My count)
// ------------------------------------------------------------
export async function getMyAnimeEpisodeLogCount(
  anime_episode_id: string
): Promise<{ count: number; error: any }> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) return { count: 0, error: userError };
  if (!user) return { count: 0, error: new Error("Not authenticated") };

  const { count, error } = await supabase
    .from("anime_episode_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("anime_episode_id", anime_episode_id);

  if (error) return { count: 0, error };

  return { count: count ?? 0, error: null };
}

/* ============================================================
   ANIME: Series Log (new)
============================================================ */

export type AnimeSeriesLogRow = {
  id: string;
  user_id: string;

  anime_id: string;

  logged_at: string;
  rating: number | null;
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
  is_rewatch?: boolean;

  note?: string | null;
  contains_spoilers?: boolean;

  visibility?: Visibility;
};

export async function createAnimeSeriesLog(
  input: CreateAnimeSeriesLogInput
): Promise<{ data: AnimeSeriesLogRow | null; error: any }> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) return { data: null, error: userError };
  if (!user) return { data: null, error: new Error("Not authenticated") };

  let visibilityToUse: Visibility = input.visibility ?? "public";

  if (!input.visibility) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("default_visibility")
      .eq("id", user.id)
      .maybeSingle();

    if (!profileError && profile?.default_visibility) {
      visibilityToUse = profile.default_visibility as Visibility;
    }
  }

  const { data: log, error: logError } = await supabase
    .from("anime_series_logs")
    .insert({
      user_id: user.id,
      anime_id: input.anime_id,

      logged_at: input.logged_at ?? new Date().toISOString(),
      rating: input.rating ?? null,
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
   MANGA: Series Log (new)
============================================================ */

export type MangaSeriesLogRow = {
  id: string;
  user_id: string;

  manga_id: string;

  logged_at: string;
  rating: number | null;
  is_rewatch: boolean;

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
  is_rewatch?: boolean;

  note?: string | null;
  contains_spoilers?: boolean;

  visibility?: Visibility;
};

export async function createMangaSeriesLog(
  input: CreateMangaSeriesLogInput
): Promise<{ data: MangaSeriesLogRow | null; error: any }> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) return { data: null, error: userError };
  if (!user) return { data: null, error: new Error("Not authenticated") };

  let visibilityToUse: Visibility = input.visibility ?? "public";

  if (!input.visibility) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("default_visibility")
      .eq("id", user.id)
      .maybeSingle();

    if (!profileError && profile?.default_visibility) {
      visibilityToUse = profile.default_visibility as Visibility;
    }
  }

  const { data: log, error: logError } = await supabase
    .from("manga_series_logs")
    .insert({
      user_id: user.id,
      manga_id: input.manga_id,

      logged_at: input.logged_at ?? new Date().toISOString(),
      rating: input.rating ?? null,
      is_reread: input.is_rewatch ?? false,

      note: input.note ?? null,
      contains_spoilers: input.contains_spoilers ?? false,
      visibility: visibilityToUse,
    })
    .select("*")
    .single();

  if (logError || !log) return { data: null, error: logError };
  return { data: log as MangaSeriesLogRow, error: null };
}

/* ============================================================
   MANGA: Chapter Log (new)
============================================================ */

export type MangaChapterLogRow = {
  id: string;
  user_id: string;

  manga_id: string;
  manga_chapter_id: string;

  logged_at: string;
  rating: number | null;
  is_rewatch: boolean;

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
  is_rewatch?: boolean;

  note?: string | null;
  contains_spoilers?: boolean;

  visibility?: Visibility;
};

export async function createMangaChapterLog(
  input: CreateMangaChapterLogInput
): Promise<{ data: MangaChapterLogRow | null; error: any }> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) return { data: null, error: userError };
  if (!user) return { data: null, error: new Error("Not authenticated") };

  let visibilityToUse: Visibility = input.visibility ?? "public";

  if (!input.visibility) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("default_visibility")
      .eq("id", user.id)
      .maybeSingle();

    if (!profileError && profile?.default_visibility) {
      visibilityToUse = profile.default_visibility as Visibility;
    }
  }

  const { data: log, error: logError } = await supabase
    .from("manga_chapter_logs")
    .insert({
      user_id: user.id,

      manga_id: input.manga_id,
      manga_chapter_id: input.manga_chapter_id,

      logged_at: input.logged_at ?? new Date().toISOString(),
      rating: input.rating ?? null,
      is_reread: input.is_rewatch ?? false,

      note: input.note ?? null,
      contains_spoilers: input.contains_spoilers ?? false,
      visibility: visibilityToUse,
    })
    .select("*")
    .single();

  if (logError || !log) return { data: null, error: logError };
  return { data: log as MangaChapterLogRow, error: null };
}

export async function getMyMangaChapterLogCount(
  manga_chapter_id: string
): Promise<{ count: number; error: any }> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) return { count: 0, error: userError };
  if (!user) return { count: 0, error: new Error("Not authenticated") };

  const { count, error } = await supabase
    .from("manga_chapter_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("manga_chapter_id", manga_chapter_id);

  if (error) return { count: 0, error };
  return { count: count ?? 0, error: null };
}
