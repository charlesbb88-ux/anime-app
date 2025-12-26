// pages/anime/[slug]/activity.tsx
"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { useRouter } from "next/router";

import { supabase } from "@/lib/supabaseClient";

const CARD_CLASS = "bg-black p-4 text-neutral-100";

type Visibility = "public" | "friends" | "private";

type ActivityItem =
  | {
      id: string;
      kind: "log";
      type: "anime_series" | "anime_episode";
      title: string;
      subLabel?: string;
      rating: number | null; // 0..100 (from logs)
      note: string | null;
      logged_at: string;
      visibility: Visibility;

      // series snapshot flags (only for anime_series logs)
      liked?: boolean | null;
      review_id?: string | null;
    }
  | {
      id: string;
      kind: "review";
      type: "anime_series_review";
      title: string;
      logged_at: string; // reviews.created_at
      rating: number | null; // 0..100
      content: string | null;
      contains_spoilers: boolean;
    }
  | {
      id: string;
      kind: "mark";
      type: "watched" | "liked" | "watchlist" | "rating";
      title: string;
      logged_at: string; // user_marks.created_at
      stars?: number | null; // half-stars 1..10 (only for rating mark)
    };

function getAnimeDisplayTitle(anime: any): string {
  return (
    anime?.title_english ||
    anime?.title_preferred ||
    anime?.title_native ||
    anime?.title ||
    "Unknown anime"
  );
}

/* -------------------- Dates -------------------- */

function formatRelativeShort(iso: string) {
  const d = new Date(iso);
  const now = new Date();

  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay < 30) return `${diffDay}d`;

  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function formatOnFullDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/* -------------------- Half-star visuals -------------------- */

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function computeStarFillPercent(halfStars: number, starIndex: number) {
  const starHalfStart = (starIndex - 1) * 2;
  const remaining = halfStars - starHalfStart;

  if (remaining >= 2) return 100 as const;
  if (remaining === 1) return 50 as const;
  return 0 as const;
}

function StarVisual({ filledPercent }: { filledPercent: 0 | 50 | 100 }) {
  return (
    <span className="relative inline-block">
      <span className="text-[18px] leading-none text-gray-600">★</span>

      {filledPercent > 0 && (
        <span
          className="pointer-events-none absolute left-0 top-0 overflow-hidden text-[18px] leading-none text-emerald-400"
          style={{ width: `${filledPercent}%` }}
        >
          ★
        </span>
      )}
    </span>
  );
}

function HalfStarsRow({ halfStars }: { halfStars: number }) {
  const hs = clampInt(halfStars, 0, 10);

  return (
    <span className="ml-2 inline-flex items-center gap-[2px] align-middle">
      {Array.from({ length: 5 }).map((_, i) => {
        const starIndex = i + 1;
        const fill = computeStarFillPercent(hs, starIndex);
        return <StarVisual key={starIndex} filledPercent={fill} />;
      })}
    </span>
  );
}

/* -------------------- Snapshot helpers -------------------- */

// Convert a 0..100 rating to half-stars 1..10
function rating100ToHalfStars(rating: number | null): number | null {
  if (typeof rating !== "number" || !Number.isFinite(rating)) return null;
  const clamped = clampInt(rating, 0, 100);
  if (clamped <= 0) return null;
  return clampInt(Math.round(clamped / 10), 1, 10);
}

