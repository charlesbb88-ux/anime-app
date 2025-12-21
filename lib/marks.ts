// lib/marks.ts
"use client";

import { supabase } from "@/lib/supabaseClient";

/* ======================================================
   Helpers
====================================================== */

async function getAuthedUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, error: error ?? new Error("Not authenticated.") };
  }

  return { user, error: null };
}

function applyAnimeScope(
  q: any,
  anime_id: string,
  anime_episode_id?: string | null
) {
  q.eq("anime_id", anime_id);

  // ✅ series scope = episode_id null
  // ✅ episode scope = episode_id = provided id
  if (anime_episode_id) q.eq("anime_episode_id", anime_episode_id);
  else q.is("anime_episode_id", null);

  // keep these null so we never mix with manga
  q.is("manga_id", null).is("manga_chapter_id", null);

  return q;
}

function applyMangaScope(
  q: any,
  manga_id: string,
  manga_chapter_id?: string | null
) {
  q.eq("manga_id", manga_id);

  // ✅ series scope = chapter_id null
  // ✅ chapter scope = chapter_id = provided id
  if (manga_chapter_id) q.eq("manga_chapter_id", manga_chapter_id);
  else q.is("manga_chapter_id", null);

  // keep these null so we never mix with anime
  q.is("anime_id", null).is("anime_episode_id", null);

  return q;
}

/* ======================================================
   WATCHED (anime series OR episode)
====================================================== */

export async function getMyAnimeWatchedMark(
  anime_id: string,
  anime_episode_id?: string | null
) {
  const { user, error: userErr } = await getAuthedUser();
  if (userErr || !user) {
    return { exists: false, error: userErr ?? new Error("Not authenticated.") };
  }

  const q = supabase
    .from("user_marks")
    .select("id")
    .eq("user_id", user.id)
    .eq("kind", "watched");

  applyAnimeScope(q, anime_id, anime_episode_id);

  const { data, error } = await q.maybeSingle();

  if (error) return { exists: false, error };
  return { exists: Boolean(data?.id), error: null };
}

export async function setMyAnimeWatchedMark(
  anime_id: string,
  watched: boolean,
  anime_episode_id?: string | null
) {
  const { user, error: userErr } = await getAuthedUser();
  if (userErr || !user) {
    return { error: userErr ?? new Error("Not authenticated.") };
  }

  // delete existing mark in this SAME scope
  const delQ = supabase
    .from("user_marks")
    .delete()
    .eq("user_id", user.id)
    .eq("kind", "watched");

  applyAnimeScope(delQ, anime_id, anime_episode_id);

  const del = await delQ;
  if (del.error) return { error: del.error };

  if (!watched) return { error: null };

  const { error } = await supabase.from("user_marks").insert({
    user_id: user.id,
    kind: "watched",
    anime_id,
    anime_episode_id: anime_episode_id ?? null,
  });

  return { error };
}

export async function getMyMangaWatchedMark(
  manga_id: string,
  manga_chapter_id?: string | null
) {
  const { user, error: userErr } = await getAuthedUser();
  if (userErr || !user) {
    return { exists: false, error: userErr ?? new Error("Not authenticated.") };
  }

  const q = supabase
    .from("user_marks")
    .select("id")
    .eq("user_id", user.id)
    .eq("kind", "watched");

  applyMangaScope(q, manga_id, manga_chapter_id);

  const { data, error } = await q.maybeSingle();
  if (error) return { exists: false, error };
  return { exists: Boolean(data?.id), error: null };
}

export async function setMyMangaWatchedMark(
  manga_id: string,
  watched: boolean,
  manga_chapter_id?: string | null
) {
  const { user, error: userErr } = await getAuthedUser();
  if (userErr || !user) return { error: userErr ?? new Error("Not authenticated.") };

  const delQ = supabase
    .from("user_marks")
    .delete()
    .eq("user_id", user.id)
    .eq("kind", "watched");

  applyMangaScope(delQ, manga_id, manga_chapter_id);

  const del = await delQ;
  if (del.error) return { error: del.error };

  if (!watched) return { error: null };

  const { error } = await supabase.from("user_marks").insert({
    user_id: user.id,
    kind: "watched",
    manga_id,
    manga_chapter_id: manga_chapter_id ?? null,
  });

  return { error };
}

/* ======================================================
   LIKED (anime series OR episode)
====================================================== */

