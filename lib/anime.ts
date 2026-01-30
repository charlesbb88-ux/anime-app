// lib/anime.ts

import { supabase } from "@/lib/supabaseClient";
import type { PostgrestError } from "@supabase/supabase-js";
import type {
  Anime,
  AnimeEpisode,
  UserAnimeProgress,
  UserAnimeProgressWithAnime,
  UpsertUserAnimeProgressParams,
} from "./types";

type SupabaseResult<T> = {
  data: T | null;
  error: PostgrestError | null;
};

type SupabaseListResult<T> = {
  data: T[];
  error: PostgrestError | null;
};

function cleanSearch(s?: string | null): string {
  return (s || "").trim();
}

function buildAnimeSearchOr(raw: string): string {
  // Search title OR english OR preferred OR native OR slug
  // NOTE: PostgREST "or" string uses commas as separators. Avoid commas in search if you can.
  const q = raw;
  return [
    `title.ilike.%${q}%`,
    `title_english.ilike.%${q}%`,
    `title_preferred.ilike.%${q}%`,
    `title_native.ilike.%${q}%`,
    `slug.ilike.%${q}%`,
  ].join(",");
}

// ========================================
// Anime catalog helpers
// ========================================

export async function getAnimeById(id: string): Promise<SupabaseResult<Anime>> {
  const { data, error } = await supabase
    .from("anime")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  return { data: (data as Anime | null) ?? null, error };
}

export async function getAnimeBySlug(
  slug: string
): Promise<SupabaseResult<Anime>> {
  const { data, error } = await supabase
    .from("anime")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  return { data: (data as Anime | null) ?? null, error };
}

export type ListAnimeOptions = {
  /**
   * Backwards compatible: old callers pass { searchTitle }.
   * Searches title (and also other title fields + slug, see below).
   */
  searchTitle?: string;

  /**
   * Preferred: new callers pass { search }.
   * Searches title/title_english/title_preferred/title_native/slug.
   */
  search?: string;

  /** Max rows to return (default: 200) */
  limit?: number;
};

export async function listAnime(
  options: ListAnimeOptions = {}
): Promise<SupabaseListResult<Anime>> {
  const { searchTitle, search, limit } = options;

  const raw = cleanSearch(search ?? searchTitle);

  let query = supabase
    .from("anime")
    .select("*")
    .order("created_at", { ascending: false });

  if (raw.length > 0) {
    query = query.or(buildAnimeSearchOr(raw));
  }

  const safeLimit =
    typeof limit === "number" && Number.isFinite(limit) && limit > 0
      ? Math.floor(limit)
      : 200;

  query = query.limit(safeLimit);

  const { data, error } = await query;
  return { data: (data as Anime[]) || [], error };
}

// ========================================
// Episode helpers
// ========================================

export async function getAnimeEpisode(
  animeId: string,
  episodeNumber: number
): Promise<SupabaseResult<AnimeEpisode>> {
  const { data, error } = await supabase
    .from("anime_episodes")
    .select("*")
    .eq("anime_id", animeId)
    .eq("episode_number", episodeNumber)
    .maybeSingle();

  return { data: (data as AnimeEpisode | null) ?? null, error };
}

// List all episodes for a given anime, ordered by episode_number ascending
export async function listAnimeEpisodesForAnime(
  animeId: string
): Promise<SupabaseListResult<AnimeEpisode>> {
  const { data, error } = await supabase
    .from("anime_episodes")
    .select("*")
    .eq("anime_id", animeId)
    .order("episode_number", { ascending: true });

  return { data: (data as AnimeEpisode[]) || [], error };
}

// ========================================
// User anime progress helpers
// ========================================

export async function getUserAnimeProgress(
  userId: string
): Promise<SupabaseListResult<UserAnimeProgressWithAnime>> {
  const { data, error } = await supabase
    .from("user_anime_progress")
    .select(
      `
      id,
      user_id,
      anime_id,
      episodes_watched,
      status,
      score,
      notes,
      updated_at,
      anime:anime_id (
        id,
        title,
        slug,
        total_episodes,
        image_url,
        banner_image_url,
        created_at
      )
    `
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error || !data) {
    return { data: [], error };
  }

  const mapped: UserAnimeProgressWithAnime[] = (data as any[]).map((row) => {
    const animeRelation = (row as any).anime;

    const anime: Anime | null = Array.isArray(animeRelation)
      ? animeRelation[0] ?? null
      : animeRelation ?? null;

    return {
      id: row.id,
      user_id: row.user_id,
      anime_id: row.anime_id,
      episodes_watched: row.episodes_watched,
      status: row.status,
      score: row.score,
      notes: row.notes,
      updated_at: row.updated_at,
      anime,
    };
  });

  return { data: mapped, error: null };
}

// ========================================
// Upsert (Insert or Update) progress
// ========================================

export async function upsertUserAnimeProgress(
  params: UpsertUserAnimeProgressParams
): Promise<SupabaseResult<UserAnimeProgress>> {
  const { userId, animeId, episodesWatched, status, score, notes } = params;

  const payload: Record<string, any> = {
    user_id: userId,
    anime_id: animeId,
    updated_at: new Date().toISOString(),
  };

  if (typeof episodesWatched === "number") {
    payload.episodes_watched = episodesWatched;
  }

  if (typeof status === "string") {
    payload.status = status;
  }

  if (typeof score === "number" || score === null) {
    payload.score = score;
  }

  if (typeof notes === "string" || notes === null) {
    payload.notes = notes;
  }

  const { data, error } = await supabase
    .from("user_anime_progress")
    .upsert(payload, { onConflict: "user_id,anime_id" })
    .select(
      `
      id,
      user_id,
      anime_id,
      episodes_watched,
      status,
      score,
      notes,
      updated_at
    `
    )
    .maybeSingle();

  return { data: (data as UserAnimeProgress | null) ?? null, error };
}
