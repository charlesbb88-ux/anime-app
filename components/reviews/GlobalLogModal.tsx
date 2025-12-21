// components/reviews/GlobalLogModal.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  createAnimeEpisodeLog,
  createAnimeSeriesLog,
  createMangaChapterLog,
  createMangaSeriesLog,
} from "@/lib/logs";

import {
  setMyAnimeWatchedMark,
  setMyAnimeRatingMark,
  setMyAnimeLikedMark,
} from "@/lib/marks";

import {
  createAnimeSeriesReview,
  createAnimeEpisodeReview,
  createMangaSeriesReview,
  createMangaChapterReview,
} from "@/lib/reviews";

import { Heart } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Visibility = "public" | "friends" | "private";

type Props = {
  open: boolean;
  onClose: () => void;

  title?: string | null;
  posterUrl?: string | null;

  // targets
  animeEpisodeId?: string | null;
  animeId?: string | null;
  mangaChapterId?: string | null;
  mangaId?: string | null;

  visibility?: Visibility | null;
  onSuccess?: () => void;
};

/* -------------------- helpers -------------------- */

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function computeStarFillPercent(shownHalfStars: number, starIndex: number) {
  const starHalfStart = (starIndex - 1) * 2;
  const remaining = shownHalfStars - starHalfStart;

  if (remaining >= 2) return 100 as const;
  if (remaining === 1) return 50 as const;
  return 0 as const;
}

function StarVisual({
  filledPercent,
  dim,
  size = 34,
}: {
  filledPercent: 0 | 50 | 100;
  dim?: boolean;
  size?: number;
}) {
  return (
    <span className={["relative inline-block", dim ? "opacity-60" : ""].join(" ")}>
      <span className="leading-none text-gray-600" style={{ fontSize: size }}>
        ★
      </span>

      {filledPercent > 0 && (
        <span
          className="pointer-events-none absolute left-0 top-0 overflow-hidden leading-none text-emerald-400"
          style={{ width: `${filledPercent}%`, fontSize: size }}
        >
          ★
        </span>
      )}
    </span>
  );
}

function formatWatchedOn(d: Date) {
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Map half-stars (1..10) to rating 0..100 in 10-point steps.
// If untouched, return null so we don't force a rating.
function halfStarsTo100(halfStars: number | null): number | null {
  if (halfStars === null) return null;
  const hs = clampInt(halfStars, 1, 10);
  return Math.round((hs / 10) * 100); // 10..100
}

/* -------------------- Manga marks (local) -------------------- */
/* Keeps lib/marks.ts untouched; we implement manga marks in this file. */

async function getAuthedUser(): Promise<{ userId: string | null; error: any }> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) return { userId: null, error };
  if (!user) return { userId: null, error: new Error("Not authenticated") };

  return { userId: user.id, error: null };
}

function applyMangaScope(q: any, manga_id: string, manga_chapter_id?: string | null) {
  q.eq("manga_id", manga_id);

  // series scope = chapter_id null
  // chapter scope = chapter_id = provided id
  if (manga_chapter_id) q.eq("manga_chapter_id", manga_chapter_id);
  else q.is("manga_chapter_id", null);

  // keep these null so we never mix with anime
  q.is("anime_id", null).is("anime_episode_id", null);

  return q;
}

async function setMyMangaMark(
  kind: "watched" | "liked" | "rating",
  manga_id: string,
  manga_chapter_id: string | null,
  value: boolean | number | null
): Promise<{ error: any }> {
  const { userId, error: userErr } = await getAuthedUser();
  if (userErr || !userId) return { error: userErr ?? new Error("Not authenticated") };

  // delete existing mark in this SAME scope
  const delQ = supabase
    .from("user_marks")
    .delete()
    .eq("user_id", userId)
    .eq("kind", kind);

  applyMangaScope(delQ, manga_id, manga_chapter_id);

  const del = await delQ;
  if (del.error) return { error: del.error };

  // if turning off / clearing, we’re done
  if (kind === "liked" && value === false) return { error: null };
  if (kind === "rating" && value == null) return { error: null };
  if (kind === "watched" && value === false) return { error: null };

  const insertRow: any = {
    user_id: userId,
    kind,
    manga_id,
    manga_chapter_id: manga_chapter_id ?? null,
  };

  if (kind === "rating") {
    const clamped = clampInt(Number(value ?? 0), 1, 10);
    insertRow.stars = clamped;
  }

  const { error } = await supabase.from("user_marks").insert(insertRow);
  return { error };
}