function joinWithCommasAnd(parts: string[]) {
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function actionWord(a: "reviewed" | "liked" | "watched" | "rated") {
  if (a === "rated") return "rated";
  if (a === "reviewed") return "reviewed";
  if (a === "liked") return "liked";
  return "watched";
}

function buildSnapshotPrefix(actions: Array<"reviewed" | "liked" | "watched" | "rated">) {
  return `You ${joinWithCommasAnd(actions.map(actionWord))}`;
}

const AnimeActivityPage: NextPage = () => {
  const router = useRouter();
  const { slug } = router.query as { slug?: string };

  const [loading, setLoading] = useState(true);
  const [pageTitle, setPageTitle] = useState<string>("Your activity");
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (!user || userErr) {
        router.replace("/login");
        return;
      }

      if (!slug) {
        if (mounted) setLoading(false);
        return;
      }

      const animeRes = await supabase
        .from("anime")
        .select("id, title, title_english, title_native, title_preferred")
        .eq("slug", slug)
        .maybeSingle();

      if (!mounted) return;

      const anime = animeRes.data ?? null;
      if (animeRes.error || !anime?.id) {
        setError("Anime not found.");
        setLoading(false);
        return;
      }

      const animeTitle = getAnimeDisplayTitle(anime);
      setPageTitle(`Your activity · ${animeTitle}`);

      const [
        seriesLogsRes,
        episodeLogsRes,
        seriesReviewsRes,
        watchedMarkRes,
        likedMarkRes,
        watchlistMarkRes,
        ratingMarkRes,
      ] = await Promise.all([
        // ✅ SERIES LOG SNAPSHOT ANCHOR
        supabase
          .from("anime_series_logs")
          .select("id, logged_at, rating, note, visibility, liked, review_id")
          .eq("user_id", user.id)
          .eq("anime_id", anime.id)
          .order("logged_at", { ascending: false }),

        supabase
          .from("anime_episode_logs")
          .select(
            `id, logged_at, rating, note, visibility,
             episode:anime_episode_id ( episode_number ),
             anime:anime_id ( title_english, title_preferred, title_native, title )`
          )
          .eq("user_id", user.id)
          .eq("anime_id", anime.id)
          .order("logged_at", { ascending: false }),

        // series reviews (we will filter out those attached to series logs)
        supabase
          .from("reviews")
          .select("id, created_at, rating, content, contains_spoilers")
          .eq("user_id", user.id)
          .eq("anime_id", anime.id)
          .is("anime_episode_id", null)
          .order("created_at", { ascending: false }),

        // marks (latest for this anime series)
        supabase
          .from("user_marks")
          .select("id, created_at")
          .eq("user_id", user.id)
          .eq("kind", "watched")
          .eq("anime_id", anime.id)
          .is("anime_episode_id", null)
          .is("manga_id", null)
          .is("manga_chapter_id", null)
          .maybeSingle(),

        supabase
          .from("user_marks")
          .select("id, created_at")
          .eq("user_id", user.id)
          .eq("kind", "liked")
          .eq("anime_id", anime.id)
          .is("anime_episode_id", null)
          .is("manga_id", null)
          .is("manga_chapter_id", null)
          .maybeSingle(),

        supabase
          .from("user_marks")
          .select("id, created_at")
          .eq("user_id", user.id)
          .eq("kind", "watchlist")
          .eq("anime_id", anime.id)
          .is("anime_episode_id", null)
          .is("manga_id", null)
          .is("manga_chapter_id", null)
          .maybeSingle(),

        supabase
          .from("user_marks")
          .select("id, created_at, stars")
          .eq("user_id", user.id)
          .eq("kind", "rating")
          .eq("anime_id", anime.id)
          .is("anime_episode_id", null)
          .is("manga_id", null)
          .is("manga_chapter_id", null)
          .maybeSingle(),
      ]);

      if (!mounted) return;

      const merged: ActivityItem[] = [];

      // Build sets for de-duping
      const attachedReviewIds = new Set<string>();

      const seriesLogSnapshots = (seriesLogsRes.data ?? []).map((row: any) => {
        const loggedAtIso = String(row?.logged_at ?? "");
        const ms = new Date(loggedAtIso).getTime();

        const liked = typeof row?.liked === "boolean" ? row.liked : Boolean(row?.liked);
        const hasRating = typeof row?.rating === "number" && Number.isFinite(row.rating) && row.rating > 0;

        const reviewId = row?.review_id ? String(row.review_id) : null;
        if (reviewId) attachedReviewIds.add(reviewId);

        return {
          ms: Number.isFinite(ms) ? ms : null,
          liked,
          hasRating,
          hasWatched: true, // log implies watched
        };
      });

      // ✅ Key change: suppress mark ONLY if there's a nearby series log that already includes that action
      function shouldSuppressMarkBecauseOfNearbySeriesLog(
        markType: "watched" | "liked" | "rating" | "watchlist",
        markCreatedAtIso: string
      ) {
        if (markType === "watchlist") return false; // do not touch watchlist behavior

        const markMs = new Date(markCreatedAtIso).getTime();
        if (!Number.isFinite(markMs)) return false;

        // window for "this mark was part of the log submit"
        const windowMs = 2 * 60 * 1000; // 2 minutes

        for (const snap of seriesLogSnapshots) {
          if (snap.ms == null) continue;
          const diff = Math.abs(markMs - snap.ms);
          if (diff > windowMs) continue;

          if (markType === "watched" && snap.hasWatched) return true;
          if (markType === "liked" && snap.liked) return true;
          if (markType === "rating" && snap.hasRating) return true;
        }

        return false;
      }

      // ✅ Marks (keep non-log marks, suppress only those that came from a log submit)
      function maybePushMark(mark: any, type: "watched" | "liked" | "watchlist" | "rating") {
        if (!mark?.id || !mark?.created_at) return;

        const createdAt = String(mark.created_at);

        const suppress =
          type === "rating"
            ? shouldSuppressMarkBecauseOfNearbySeriesLog("rating", createdAt)
            : type === "liked"
              ? shouldSuppressMarkBecauseOfNearbySeriesLog("liked", createdAt)
              : type === "watched"
                ? shouldSuppressMarkBecauseOfNearbySeriesLog("watched", createdAt)
                : shouldSuppressMarkBecauseOfNearbySeriesLog("watchlist", createdAt);

        if (suppress) return;

        merged.push({
          id: String(mark.id),
          kind: "mark",
          type,
          title: animeTitle,
          logged_at: createdAt,
          stars: type === "rating" ? (mark.stars ?? null) : undefined,
        });
      }

      maybePushMark(watchedMarkRes.data, "watched");
      maybePushMark(likedMarkRes.data, "liked");
      maybePushMark(watchlistMarkRes.data, "watchlist");
      maybePushMark(ratingMarkRes.data, "rating");

      // ✅ Standalone series reviews (ONLY if not attached to a snapshot series log)
      (seriesReviewsRes.data ?? []).forEach((row: any) => {
        if (!row?.id || !row?.created_at) return;
        if (attachedReviewIds.has(String(row.id))) return;

        merged.push({
          id: String(row.id),
          kind: "review",
          type: "anime_series_review",
          title: animeTitle,
          logged_at: String(row.created_at),
          rating: typeof row.rating === "number" ? row.rating : null,
          content: row.content ?? null,
          contains_spoilers: Boolean(row.contains_spoilers),
        });
      });

      // ✅ Series logs rendered as stable snapshots
      (seriesLogsRes.data ?? []).forEach((row: any) => {
        merged.push({
          id: String(row.id),
          kind: "log",
          type: "anime_series",
          title: animeTitle,
          rating: typeof row.rating === "number" ? row.rating : null,
          note: row.note ?? null,
          logged_at: String(row.logged_at),
          visibility: (row.visibility as Visibility) ?? "public",
          liked: typeof row.liked === "boolean" ? row.liked : Boolean(row.liked),
          review_id: row.review_id ?? null,
        });
      });

      // ✅ Episode logs (never grouped)
      (episodeLogsRes.data ?? []).forEach((row: any) => {
        const rowTitle = getAnimeDisplayTitle(row?.anime) || animeTitle;

        merged.push({
          id: String(row.id),
          kind: "log",
          type: "anime_episode",
          title: rowTitle,
          subLabel:
            row?.episode?.episode_number != null
              ? `Episode ${row.episode.episode_number}`
              : "Episode",
          rating: typeof row.rating === "number" ? row.rating : null,
          note: row.note ?? null,
          logged_at: String(row.logged_at),
          visibility: (row.visibility as Visibility) ?? "public",
        });
      });

      const finalItems = merged.sort(
        (a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
      );

      setItems(finalItems);
      setLoading(false);
    }

    run();

    return () => {
      mounted = false;
    };
  }, [router, slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
        Loading…
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{pageTitle}</h1>

      {error ? (
        <div className="text-sm text-red-300">{error}</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-neutral-500">No activity yet.</div>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => {
            // ✅ SERIES SNAPSHOT CARD (from anime_series_logs only)
            if (item.kind === "log" && item.type === "anime_series") {
              const actions: Array<"watched" | "liked" | "rated" | "reviewed"> = [];

              actions.push("watched"); // log = watched anchor
              if (item.liked) actions.push("liked");

              const hs = rating100ToHalfStars(item.rating);
              if (hs !== null) actions.push("rated");

              if (item.review_id) actions.push("reviewed");

              const prefix = buildSnapshotPrefix(actions);

              return (
                <li key={`series-snap-${item.id}`} className={CARD_CLASS}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">
                      {prefix} <span className="font-bold text-white">{item.title}</span>
                      {hs !== null ? <HalfStarsRow halfStars={hs} /> : null}
                      <span className="ml-1"> on {formatOnFullDate(item.logged_at)}</span>
                    </div>

                    <div className="whitespace-nowrap text-xs text-neutral-100">
                      {formatRelativeShort(item.logged_at)}
                    </div>
                  </div>
                </li>
              );
            }

            // ✅ MARKS (non-log stuff)
            if (item.kind === "mark" && item.type === "watched") {
              return (
                <li key={`watched-${item.id}`} className={CARD_CLASS}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">
                      You marked <span className="font-bold text-white">{item.title}</span> as watched
                    </div>
                    <div className="whitespace-nowrap text-xs text-neutral-100">
                      {formatRelativeShort(item.logged_at)}
                    </div>
                  </div>
                </li>
              );
            }

            if (item.kind === "mark" && item.type === "liked") {
              return (
                <li key={`liked-${item.id}`} className={CARD_CLASS}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">
                      You liked <span className="font-bold text-white">{item.title}</span>
                    </div>
                    <div className="whitespace-nowrap text-xs text-neutral-100">
                      {formatRelativeShort(item.logged_at)}
                    </div>
                  </div>
                </li>
              );
            }

            if (item.kind === "mark" && item.type === "watchlist") {
              return (
                <li key={`watchlist-${item.id}`} className={CARD_CLASS}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">
                      You added <span className="font-bold text-white">{item.title}</span> to your watchlist
                    </div>
                    <div className="whitespace-nowrap text-xs text-neutral-100">
                      {formatRelativeShort(item.logged_at)}
                    </div>
                  </div>
                </li>
              );
            }

            if (item.kind === "mark" && item.type === "rating") {
              const hs = clampInt(Number(item.stars ?? 0), 0, 10);

              return (
                <li key={`rating-${item.id}`} className={CARD_CLASS}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">
                      You rated <span className="font-bold text-white">{item.title}</span>
                      {hs > 0 ? <HalfStarsRow halfStars={hs} /> : null}
                    </div>
                    <div className="whitespace-nowrap text-xs text-neutral-100">
                      {formatRelativeShort(item.logged_at)}
                    </div>
                  </div>
                </li>
              );
            }

            // ✅ Standalone series review (only if not attached to a snapshot)
            if (item.kind === "review") {
              return (
                <li key={`review-${item.id}`} className={CARD_CLASS}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">
                      You reviewed <span className="font-bold text-white">{item.title}</span>
                    </div>
                    <div className="whitespace-nowrap text-xs text-neutral-100">
                      {formatRelativeShort(item.logged_at)}
                    </div>
                  </div>
                </li>
              );
            }

            // ✅ Episode logs
            if (item.kind === "log" && item.type === "anime_episode") {
              return (
                <li key={`episode-log-${item.id}`} className={CARD_CLASS}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">
                      {item.title}
                      {item.subLabel ? (
                        <span className="ml-2 text-neutral-400">· {item.subLabel}</span>
                      ) : null}
                    </div>

                    <div className="whitespace-nowrap text-xs text-neutral-100">
                      {formatRelativeShort(item.logged_at)}
                    </div>
                  </div>

                  <div className="mt-1 text-xs text-neutral-100">anime episode</div>

                  {item.rating !== null ? <div className="mt-2 text-sm">Rating: {item.rating}</div> : null}

                  {item.note ? (
                    <div className="mt-1 line-clamp-2 text-sm text-neutral-400">{item.note}</div>
                  ) : null}
                </li>
              );
            }

            return null;
          })}
        </ul>
      )}
    </main>
  );
};

export default AnimeActivityPage;
