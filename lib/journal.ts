// lib/journal.ts
"use client";

import { supabase } from "@/lib/supabaseClient";

export type JournalKind =
  | "anime_series"
  | "anime_episode"
  | "manga_series"
  | "manga_chapter";

export type JournalEntryRow = {
  kind: JournalKind;
  log_id: string;
  user_id: string;

  logged_at: string; // timestamptz
  created_at: string; // timestamptz
  updated_at: string | null; // timestamptz | null

  visibility: "public" | "friends" | "private";
  contains_spoilers: boolean;

  note: string | null;
  rating: number | null; // numeric in DB => number here
  liked: boolean | null;
  review_id: string | null;

  is_repeat: boolean | null;

  anime_id: string | null;
  anime_episode_id: string | null;
  manga_id: string | null;
  manga_chapter_id: string | null;

  /* ---------------------- hydrated display columns ---------------------- */
  media_title: string | null;
  entry_label: string | null;
  media_year: number | null;
  poster_url: string | null;
  media_slug: string | null;
  review_post_id: string | null;
};

export async function listJournalEntriesByUserId(
  userId: string,
  opts?: { limit?: number; beforeLoggedAt?: string | null }
) {
  const limit = opts?.limit ?? 50;
  const beforeLoggedAt = opts?.beforeLoggedAt ?? null;

  let q = supabase
    .from("user_journal_items")
    .select("*")
    .eq("user_id", userId)
    .order("logged_at", { ascending: false })
    .limit(limit);

  if (beforeLoggedAt) q = q.lt("logged_at", beforeLoggedAt);

  const { data, error } = await q;

  return { rows: (data ?? []) as JournalEntryRow[], error };
}

function kindToLogTable(kind: JournalKind) {
  switch (kind) {
    case "anime_series":
      return "anime_series_logs";
    case "anime_episode":
      return "anime_episode_logs";
    case "manga_series":
      return "manga_series_logs";
    case "manga_chapter":
      return "manga_chapter_logs";
    default:
      return null as never;
  }
}

export async function updateLogRating(args: {
  kind: JournalKind;
  logId: string;
  rating: number | null; // 0..100 (or null)
}) {
  const table = kindToLogTable(args.kind);

  const { error } = await supabase
    .from(table)
    .update({ rating: args.rating })
    .eq("id", args.logId);

  return { error };
}

export async function toggleLogLiked(args: {
  kind: JournalKind;
  logId: string;
  liked: boolean;
}) {
  const table = kindToLogTable(args.kind);

  const { error } = await supabase
    .from(table)
    .update({ liked: args.liked })
    .eq("id", args.logId);

  return { error };
}

export async function setLogReviewId(args: {
  kind: JournalKind;
  logId: string;
  reviewId: string | null;
}) {
  const table = kindToLogTable(args.kind);

  const { error } = await supabase
    .from(table)
    .update({ review_id: args.reviewId })
    .eq("id", args.logId);

  return { error };
}

export async function fetchReviewById(reviewId: string) {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("id", reviewId)
    .maybeSingle();

  return { review: data ?? null, error };
}

export async function upsertReviewForLog(args: {
  // log targeting
  kind: JournalKind;
  anime_id: string | null;
  anime_episode_id: string | null;
  manga_id: string | null;
  manga_chapter_id: string | null;

  // if present, update
  review_id: string | null;

  // content
  rating: number | null; // 0..100
  content: string;
  contains_spoilers: boolean;
  visibility: "public" | "friends" | "private";
  author_liked: boolean;
}) {
  // Create or update review row.
  // NOTE: reviews.content is NOT NULL in your schema, so content must be non-empty.
  if (!args.content.trim()) {
    return {
      reviewId: null as string | null,
      error: new Error("Review text cannot be empty."),
    };
  }

  if (args.review_id) {
    const { error } = await supabase
      .from("reviews")
      .update({
        rating: args.rating,
        content: args.content.trim(),
        contains_spoilers: args.contains_spoilers,
        visibility: args.visibility,
        author_liked: args.author_liked,
      })
      .eq("id", args.review_id);

    return { reviewId: args.review_id, error };
  }

  const { data, error } = await supabase
    .from("reviews")
    .insert({
      anime_id: args.anime_id,
      anime_episode_id: args.anime_episode_id,
      manga_id: args.manga_id,
      manga_chapter_id: args.manga_chapter_id,

      rating: args.rating,
      content: args.content.trim(),
      contains_spoilers: args.contains_spoilers,
      visibility: args.visibility,
      author_liked: args.author_liked,
    })
    .select("id")
    .maybeSingle();

  return { reviewId: data?.id ?? null, error };
}
