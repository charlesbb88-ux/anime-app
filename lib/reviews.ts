// lib/reviews.ts
"use client";

import { supabase } from "@/lib/supabaseClient";

export type ReviewRow = {
  id: string;
  user_id: string;

  anime_id: string | null;
  anime_episode_id: string | null;

  // ✅ manga support
  manga_id: string | null;
  manga_chapter_id: string | null;

  rating: number | null;
  content: string | null;
  contains_spoilers: boolean | null;

  // ✅ NEW: heart snapshot from modal
  author_liked: boolean | null;

  created_at: string;
  updated_at: string | null;
};

export type CreateAnimeSeriesReviewInput = {
  anime_id: string;
  rating: number | null;
  content: string;
  contains_spoilers?: boolean;

  // ✅ NEW
  author_liked?: boolean;
};

export type CreateAnimeEpisodeReviewInput = {
  anime_id: string;
  anime_episode_id: string; // ✅ required for episode reviews
  rating: number | null;
  content: string;
  contains_spoilers?: boolean;

  // ✅ NEW
  author_liked?: boolean;
};

// ✅ Manga series review
export type CreateMangaSeriesReviewInput = {
  manga_id: string;
  rating: number | null;
  content: string;
  contains_spoilers?: boolean;

  // ✅ NEW
  author_liked?: boolean;
};

// ✅ Manga chapter review
export type CreateMangaChapterReviewInput = {
  manga_id: string;
  manga_chapter_id: string; // ✅ required for chapter reviews
  rating: number | null;
  content: string;
  contains_spoilers?: boolean;

  // ✅ NEW
  author_liked?: boolean;
};

// ------------------------------------------------------------
// ANIME: Series Review
// ------------------------------------------------------------
export async function createAnimeSeriesReview(
  input: CreateAnimeSeriesReviewInput
): Promise<{ data: ReviewRow | null; error: any }> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) return { data: null, error: userError };
  if (!user) return { data: null, error: new Error("Not authenticated") };

  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .insert({
      user_id: user.id,

      anime_id: input.anime_id,
      anime_episode_id: null,

      // ✅ keep manga fields null for anime reviews
      manga_id: null,
      manga_chapter_id: null,

      rating: input.rating,
      content: input.content,
      contains_spoilers: input.contains_spoilers ?? false,

      // ✅ NEW
      author_liked: input.author_liked ?? false,
    })
    .select("*")
    .single();

  if (reviewError || !review) return { data: null, error: reviewError };

  const { error: postError } = await supabase.from("posts").insert({
    user_id: user.id,
    anime_id: input.anime_id,
    anime_episode_id: null,

    // ✅ keep manga fields null for anime posts
    manga_id: null,
    manga_chapter_id: null,

    content: input.content,
    review_id: review.id,
  });

  if (postError) return { data: null, error: postError };

  return { data: review as ReviewRow, error: null };
}

// ------------------------------------------------------------
// ANIME: Episode Review
// ------------------------------------------------------------
export async function createAnimeEpisodeReview(
  input: CreateAnimeEpisodeReviewInput
): Promise<{ data: ReviewRow | null; error: any }> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) return { data: null, error: userError };
  if (!user) return { data: null, error: new Error("Not authenticated") };

  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .insert({
      user_id: user.id,

      anime_id: input.anime_id,
      anime_episode_id: input.anime_episode_id,

      // ✅ keep manga fields null for anime reviews
      manga_id: null,
      manga_chapter_id: null,

      rating: input.rating,
      content: input.content,
      contains_spoilers: input.contains_spoilers ?? false,

      // ✅ NEW
      author_liked: input.author_liked ?? false,
    })
    .select("*")
    .single();

  if (reviewError || !review) return { data: null, error: reviewError };

  const { error: postError } = await supabase.from("posts").insert({
    user_id: user.id,

    anime_id: input.anime_id,
    anime_episode_id: input.anime_episode_id,

    // ✅ keep manga fields null for anime posts
    manga_id: null,
    manga_chapter_id: null,

    content: input.content,
    review_id: review.id,
  });

  if (postError) return { data: null, error: postError };

  return { data: review as ReviewRow, error: null };
}

// ------------------------------------------------------------
// MANGA: Series Review
// ------------------------------------------------------------
export async function createMangaSeriesReview(
  input: CreateMangaSeriesReviewInput
): Promise<{ data: ReviewRow | null; error: any }> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) return { data: null, error: userError };
  if (!user) return { data: null, error: new Error("Not authenticated") };

  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .insert({
      user_id: user.id,

      // ✅ manga fields
      manga_id: input.manga_id,
      manga_chapter_id: null,

      // ✅ keep anime fields null for manga reviews
      anime_id: null,
      anime_episode_id: null,

      rating: input.rating,
      content: input.content,
      contains_spoilers: input.contains_spoilers ?? false,

      // ✅ NEW
      author_liked: input.author_liked ?? false,
    })
    .select("*")
    .single();

  if (reviewError || !review) return { data: null, error: reviewError };

  const { error: postError } = await supabase.from("posts").insert({
    user_id: user.id,

    // ✅ manga context for feeds
    manga_id: input.manga_id,
    manga_chapter_id: null,

    // ✅ keep anime fields null for manga posts
    anime_id: null,
    anime_episode_id: null,

    content: input.content,
    review_id: review.id,
  });

  if (postError) return { data: null, error: postError };

  return { data: review as ReviewRow, error: null };
}

// ------------------------------------------------------------
// MANGA: Chapter Review
// ------------------------------------------------------------
export async function createMangaChapterReview(
  input: CreateMangaChapterReviewInput
): Promise<{ data: ReviewRow | null; error: any }> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) return { data: null, error: userError };
  if (!user) return { data: null, error: new Error("Not authenticated") };

  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .insert({
      user_id: user.id,

      manga_id: input.manga_id,
      manga_chapter_id: input.manga_chapter_id,

      // ✅ keep anime fields null for manga reviews
      anime_id: null,
      anime_episode_id: null,

      rating: input.rating,
      content: input.content,
      contains_spoilers: input.contains_spoilers ?? false,

      // ✅ NEW
      author_liked: input.author_liked ?? false,
    })
    .select("*")
    .single();

  if (reviewError || !review) return { data: null, error: reviewError };

  const { error: postError } = await supabase.from("posts").insert({
    user_id: user.id,

    manga_id: input.manga_id,
    manga_chapter_id: input.manga_chapter_id,

    // ✅ keep anime fields null for manga posts
    anime_id: null,
    anime_episode_id: null,

    content: input.content,
    review_id: review.id,
  });

  if (postError) return { data: null, error: postError };

  return { data: review as ReviewRow, error: null };
}