export async function getMyAnimeLikedMark(
  anime_id: string,
  anime_episode_id?: string | null
) {
  const { user, error: userErr } = await getAuthedUser();
  if (userErr || !user) {
    return { exists: false, error: userErr ?? new Error("Not authenticated.") };
  }

  const q = supabase
    .from("user_marks")
    .select("id")
    .eq("user_id", user.id)
    .eq("kind", "liked");

  applyAnimeScope(q, anime_id, anime_episode_id);

  const { data, error } = await q.maybeSingle();

  if (error) return { exists: false, error };
  return { exists: Boolean(data?.id), error: null };
}

export async function setMyAnimeLikedMark(
  anime_id: string,
  liked: boolean,
  anime_episode_id?: string | null
) {
  const { user, error: userErr } = await getAuthedUser();
  if (userErr || !user) {
    return { error: userErr ?? new Error("Not authenticated.") };
  }

  const delQ = supabase
    .from("user_marks")
    .delete()
    .eq("user_id", user.id)
    .eq("kind", "liked");

  applyAnimeScope(delQ, anime_id, anime_episode_id);

  const del = await delQ;
  if (del.error) return { error: del.error };

  if (!liked) return { error: null };

  const { error } = await supabase.from("user_marks").insert({
    user_id: user.id,
    kind: "liked",
    anime_id,
    anime_episode_id: anime_episode_id ?? null,
  });

  return { error };
}

export async function getMyMangaLikedMark(
  manga_id: string,
  manga_chapter_id?: string | null
) {
  const { user, error: userErr } = await getAuthedUser();
  if (userErr || !user) {
    return { exists: false, error: userErr ?? new Error("Not authenticated.") };
  }

  const q = supabase
    .from("user_marks")
    .select("id")
    .eq("user_id", user.id)
    .eq("kind", "liked");

  applyMangaScope(q, manga_id, manga_chapter_id);

  const { data, error } = await q.maybeSingle();
  if (error) return { exists: false, error };
  return { exists: Boolean(data?.id), error: null };
}

export async function setMyMangaLikedMark(
  manga_id: string,
  liked: boolean,
  manga_chapter_id?: string | null
) {
  const { user, error: userErr } = await getAuthedUser();
  if (userErr || !user) return { error: userErr ?? new Error("Not authenticated.") };

  const delQ = supabase
    .from("user_marks")
    .delete()
    .eq("user_id", user.id)
    .eq("kind", "liked");

  applyMangaScope(delQ, manga_id, manga_chapter_id);

  const del = await delQ;
  if (del.error) return { error: del.error };

  if (!liked) return { error: null };

  const { error } = await supabase.from("user_marks").insert({
    user_id: user.id,
    kind: "liked",
    manga_id,
    manga_chapter_id: manga_chapter_id ?? null,
  });

  return { error };
}

/* ======================================================
   WATCHLIST (anime series OR episode)
====================================================== */

export async function getMyAnimeWatchlistMark(
  anime_id: string,
  anime_episode_id?: string | null
) {
  const { user, error: userErr } = await getAuthedUser();
  if (userErr || !user) {
    return { exists: false, error: userErr ?? new Error("Not authenticated.") };
  }

  const q = supabase
    .from("user_marks")
    .select("id")
    .eq("user_id", user.id)
    .eq("kind", "watchlist");

  applyAnimeScope(q, anime_id, anime_episode_id);

  const { data, error } = await q.maybeSingle();

  if (error) return { exists: false, error };
  return { exists: Boolean(data?.id), error: null };
}

export async function setMyAnimeWatchlistMark(
  anime_id: string,
  in_watchlist: boolean,
  anime_episode_id?: string | null
) {
  const { user, error: userErr } = await getAuthedUser();
  if (userErr || !user) {
    return { error: userErr ?? new Error("Not authenticated.") };
  }

  const delQ = supabase
    .from("user_marks")
    .delete()
    .eq("user_id", user.id)
    .eq("kind", "watchlist");

  applyAnimeScope(delQ, anime_id, anime_episode_id);

  const del = await delQ;
  if (del.error) return { error: del.error };

  if (!in_watchlist) return { error: null };

  const { error } = await supabase.from("user_marks").insert({
    user_id: user.id,
    kind: "watchlist",
    anime_id,
    anime_episode_id: anime_episode_id ?? null,
  });

  return { error };
}

export async function getMyMangaWatchlistMark(
  manga_id: string,
  manga_chapter_id?: string | null
) {
  const { user, error: userErr } = await getAuthedUser();
  if (userErr || !user) {
    return { exists: false, error: userErr ?? new Error("Not authenticated.") };
  }

  const q = supabase
    .from("user_marks")
    .select("id")
    .eq("user_id", user.id)
    .eq("kind", "watchlist");

  applyMangaScope(q, manga_id, manga_chapter_id);

  const { data, error } = await q.maybeSingle();
  if (error) return { exists: false, error };
  return { exists: Boolean(data?.id), error: null };
}

