// lib/reviews.ts
import { supabase } from "@/lib/supabaseClient";

export type UpsertAnimeSeriesReviewInput = {
  anime_id: string;
  rating: number; // 0–100
  content: string;
  contains_spoilers?: boolean;
};

export async function upsertAnimeSeriesReview(
  input: UpsertAnimeSeriesReviewInput
) {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return { data: null, error: new Error("Not authenticated") };
  }

  // 1) Do I already have a SERIES review for this anime?
  //    (anime_episode_id must be NULL for series reviews)
  const { data: existing, error: findError } = await supabase
    .from("reviews")
    .select("id")
    .eq("user_id", user.id)
    .eq("anime_id", input.anime_id)
    .is("anime_episode_id", null)
    .maybeSingle();

  if (findError) return { data: null, error: findError };

  const payload = {
    user_id: user.id,
    anime_id: input.anime_id,
    anime_episode_id: null as null,
    rating: input.rating,
    content: input.content,
    contains_spoilers: !!input.contains_spoilers,
  };

  // 2) Update if exists, else insert
  if (existing?.id) {
    const { data, error } = await supabase
      .from("reviews")
      .update({
        rating: payload.rating,
        content: payload.content,
        contains_spoilers: payload.contains_spoilers,
      })
      .eq("id", existing.id)
      .select(
        "id, user_id, anime_id, anime_episode_id, rating, content, contains_spoilers, created_at, updated_at"
      )
      .single();

    if (error) return { data: null, error };
    return { data, error: null };
  } else {
    const { data, error } = await supabase
      .from("reviews")
      .insert(payload)
      .select(
        "id, user_id, anime_id, anime_episode_id, rating, content, contains_spoilers, created_at, updated_at"
      )
      .single();

    if (error) return { data: null, error };
    return { data, error: null };
  }
}
