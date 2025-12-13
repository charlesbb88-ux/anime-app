// lib/manga.ts

import { supabase } from "@/lib/supabaseClient";
import type { PostgrestError } from "@supabase/supabase-js";
import type { Manga, MangaChapter } from "./types";

type SupabaseResult<T> = {
  data: T | null;
  error: PostgrestError | null;
};

type SupabaseListResult<T> = {
  data: T[];
  error: PostgrestError | null;
};

// ========================================
// Manga catalog helpers
// ========================================

export async function getMangaById(
  id: string
): Promise<SupabaseResult<Manga>> {
  const { data, error } = await supabase
    .from("manga")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  return { data: data as Manga | null, error };
}

export async function getMangaBySlug(
  slug: string
): Promise<SupabaseResult<Manga>> {
  const { data, error } = await supabase
    .from("manga")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  return { data: data as Manga | null, error };
}

export type ListMangaOptions = {
  searchTitle?: string;
  limit?: number;
};

export async function listManga(
  options: ListMangaOptions = {}
): Promise<SupabaseListResult<Manga>> {
  const { searchTitle, limit } = options;

  let query = supabase
    .from("manga")
    .select("*")
    .order("created_at", { ascending: false });

  if (searchTitle && searchTitle.trim().length > 0) {
    query = query.ilike("title", `%${searchTitle.trim()}%`);
  }

  if (typeof limit === "number" && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  return { data: (data as Manga[]) || [], error };
}

// ========================================
// Chapter helpers
// ========================================

export async function getMangaChapter(
  mangaId: string,
  chapterNumber: number
): Promise<SupabaseResult<MangaChapter>> {
  const { data, error } = await supabase
    .from("manga_chapters")
    .select("*")
    .eq("manga_id", mangaId)
    .eq("chapter_number", chapterNumber)
    .maybeSingle();

  return { data: data as MangaChapter | null, error };
}

// List all chapters for a given manga, ordered by chapter_number ascending
export async function listMangaChaptersForManga(
  mangaId: string
): Promise<SupabaseListResult<MangaChapter>> {
  const { data, error } = await supabase
    .from("manga_chapters")
    .select("*")
    .eq("manga_id", mangaId)
    .order("chapter_number", { ascending: true });

  return { data: (data as MangaChapter[]) || [], error };
}
