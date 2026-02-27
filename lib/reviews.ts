// lib/reviews.ts
"use client";

import { supabase } from "@/lib/supabaseClient";
import { insertAttachments, type PendingAttachment } from "@/lib/postAttachments";

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

export type CreateReviewResult = {
  review: ReviewRow;
  postId: string;
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
  input: CreateAnimeSeriesReviewInput & {
    attachments?: PendingAttachment[];
  }
): Promise<{ data: CreateReviewResult | null; error: any }> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) return { data: null, error: userError };
  if (!user) return { data: null, error: new Error("Not authenticated") };

  // 1) create review
  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .insert({
      user_id: user.id,

      anime_id: input.anime_id,
      anime_episode_id: null,

      manga_id: null,
      manga_chapter_id: null,

      rating: input.rating,
      content: input.content,
      contains_spoilers: input.contains_spoilers ?? false,
      author_liked: input.author_liked ?? false,
    })
    .select("*")
    .single();

  if (reviewError || !review) return { data: null, error: reviewError };

  // 2) create post AND RETURN ITS ID
  const { data: post, error: postError } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,

      anime_id: input.anime_id,
      anime_episode_id: null,

      manga_id: null,
      manga_chapter_id: null,

      content: input.content,
      review_id: review.id,
    })
    .select("id")
    .single();

  if (postError || !post?.id) {
    await supabase.from("reviews").delete().eq("id", review.id);
    return { data: null, error: postError ?? new Error("Failed to create post") };
  }

  // 3) optional attachments -> post_attachments
  try {
    if (input.attachments?.length) {
      await insertAttachments({
        supabase,
        postId: post.id,
        userId: user.id,
        attachments: input.attachments,
      });
    }
  } catch (e: any) {
    await supabase.from("posts").delete().eq("id", post.id);
    await supabase.from("reviews").delete().eq("id", review.id);
    return { data: null, error: e };
  }

  return { data: { review: review as ReviewRow, postId: post.id }, error: null };
}
// ------------------------------------------------------------
// ANIME: Episode Review
// ------------------------------------------------------------
export async function createAnimeEpisodeReview(
  input: CreateAnimeEpisodeReviewInput & {
    attachments?: PendingAttachment[];
  }
): Promise<{ data: CreateReviewResult | null; error: any }> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) return { data: null, error: userError };
  if (!user) return { data: null, error: new Error("Not authenticated") };

  // 1) create review
  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .insert({
      user_id: user.id,

      anime_id: input.anime_id,
      anime_episode_id: input.anime_episode_id,

      manga_id: null,
      manga_chapter_id: null,

      rating: input.rating,
      content: input.content,
      contains_spoilers: input.contains_spoilers ?? false,
      author_liked: input.author_liked ?? false,
    })
    .select("*")
    .single();

  if (reviewError || !review) return { data: null, error: reviewError };

  // 2) create post AND RETURN ITS ID
  const { data: post, error: postError } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,

      anime_id: input.anime_id,
      anime_episode_id: input.anime_episode_id,

      manga_id: null,
      manga_chapter_id: null,

      content: input.content,
      review_id: review.id,
    })
    .select("id")
    .single();

  if (postError || !post?.id) {
    // rollback review if post failed
    await supabase.from("reviews").delete().eq("id", review.id);
    return { data: null, error: postError ?? new Error("Failed to create post") };
  }

  // 3) optional attachments -> post_attachments
  try {
    if (input.attachments?.length) {
      await insertAttachments({
        supabase,
        postId: post.id,
        userId: user.id,
        attachments: input.attachments,
      });
    }
  } catch (e: any) {
    // rollback if attachments failed
    await supabase.from("posts").delete().eq("id", post.id);
    await supabase.from("reviews").delete().eq("id", review.id);
    return { data: null, error: e };
  }

  return { data: { review: review as ReviewRow, postId: post.id }, error: null };
}

// ------------------------------------------------------------
// MANGA: Series Review
// ------------------------------------------------------------
export async function createMangaSeriesReview(
  input: CreateMangaSeriesReviewInput & {
    attachments?: PendingAttachment[];
  }
): Promise<{ data: CreateReviewResult | null; error: any }> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) return { data: null, error: userError };
  if (!user) return { data: null, error: new Error("Not authenticated") };

  // 1) create review
  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .insert({
      user_id: user.id,

      manga_id: input.manga_id,
      manga_chapter_id: null,

      anime_id: null,
      anime_episode_id: null,

      rating: input.rating,
      content: input.content,
      contains_spoilers: input.contains_spoilers ?? false,
      author_liked: input.author_liked ?? false,
    })
    .select("*")
    .single();

  if (reviewError || !review) return { data: null, error: reviewError };

  // 2) create post AND RETURN ITS ID
  const { data: post, error: postError } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,

      manga_id: input.manga_id,
      manga_chapter_id: null,

      anime_id: null,
      anime_episode_id: null,

      content: input.content,
      review_id: review.id,
    })
    .select("id")
    .single();

  if (postError || !post?.id) {
    await supabase.from("reviews").delete().eq("id", review.id);
    return { data: null, error: postError ?? new Error("Failed to create post") };
  }

  // 3) optional attachments -> post_attachments
  try {
    if (input.attachments?.length) {
      await insertAttachments({
        supabase,
        postId: post.id,
        userId: user.id,
        attachments: input.attachments,
      });
    }
  } catch (e: any) {
    await supabase.from("posts").delete().eq("id", post.id);
    await supabase.from("reviews").delete().eq("id", review.id);
    return { data: null, error: e };
  }

  return { data: { review: review as ReviewRow, postId: post.id }, error: null };
}
// ------------------------------------------------------------
// MANGA: Chapter Review
// ------------------------------------------------------------
export async function createMangaChapterReview(
  input: CreateMangaChapterReviewInput & {
    attachments?: PendingAttachment[];
  }
): Promise<{ data: CreateReviewResult | null; error: any }> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) return { data: null, error: userError };
  if (!user) return { data: null, error: new Error("Not authenticated") };

  // 1) create review
  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .insert({
      user_id: user.id,

      manga_id: input.manga_id,
      manga_chapter_id: input.manga_chapter_id,

      anime_id: null,
      anime_episode_id: null,

      rating: input.rating,
      content: input.content,
      contains_spoilers: input.contains_spoilers ?? false,
      author_liked: input.author_liked ?? false,
    })
    .select("*")
    .single();

  if (reviewError || !review) return { data: null, error: reviewError };

  // 2) create post AND RETURN ITS ID
  const { data: post, error: postError } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,

      manga_id: input.manga_id,
      manga_chapter_id: input.manga_chapter_id,

      anime_id: null,
      anime_episode_id: null,

      content: input.content,
      review_id: review.id,
    })
    .select("id")
    .single();

  if (postError || !post?.id) {
    await supabase.from("reviews").delete().eq("id", review.id);
    return { data: null, error: postError ?? new Error("Failed to create post") };
  }

  // 3) optional attachments -> post_attachments
  try {
    if (input.attachments?.length) {
      await insertAttachments({
        supabase,
        postId: post.id,
        userId: user.id,
        attachments: input.attachments,
      });
    }
  } catch (e: any) {
    await supabase.from("posts").delete().eq("id", post.id);
    await supabase.from("reviews").delete().eq("id", review.id);
    return { data: null, error: e };
  }

  return { data: { review: review as ReviewRow, postId: post.id }, error: null };
}