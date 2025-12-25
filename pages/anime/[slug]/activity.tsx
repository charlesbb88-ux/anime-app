// pages/anime/[slug]/activity.tsx
"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { useRouter } from "next/router";

import { supabase } from "@/lib/supabaseClient";

type ActivityItem =
  | {
      id: string;
      kind: "log";
      type: "anime_series" | "anime_episode";
      title: string;
      subLabel?: string;
      rating: number | null;
      note: string | null;
      logged_at: string;
      visibility: "public" | "friends" | "private";
    }
  | {
      id: string;
      kind: "review";
      type: "anime_series_review";
      title: string;
      logged_at: string; // created_at from reviews
      rating: number | null; // 0..100
      content: string | null;
      contains_spoilers: boolean;
    }
  | {
      id: string;
      kind: "mark";
      type: "watched" | "liked" | "watchlist" | "rating";
      title: string;
      logged_at: string;
      stars?: number | null; // half-stars 1..10
    }
  | {
      id: string;
      kind: "group";
      type: "anime_series_group";
      title: string;
      logged_at: string;
      actions: Array<"reviewed" | "liked" | "watched" | "watchlist" | "rated">;

      stars?: number | null;

      review_rating?: number | null;
      review_content?: string | null;
      contains_spoilers?: boolean;

      log_rating?: number | null;
      log_note?: string | null;
      visibility?: "public" | "friends" | "private";
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

/* -------------------- Grouping helpers -------------------- */

function joinWithCommasAnd(parts: string[]) {
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function actionWord(a: "reviewed" | "liked" | "watched" | "watchlist" | "rated") {
  if (a === "watchlist") return "added to your watchlist";
  if (a === "rated") return "rated";
  if (a === "reviewed") return "reviewed";
  if (a === "liked") return "liked";
  return "watched";
}

function buildGroupedPrefix(
  actions: Array<"reviewed" | "liked" | "watched" | "watchlist" | "rated">
) {
  const hasWatchlist = actions.includes("watchlist");
  const main = actions.filter((a) => a !== "watchlist");
  const mainWords = main.map(actionWord);
  const mainPhrase = joinWithCommasAnd(mainWords);

  if (hasWatchlist && main.length > 0) return `You ${mainPhrase}, and added`;
  if (hasWatchlist && main.length === 0) return `You added`;
  return `You ${mainPhrase}`;
}

// Bucket timestamps to the same second
function bucketToSecond(iso: string) {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return iso;
  return String(Math.floor(ms / 1000));
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
        seriesLogs,
        episodeLogs,
        seriesReviews,
        watchedMark,
        likedMark,
        watchlistMark,
        ratingMark,
      ] = await Promise.all([
        supabase
          .from("anime_series_logs")
          .select("id, logged_at, rating, note, visibility")
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

        supabase
          .from("reviews")
          .select("id, created_at, rating, content, contains_spoilers")
          .eq("user_id", user.id)
          .eq("anime_id", anime.id)
          .is("anime_episode_id", null)
          .order("created_at", { ascending: false }),

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

      // marks
      if (watchedMark.data?.id) {
        merged.push({
          id: watchedMark.data.id,
          kind: "mark",
          type: "watched",
          title: animeTitle,
          logged_at: watchedMark.data.created_at,
        });
      }
      if (likedMark.data?.id) {
        merged.push({
          id: likedMark.data.id,
          kind: "mark",
          type: "liked",
          title: animeTitle,
          logged_at: likedMark.data.created_at,
        });
      }
      if (watchlistMark.data?.id) {
        merged.push({
          id: watchlistMark.data.id,
          kind: "mark",
          type: "watchlist",
          title: animeTitle,
          logged_at: watchlistMark.data.created_at,
        });
      }
      if (ratingMark.data?.id) {
        merged.push({
          id: ratingMark.data.id,
          kind: "mark",
          type: "rating",
          title: animeTitle,
          logged_at: ratingMark.data.created_at,
          stars: ratingMark.data.stars ?? null,
        });
      }

      // series reviews
      seriesReviews.data?.forEach((row: any) => {
        merged.push({
          id: row.id,
          kind: "review",
          type: "anime_series_review",
          title: animeTitle,
          logged_at: row.created_at,
          rating: typeof row.rating === "number" ? row.rating : null,
          content: row.content ?? null,
          contains_spoilers: Boolean(row.contains_spoilers),
        });
      });

      // series logs
      seriesLogs.data?.forEach((row: any) => {
        merged.push({
          id: row.id,
          kind: "log",
          type: "anime_series",
          title: animeTitle,
          rating: row.rating,
          note: row.note,
          logged_at: row.logged_at,
          visibility: row.visibility,
        });
      });

      // episode logs (never grouped)
      episodeLogs.data?.forEach((row: any) => {
        const rowTitle = getAnimeDisplayTitle(row?.anime) || animeTitle;

        merged.push({
          id: row.id,
          kind: "log",
          type: "anime_episode",
          title: rowTitle,
          subLabel:
            row.episode?.episode_number != null
              ? `Episode ${row.episode.episode_number}`
              : "Episode",
          rating: row.rating,
          note: row.note,
          logged_at: row.logged_at,
          visibility: row.visibility,
        });
      });

      // Group ONLY when there is a REAL series log in the bucket.
      const seriesBucketMap = new Map<string, ActivityItem[]>();
      const passthrough: ActivityItem[] = [];

      for (const it of merged) {
        const isSeriesLevel =
          (it.kind === "mark" &&
            (it.type === "watched" ||
              it.type === "liked" ||
              it.type === "watchlist" ||
              it.type === "rating")) ||
          (it.kind === "review" && it.type === "anime_series_review") ||
          (it.kind === "log" && it.type === "anime_series");

        if (!isSeriesLevel) {
          passthrough.push(it);
          continue;
        }

        const key = `${bucketToSecond(it.logged_at)}::${it.title}`;
        const arr = seriesBucketMap.get(key) ?? [];
        arr.push(it);
        seriesBucketMap.set(key, arr);
      }

      const regrouped: ActivityItem[] = [];

      for (const [, bucket] of seriesBucketMap.entries()) {
        const hasSeriesLog = bucket.some(
          (x) => x.kind === "log" && x.type === "anime_series"
        );

        // If there's no actual log row, DO NOT GROUP anything in this bucket.
        if (!hasSeriesLog) {
          regrouped.push(...bucket);
          continue;
        }

        // If it has a series log but nothing else, keep it as-is.
        if (bucket.length <= 1) {
          regrouped.push(bucket[0]);
          continue;
        }

        // ✅ Build actions from flags (stable + never misses "reviewed")
        let didWatched = false;
        let didLiked = false;
        let didWatchlist = false;
        let didRated = false;
        let didReviewed = false;

        let stars: number | null = null;

        let review_rating: number | null = null;
        let review_content: string | null = null;
        let contains_spoilers: boolean | undefined = undefined;

        let log_rating: number | null = null;
        let log_note: string | null = null;
        let visibility: "public" | "friends" | "private" | undefined = undefined;

        const sorted = [...bucket].sort(
          (a, b) =>
            new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
        );

        const logged_at = sorted[0].logged_at;
        const title = sorted[0].title;

        for (const it of bucket) {
          if (it.kind === "log" && it.type === "anime_series") {
            didWatched = true;
            log_rating = it.rating ?? null;
            log_note = it.note ?? null;
            visibility = it.visibility;
          } else if (it.kind === "mark") {
            if (it.type === "watched") didWatched = true;
            if (it.type === "liked") didLiked = true;
            if (it.type === "watchlist") didWatchlist = true;
            if (it.type === "rating") {
              didRated = true;
              stars = typeof it.stars === "number" ? it.stars : stars;
            }
          } else if (it.kind === "review") {
            didReviewed = true;
            review_rating = typeof it.rating === "number" ? it.rating : null;
            review_content = it.content ?? null;
            contains_spoilers = Boolean(it.contains_spoilers);
          }
        }

        const actions: Array<
          "reviewed" | "liked" | "watched" | "watchlist" | "rated"
        > = [];

        // ✅ desired order:
        if (didWatched) actions.push("watched");
        if (didLiked) actions.push("liked");
        if (didRated) actions.push("rated");
        if (didReviewed) actions.push("reviewed");
        if (didWatchlist) actions.push("watchlist");

        // If somehow it collapses to only one action, don't group.
        if (actions.length < 2) {
          regrouped.push(...bucket);
          continue;
        }

        regrouped.push({
          id: `group-${bucketToSecond(logged_at)}-${title}`,
          kind: "group",
          type: "anime_series_group",
          title,
          logged_at,
          actions,
          stars,
          review_rating,
          review_content,
          contains_spoilers,
          log_rating,
          log_note,
          visibility,
        });
      }

      const finalItems = [...regrouped, ...passthrough].sort(
        (a, b) =>
          new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
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
        <ul className="space-y-4">
          {items.map((item) => {
            if (item.kind === "group") {
              const hs = clampInt(Number(item.stars ?? 0), 0, 10);
              const prefix = buildGroupedPrefix(item.actions);
              const hasWatchlist = item.actions.includes("watchlist");

              return (
                <li
                  key={`group-${item.id}`}
                  className="rounded-md border border-neutral-800 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">
                      {prefix}{" "}
                      <span className="font-bold text-black">{item.title}</span>
                      {hs > 0 ? <HalfStarsRow halfStars={hs} /> : null}
                      {hasWatchlist ? (
                        <span className="ml-1"> to your watchlist</span>
                      ) : null}
                      <span className="ml-1">
                        {" "}
                        on {formatOnFullDate(item.logged_at)}
                      </span>
                    </div>

                    <div className="whitespace-nowrap text-xs text-neutral-500">
                      {formatRelativeShort(item.logged_at)}
                    </div>
                  </div>

                  {/* ✅ grouped rows: NO "Rating:" line, and NO text boxes */}
                </li>
              );
            }

            if (item.kind === "mark" && item.type === "watched") {
              return (
                <li
                  key={`watched-${item.id}`}
                  className="rounded-md border border-neutral-800 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">
                      You marked{" "}
                      <span className="font-bold text-black">{item.title}</span>{" "}
                      as watched
                    </div>
                    <div className="whitespace-nowrap text-xs text-neutral-500">
                      {formatRelativeShort(item.logged_at)}
                    </div>
                  </div>
                </li>
              );
            }

            if (item.kind === "mark" && item.type === "liked") {
              return (
                <li
                  key={`liked-${item.id}`}
                  className="rounded-md border border-neutral-800 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">
                      You liked{" "}
                      <span className="font-bold text-black">{item.title}</span>
                    </div>
                    <div className="whitespace-nowrap text-xs text-neutral-500">
                      {formatRelativeShort(item.logged_at)}
                    </div>
                  </div>
                </li>
              );
            }

            if (item.kind === "mark" && item.type === "watchlist") {
              return (
                <li
                  key={`watchlist-${item.id}`}
                  className="rounded-md border border-neutral-800 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">
                      You added{" "}
                      <span className="font-bold text-black">{item.title}</span>{" "}
                      to your watchlist
                    </div>
                    <div className="whitespace-nowrap text-xs text-neutral-500">
                      {formatRelativeShort(item.logged_at)}
                    </div>
                  </div>
                </li>
              );
            }

            if (item.kind === "mark" && item.type === "rating") {
              const hs = clampInt(Number(item.stars ?? 0), 0, 10);

              return (
                <li
                  key={`rating-${item.id}`}
                  className="rounded-md border border-neutral-800 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">
                      You rated{" "}
                      <span className="font-bold text-black">{item.title}</span>
                      {hs > 0 ? <HalfStarsRow halfStars={hs} /> : null}
                    </div>
                    <div className="whitespace-nowrap text-xs text-neutral-500">
                      {formatRelativeShort(item.logged_at)}
                    </div>
                  </div>
                </li>
              );
            }

            if (item.kind === "review") {
              return (
                <li
                  key={`review-${item.id}`}
                  className="rounded-md border border-neutral-800 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">
                      You reviewed{" "}
                      <span className="font-bold text-black">{item.title}</span>
                    </div>
                    <div className="whitespace-nowrap text-xs text-neutral-500">
                      {formatRelativeShort(item.logged_at)}
                    </div>
                  </div>
                </li>
              );
            }

            if (item.kind !== "log") return null;

            if (item.type === "anime_series") {
              return (
                <li
                  key={`log-${item.type}-${item.id}`}
                  className="rounded-md border border-neutral-800 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">
                      You watched{" "}
                      <span className="font-bold text-black">{item.title}</span>{" "}
                      on {formatOnFullDate(item.logged_at)}
                    </div>
                    <div className="whitespace-nowrap text-xs text-neutral-500">
                      {formatRelativeShort(item.logged_at)}
                    </div>
                  </div>

                  {item.rating !== null && (
                    <div className="mt-2 text-sm">Rating: {item.rating}</div>
                  )}

                  {item.note && (
                    <div className="mt-1 line-clamp-2 text-sm text-neutral-400">
                      {item.note}
                    </div>
                  )}
                </li>
              );
            }

            // episode logs
            return (
              <li
                key={`log-${item.type}-${item.id}`}
                className="rounded-md border border-neutral-800 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-medium">
                    {item.title}
                    {item.subLabel && (
                      <span className="ml-2 text-neutral-400">
                        · {item.subLabel}
                      </span>
                    )}
                  </div>

                  <div className="whitespace-nowrap text-xs text-neutral-500">
                    {formatRelativeShort(item.logged_at)}
                  </div>
                </div>

                <div className="mt-1 text-xs text-neutral-500">
                  {item.type.replace("_", " ")}
                </div>

                {item.rating !== null && (
                  <div className="mt-2 text-sm">Rating: {item.rating}</div>
                )}

                {item.note && (
                  <div className="mt-1 line-clamp-2 text-sm text-neutral-400">
                    {item.note}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
};

export default AnimeActivityPage;
