import { supabase } from "@/lib/supabaseClient";

export type ProgressBucket = {
  bucket: string; // "all" | "100" | "90-99" | ...
  anime_count: number;
  manga_count: number;
  total_count: number;
};

export async function fetchCompletionBucketCounts(params: {
  userId: string;
  kind: "all" | "anime" | "manga";
  search: string;
}) {
  const { data, error } = await supabase.rpc("get_user_completion_progress_bucket_counts", {
    p_user_id: params.userId,
    p_kind: params.kind,
    p_search: params.search,
  });

  if (error) throw error;
  return (data ?? []) as ProgressBucket[];
}

export type CompletionItem = {
  kind: "anime" | "manga";
  id: string;
  title: string;
  image_url: string | null;
  slug: string | null;
  last_logged_at: string | null;

  progress_current: number;
  progress_total: number;
  progress_pct: number;

  reviewed_count: number;
  rated_count: number;
};

export type CompletionSort = "last_logged" | "pct_desc" | "pct_asc";
export type CompletionKind = "all" | "anime" | "manga";

export type CompletionCursor = {
  last_logged_at: string | null;
  kind: "anime" | "manga";
  id: string;
  pct: number; // IMPORTANT: needed for pct sort pagination
};

export async function fetchUserCompletions(args: {
  userId: string;
  limit?: number;
  cursor: CompletionCursor | null;

  // progress range filter (server-side)
  minPct?: number | null;
  maxPct?: number | null;

  // new server-side filters/sort
  kind?: CompletionKind;
  sort?: CompletionSort;
}) {
  const {
    userId,
    limit = 60,
    cursor,
    minPct = null,
    maxPct = null,
    kind = "all",
    sort = "last_logged",
  } = args;

  const { data, error } = await supabase.rpc("get_user_completions_with_stats", {
    p_user_id: userId,
    p_limit: limit,

    p_cursor_last_at: cursor?.last_logged_at ?? null,
    p_cursor_kind: cursor?.kind ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_cursor_pct: cursor?.pct ?? null,

    p_min_pct: minPct,
    p_max_pct: maxPct,

    p_kind: kind,
    p_sort: sort,
  });

  if (error) throw error;
  return (data ?? []) as CompletionItem[];
}