export async function setMyMangaWatchlistMark(
  manga_id: string,
  in_watchlist: boolean,
  manga_chapter_id?: string | null
) {
  const { user, error: userErr } = await getAuthedUser();
  if (userErr || !user) return { error: userErr ?? new Error("Not authenticated.") };

  const delQ = supabase
    .from("user_marks")
    .delete()
    .eq("user_id", user.id)
    .eq("kind", "watchlist");

  applyMangaScope(delQ, manga_id, manga_chapter_id);

  const del = await delQ;
  if (del.error) return { error: del.error };

  if (!in_watchlist) return { error: null };

  const { error } = await supabase.from("user_marks").insert({
    user_id: user.id,
    kind: "watchlist",
    manga_id,
    manga_chapter_id: manga_chapter_id ?? null,
  });

  return { error };
}

/* ======================================================
   RATING (anime series OR episode) ⭐ HALF-STARS 1..10
====================================================== */

export async function getMyAnimeRatingMark(
  anime_id: string,
  anime_episode_id?: string | null
) {
  const { user, error: userErr } = await getAuthedUser();
  if (userErr || !user) {
    return {
      exists: false,
      halfStars: null as number | null,
      error: userErr ?? new Error("Not authenticated."),
    };
  }

  const q = supabase
    .from("user_marks")
    .select("id, stars")
    .eq("user_id", user.id)
    .eq("kind", "rating");

  applyAnimeScope(q, anime_id, anime_episode_id);

  const { data, error } = await q.maybeSingle();

  if (error) return { exists: false, halfStars: null as number | null, error };

  return {
    exists: Boolean(data?.id),
    halfStars: (data?.stars ?? null) as number | null,
    error: null,
  };
}

export async function setMyAnimeRatingMark(
  anime_id: string,
  halfStars: number | null,
  anime_episode_id?: string | null
) {
  const { user, error: userErr } = await getAuthedUser();
  if (userErr || !user) {
    return { error: userErr ?? new Error("Not authenticated.") };
  }

  const delQ = supabase
    .from("user_marks")
    .delete()
    .eq("user_id", user.id)
    .eq("kind", "rating");

  applyAnimeScope(delQ, anime_id, anime_episode_id);

  const del = await delQ;
  if (del.error) return { error: del.error };

  if (halfStars == null) return { error: null };

  const clamped = Math.max(1, Math.min(10, Math.round(halfStars)));

  const { error } = await supabase.from("user_marks").insert({
    user_id: user.id,
    kind: "rating",
    anime_id,
    anime_episode_id: anime_episode_id ?? null,
    stars: clamped,
  });

  return { error };
}

export async function getMyMangaRatingMark(
  manga_id: string,
  manga_chapter_id?: string | null
) {
  const { user, error: userErr } = await getAuthedUser();
  if (userErr || !user) {
    return {
      exists: false,
      halfStars: null as number | null,
      error: userErr ?? new Error("Not authenticated."),
    };
  }

  const q = supabase
    .from("user_marks")
    .select("id, stars")
    .eq("user_id", user.id)
    .eq("kind", "rating");

  applyMangaScope(q, manga_id, manga_chapter_id);

  const { data, error } = await q.maybeSingle();
  if (error) return { exists: false, halfStars: null as number | null, error };

  return {
    exists: Boolean(data?.id),
    halfStars: (data?.stars ?? null) as number | null,
    error: null,
  };
}

export async function setMyMangaRatingMark(
  manga_id: string,
  halfStars: number | null,
  manga_chapter_id?: string | null
) {
  const { user, error: userErr } = await getAuthedUser();
  if (userErr || !user) return { error: userErr ?? new Error("Not authenticated.") };

  const delQ = supabase
    .from("user_marks")
    .delete()
    .eq("user_id", user.id)
    .eq("kind", "rating");

  applyMangaScope(delQ, manga_id, manga_chapter_id);

  const del = await delQ;
  if (del.error) return { error: del.error };

  if (halfStars == null) return { error: null };

  const clamped = Math.max(1, Math.min(10, Math.round(halfStars)));

  const { error } = await supabase.from("user_marks").insert({
    user_id: user.id,
    kind: "rating",
    manga_id,
    manga_chapter_id: manga_chapter_id ?? null,
    stars: clamped, // ✅ matches your table
  });

  return { error };
}
