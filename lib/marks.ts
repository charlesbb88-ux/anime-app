// lib/marks.ts
import { supabase } from "@/lib/supabaseClient";

/* ======================================================
   Helpers
====================================================== */

function isDuplicateKeyError(err: any) {
  // Postgres unique violation
  return Boolean(err && (err.code === "23505" || err?.details?.includes("duplicate key")));
}

/* ======================================================
   WATCHED (anime series)
====================================================== */

export async function getMyAnimeWatchedMark(anime_id: string) {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return { exists: false, error: userErr ?? new Error("Not authenticated.") };
  }

  const { data, error } = await supabase
    .from("user_marks")
    .select("id")
    .eq("user_id", user.id)
    .eq("kind", "watched")
    .eq("anime_id", anime_id)
    .is("anime_episode_id", null)
    .is("manga_id", null)
    .is("manga_chapter_id", null)
    .maybeSingle();

  if (error) return { exists: false, error };
  return { exists: Boolean(data?.id), error: null };
}

export async function setMyAnimeWatchedMark(anime_id: string, watched: boolean) {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return { error: userErr ?? new Error("Not authenticated.") };
  }

  if (watched) {
    const { error } = await supabase.from("user_marks").insert({
      user_id: user.id,
      kind: "watched",
      anime_id,
    });

    // ✅ Make "set watched" idempotent (safe to call even if it already exists)
    if (error && isDuplicateKeyError(error)) return { error: null };

    return { error };
  }

  const { error } = await supabase
    .from("user_marks")
    .delete()
    .eq("user_id", user.id)
    .eq("kind", "watched")
    .eq("anime_id", anime_id)
    .is("anime_episode_id", null)
    .is("manga_id", null)
    .is("manga_chapter_id", null);

  return { error };
}

/* ======================================================
   LIKED (anime series)
====================================================== */

export async function getMyAnimeLikedMark(anime_id: string) {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return { exists: false, error: userErr ?? new Error("Not authenticated.") };
  }

  const { data, error } = await supabase
    .from("user_marks")
    .select("id")
    .eq("user_id", user.id)
    .eq("kind", "liked")
    .eq("anime_id", anime_id)
    .is("anime_episode_id", null)
    .is("manga_id", null)
    .is("manga_chapter_id", null)
    .maybeSingle();

  if (error) return { exists: false, error };
  return { exists: Boolean(data?.id), error: null };
}

export async function setMyAnimeLikedMark(anime_id: string, liked: boolean) {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return { error: userErr ?? new Error("Not authenticated.") };
  }

  if (liked) {
    const { error } = await supabase.from("user_marks").insert({
      user_id: user.id,
      kind: "liked",
      anime_id,
    });

    // ✅ idempotent
    if (error && isDuplicateKeyError(error)) return { error: null };

    return { error };
  }

  const { error } = await supabase
    .from("user_marks")
    .delete()
    .eq("user_id", user.id)
    .eq("kind", "liked")
    .eq("anime_id", anime_id)
    .is("anime_episode_id", null)
    .is("manga_id", null)
    .is("manga_chapter_id", null);

  return { error };
}

/* ======================================================
   WATCHLIST (anime series)
====================================================== */

export async function getMyAnimeWatchlistMark(anime_id: string) {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return { exists: false, error: userErr ?? new Error("Not authenticated.") };
  }

  const { data, error } = await supabase
    .from("user_marks")
    .select("id")
    .eq("user_id", user.id)
    .eq("kind", "watchlist")
    .eq("anime_id", anime_id)
    .is("anime_episode_id", null)
    .is("manga_id", null)
    .is("manga_chapter_id", null)
    .maybeSingle();

  if (error) return { exists: false, error };
  return { exists: Boolean(data?.id), error: null };
}

export async function setMyAnimeWatchlistMark(
  anime_id: string,
  in_watchlist: boolean
) {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return { error: userErr ?? new Error("Not authenticated.") };
  }

  if (in_watchlist) {
    const { error } = await supabase.from("user_marks").insert({
      user_id: user.id,
      kind: "watchlist",
      anime_id,
    });

    // ✅ idempotent
    if (error && isDuplicateKeyError(error)) return { error: null };

    return { error };
  }

  const { error } = await supabase
    .from("user_marks")
    .delete()
    .eq("user_id", user.id)
    .eq("kind", "watchlist")
    .eq("anime_id", anime_id)
    .is("anime_episode_id", null)
    .is("manga_id", null)
    .is("manga_chapter_id", null);

  return { error };
}

/* ======================================================
   RATING (anime series)  ⭐ HALF-STARS stored as 1..10
   1 = 0.5★, 2 = 1.0★, ... 10 = 5.0★
====================================================== */

export async function getMyAnimeRatingMark(anime_id: string) {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return {
      exists: false,
      halfStars: null as number | null,
      error: userErr ?? new Error("Not authenticated."),
    };
  }

  const { data, error } = await supabase
    .from("user_marks")
    .select("id, stars")
    .eq("user_id", user.id)
    .eq("kind", "rating")
    .eq("anime_id", anime_id)
    .is("anime_episode_id", null)
    .is("manga_id", null)
    .is("manga_chapter_id", null)
    .maybeSingle();

  if (error) return { exists: false, halfStars: null as number | null, error };

  return {
    exists: Boolean(data?.id),
    halfStars: (data?.stars ?? null) as number | null, // 1..10
    error: null,
  };
}

// halfStars: number|null (null deletes rating). Expected 1..10.
export async function setMyAnimeRatingMark(
  anime_id: string,
  halfStars: number | null
) {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return { error: userErr ?? new Error("Not authenticated.") };
  }

  // delete existing first (simple + updates created_at on re-insert)
  const del = await supabase
    .from("user_marks")
    .delete()
    .eq("user_id", user.id)
    .eq("kind", "rating")
    .eq("anime_id", anime_id)
    .is("anime_episode_id", null)
    .is("manga_id", null)
    .is("manga_chapter_id", null);

  if (del.error) return { error: del.error };

  if (halfStars == null) return { error: null };

  const clamped = Math.max(1, Math.min(10, Math.round(halfStars)));

  const { error } = await supabase.from("user_marks").insert({
    user_id: user.id,
    kind: "rating",
    anime_id,
    stars: clamped, // 1..10 half-stars
  });

  return { error };
}