/* -------------------- Component -------------------- */

export default function GlobalLogModal({
  open,
  onClose,
  title,
  posterUrl,

  animeEpisodeId = null,
  animeId = null,
  mangaChapterId = null,
  mangaId = null,

  visibility = null,
  onSuccess,
}: Props) {
  const [content, setContent] = useState<string>("");
  const [containsSpoilers, setContainsSpoilers] = useState<boolean>(false);

  // “Log in Journal” checkbox
  const [logWatchToActivity, setLogWatchToActivity] = useState<boolean>(false);

  // freeze a "watched on" date label
  const [watchedOnLabel, setWatchedOnLabel] = useState<string>("");

  // Rating mark (half-stars 1..10)
  const [hoverHalfStars, setHoverHalfStars] = useState<number | null>(null);
  const [halfStars, setHalfStars] = useState<number | null>(null);
  const shownHalfStars = useMemo(
    () => hoverHalfStars ?? halfStars ?? 0,
    [hoverHalfStars, halfStars]
  );

  // Like choice in THIS modal (null = untouched; true/false = explicit choice)
  const [likeChoice, setLikeChoice] = useState<boolean | null>(null);

  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const target = useMemo(() => {
    if (animeEpisodeId) return "animeEpisode";
    if (animeId) return "animeSeries";
    if (mangaChapterId) return "mangaChapter";
    if (mangaId) return "mangaSeries";
    return null;
  }, [animeEpisodeId, animeId, mangaChapterId, mangaId]);

  const isEpisodeLikeTarget = target === "animeEpisode" || target === "mangaChapter";

  const canSubmit = useMemo(() => {
    if (saving) return false;
    if (!target) return false;

    if (target === "animeEpisode") return Boolean(animeEpisodeId && animeId);
    if (target === "animeSeries") return Boolean(animeId);
    if (target === "mangaChapter") return Boolean(mangaChapterId && mangaId);
    if (target === "mangaSeries") return Boolean(mangaId);

    return false;
  }, [saving, target, animeEpisodeId, animeId, mangaChapterId, mangaId]);

  // ✅ IMPORTANT: only show the checkbox/like/stars if the modal has a valid target combo.
  // This prevents “it looks clickable but Save is disabled” confusion.
  const showLikeAndStars = canSubmit;
  const showJournalCheckbox = canSubmit;

  // Reset on open (modal opens blank: no stars + no like)
  useEffect(() => {
    if (!open) return;

    setContent("");
    setContainsSpoilers(false);

    // default checkbox behavior:
    // - Episode/chapter: default ON
    // - Series: default OFF
    if (isEpisodeLikeTarget) {
      setLogWatchToActivity(true);
      setWatchedOnLabel(formatWatchedOn(new Date()));
    } else {
      setLogWatchToActivity(false);
      setWatchedOnLabel("");
    }

    setHoverHalfStars(null);
    setHalfStars(null);
    setLikeChoice(null);

    setSaving(false);
    setError("");
  }, [open, isEpisodeLikeTarget]);

  function handleToggleJournal(checked: boolean) {
    setLogWatchToActivity(checked);
    if (checked) setWatchedOnLabel(formatWatchedOn(new Date()));
    else setWatchedOnLabel("");
  }

  function setRatingHalfStars(nextHalfStars: number) {
    const clamped = clampInt(nextHalfStars, 1, 10);
    const nextValue = halfStars === clamped ? null : clamped;
    setHalfStars(nextValue);
  }

  function toggleLike() {
    setLikeChoice((prev) => {
      if (prev === null) return true;
      return !prev;
    });
  }

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!target || saving) return;

    setSaving(true);
    setError("");

    try {
      const trimmed = content.trim();
      const reviewRating = halfStarsTo100(halfStars);

      // Like is only TRUE if explicitly set true. If untouched (null), treat as false for payload fields.
      const snapshotLiked = likeChoice === true;
      const snapshotRating = reviewRating;

      /* ==========================
         ANIME EPISODE
      ========================== */
      if (target === "animeEpisode") {
        if (!animeId || !animeEpisodeId) throw new Error("Missing animeId or animeEpisodeId.");

        let reviewId: string | null = null;

        if (trimmed) {
          const result = await createAnimeEpisodeReview({
            anime_id: animeId,
            anime_episode_id: animeEpisodeId,
            rating: snapshotRating,
            content: trimmed,
            contains_spoilers: containsSpoilers,
            author_liked: snapshotLiked,
          });
          if (result.error) throw result.error;
          reviewId = result.data?.id ?? null;
        }

        // Marks (episode-scoped): watched always, liked/rating only if touched
        {
          const { error } = await setMyAnimeWatchedMark(animeId, true, animeEpisodeId);
          if (error) throw error;
        }

        if (likeChoice !== null) {
          const { error } = await setMyAnimeLikedMark(animeId, likeChoice, animeEpisodeId);
          if (error) throw error;
        }

        if (halfStars !== null) {
          const nextValue = clampInt(halfStars, 1, 10);
          const { error } = await setMyAnimeRatingMark(animeId, nextValue, animeEpisodeId);
          if (error) throw error;
        }

        // ONLY create log if checkbox ON
        if (logWatchToActivity) {
          const { error } = await createAnimeEpisodeLog({
            anime_id: animeId,
            anime_episode_id: animeEpisodeId,
            visibility: visibility ?? undefined,

            rating: snapshotRating,
            liked: snapshotLiked,
            review_id: reviewId,

            note: trimmed ? trimmed : null,
            contains_spoilers: containsSpoilers,
          });
          if (error) throw error;
        }

        onClose();
        onSuccess?.();
        return;
      }

      /* ==========================
         ANIME SERIES
      ========================== */
      if (target === "animeSeries") {
        if (!animeId) throw new Error("Missing animeId.");

        // watched always
        {
          const { error } = await setMyAnimeWatchedMark(animeId, true);
          if (error) throw error;
        }

        // liked/rating only if touched
        if (halfStars !== null) {
          const nextValue = clampInt(halfStars, 1, 10);
          const { error } = await setMyAnimeRatingMark(animeId, nextValue);
          if (error) throw error;
        }

        if (likeChoice !== null) {
          const { error } = await setMyAnimeLikedMark(animeId, likeChoice);
          if (error) throw error;
        }

        // review optional
        let reviewId: string | null = null;
        if (trimmed) {
          const result = await createAnimeSeriesReview({
            anime_id: animeId,
            rating: snapshotRating,
            content: trimmed,
            contains_spoilers: containsSpoilers,
            author_liked: snapshotLiked,
          });
          if (result.error) throw result.error;
          reviewId = result.data?.id ?? null;
        }

        // log optional (checkbox)
        if (logWatchToActivity) {
          const { error } = await createAnimeSeriesLog({
            anime_id: animeId,
            visibility: visibility ?? undefined,

            rating: snapshotRating,
            liked: snapshotLiked,
            review_id: reviewId,

            note: trimmed ? trimmed : null,
            contains_spoilers: containsSpoilers,
          });
          if (error) throw error;
        }

        onClose();
        onSuccess?.();
        return;
      }

      /* ==========================
         MANGA CHAPTER
      ========================== */
      if (target === "mangaChapter") {
        if (!mangaId || !mangaChapterId) throw new Error("Missing mangaId or mangaChapterId.");

        let reviewId: string | null = null;

        if (trimmed) {
          const result = await createMangaChapterReview({
            manga_id: mangaId,
            manga_chapter_id: mangaChapterId,
            rating: snapshotRating,
            content: trimmed,
            contains_spoilers: containsSpoilers,
            author_liked: snapshotLiked,
          });
          if (result.error) throw result.error;
          reviewId = result.data?.id ?? null;
        }

        // Marks (chapter-scoped): watched always, liked/rating only if touched
        {
          const { error } = await setMyMangaMark("watched", mangaId, mangaChapterId, true);
          if (error) throw error;
        }

        if (likeChoice !== null) {
          const { error } = await setMyMangaMark("liked", mangaId, mangaChapterId, likeChoice);
          if (error) throw error;
        }

        if (halfStars !== null) {
          const nextValue = clampInt(halfStars, 1, 10);
          const { error } = await setMyMangaMark("rating", mangaId, mangaChapterId, nextValue);
          if (error) throw error;
        }

        // ONLY create log if checkbox ON
        if (logWatchToActivity) {
          const { error } = await createMangaChapterLog({
            manga_id: mangaId,
            manga_chapter_id: mangaChapterId,
            visibility: visibility ?? undefined,

            rating: snapshotRating,
            liked: snapshotLiked,
            review_id: reviewId,

            note: trimmed ? trimmed : null,
            contains_spoilers: containsSpoilers,
          });
          if (error) throw error;
        }

        onClose();
        onSuccess?.();
        return;
      }

      /* ==========================
         MANGA SERIES
      ========================== */
      if (target === "mangaSeries") {
        if (!mangaId) throw new Error("Missing mangaId.");

        // watched always
        {
          const { error } = await setMyMangaMark("watched", mangaId, null, true);
          if (error) throw error;
        }

        // liked/rating only if touched
        if (likeChoice !== null) {
          const { error } = await setMyMangaMark("liked", mangaId, null, likeChoice);
          if (error) throw error;
        }

        if (halfStars !== null) {
          const nextValue = clampInt(halfStars, 1, 10);
          const { error } = await setMyMangaMark("rating", mangaId, null, nextValue);
          if (error) throw error;
        }

        // review optional
        let reviewId: string | null = null;
        if (trimmed) {
          const result = await createMangaSeriesReview({
            manga_id: mangaId,
            rating: snapshotRating,
            content: trimmed,
            contains_spoilers: containsSpoilers,
            author_liked: snapshotLiked,
          });
          if (result.error) throw result.error;
          reviewId = result.data?.id ?? null;
        }

        // log optional (checkbox)
        if (logWatchToActivity) {
          const { error } = await createMangaSeriesLog({
            manga_id: mangaId,
            visibility: visibility ?? undefined,

            rating: snapshotRating,
            liked: snapshotLiked,
            review_id: reviewId,

            note: trimmed ? trimmed : null,
            contains_spoilers: containsSpoilers,
          });
          if (error) throw error;
        }

        onClose();
        onSuccess?.();
        return;
      }
    } catch (err: any) {
      const msg = err?.message || (typeof err === "string" ? err : "") || "Failed to save log.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  const heartColor =
    likeChoice === null ? "text-zinc-500" : likeChoice ? "text-red-400" : "text-zinc-400";
  const heartFill = likeChoice === true ? "fill-current" : "";

  const checkboxLabel =
    logWatchToActivity && watchedOnLabel ? `Logged on ${watchedOnLabel}` : "Log in Journal";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" aria-modal="true" role="dialog">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-label="Close modal"
      />

      <div
        className="relative z-10 w-[94vw] max-w-[860px] rounded-xl bg-zinc-900 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-zinc-400">Log / Review</div>
            <div className="text-lg font-semibold text-white">{title ?? "Log"}</div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-[220px_1fr] gap-5">
          <div className="flex justify-center">
            {posterUrl ? (
              <img
                src={posterUrl}
                alt={title ?? "Poster"}
                className="h-[320px] w-[220px] rounded-[2px] object-cover"
              />
            ) : (
              <div className="h-[320px] w-[220px] rounded-[2px] object-cover" />
            )}
          </div>

          <div className="flex flex-col gap-4">
            {/* Log checkbox */}
            {showJournalCheckbox ? (
              <label className="flex items-center gap-2 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  checked={logWatchToActivity}
                  onChange={(e) => handleToggleJournal(e.target.checked)}
                  className="h-4 w-4"
                />
                {checkboxLabel}
              </label>
            ) : null}

            {/* Review box */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-200">Review</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={9}
                placeholder="Write your thoughts..."
                disabled={saving}
                className={[
                  "min-h-[220px] w-full resize-none rounded-md border border-zinc-700 bg-zinc-950/40 px-3 py-2 text-sm text-white outline-none focus:border-zinc-500",
                  saving ? "opacity-60" : "",
                ].join(" ")}
              />
            </div>

            {/* Like (heart) */}
            {showLikeAndStars ? (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={toggleLike}
                  disabled={saving}
                  aria-pressed={likeChoice === true}
                  className={[
                    "rounded-md px-2 py-1",
                    saving
                      ? "opacity-60 cursor-not-allowed"
                      : "hover:bg-white/5 active:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/10",
                  ].join(" ")}
                  title={
                    likeChoice === null
                      ? "Like"
                      : likeChoice
                        ? "Will like on save"
                        : "Will remove like on save"
                  }
                >
                  <Heart className={["h-7 w-7", heartColor, heartFill].join(" ")} />
                </button>
              </div>
            ) : null}

            {/* Stars */}
            {showLikeAndStars ? (
              <div className="pt-1">
                <div className="mb-1 text-center text-xs font-semibold text-zinc-300">
                  {halfStars == null ? "Rate" : "Rated"}
                </div>

                <div
                  className="flex justify-center gap-[8px]"
                  onMouseLeave={() => setHoverHalfStars(null)}
                >
                  {Array.from({ length: 5 }).map((_, i) => {
                    const starIndex = i + 1;
                    const filled = computeStarFillPercent(shownHalfStars, starIndex);

                    return (
                      <div key={starIndex} className="relative">
                        <StarVisual filledPercent={filled} dim={saving} size={34} />

                        <button
                          type="button"
                          disabled={saving}
                          className="absolute inset-y-0 left-0 w-1/2"
                          onMouseEnter={() => setHoverHalfStars(starIndex * 2 - 1)}
                          onFocus={() => setHoverHalfStars(starIndex * 2 - 1)}
                          onClick={() => setRatingHalfStars(starIndex * 2 - 1)}
                          aria-label={`Rate ${starIndex - 0.5} stars`}
                          title={`Rate ${starIndex - 0.5} stars`}
                        />

                        <button
                          type="button"
                          disabled={saving}
                          className="absolute inset-y-0 right-0 w-1/2"
                          onMouseEnter={() => setHoverHalfStars(starIndex * 2)}
                          onFocus={() => setHoverHalfStars(starIndex * 2)}
                          onClick={() => setRatingHalfStars(starIndex * 2)}
                          aria-label={`Rate ${starIndex} stars`}
                          title={`Rate ${starIndex} stars`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <label className="flex items-center gap-2 text-sm text-zinc-200">
              <input
                type="checkbox"
                checked={containsSpoilers}
                onChange={(e) => setContainsSpoilers(e.target.checked)}
                disabled={saving}
                className="h-4 w-4"
              />
              Contains spoilers
            </label>

            {error ? (
              <div className="rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div className="mt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={!canSubmit}
                className={`rounded-md px-3 py-2 text-sm text-white ${
                  canSubmit ? "bg-emerald-600 hover:bg-emerald-500" : "bg-zinc-700 opacity-60"
                }`}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
