"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { useRouter } from "next/router";

import { supabase } from "@/lib/supabaseClient";
import { getAnimeBySlug } from "@/lib/anime";

type ActivityItem =
  | {
      id: string;
      kind: "log";
      type: "anime_episode";
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
      type: "anime_episode_review";
      title: string;
      subLabel?: string;
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
      subLabel?: string;
      logged_at: string;
      // rating uses HALF-STARS stored as 1..10
      stars?: number | null;
    };

function getAnimeDisplayTitle(anime: any): string {
  return (
    anime?.title_english ||
    anime?.title_romaji ||
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

/* -------------------- Half-star visuals (same idea as ActionBox) -------------------- */

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

const AnimeEpisodeActivityPage: NextPage = () => {
  const router = useRouter();
  const { slug, episodeNumber } = router.query as {
    slug?: string;
    episodeNumber?: string;
  };

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

      // prevent "Loading…" getting stuck on first render timing
      if (!slug || !episodeNumber) {
        if (mounted) setLoading(false);
        return;
      }

      const epNum = Number(episodeNumber);
      if (!Number.isFinite(epNum)) {
        setError("Invalid episode number.");
        setLoading(false);
        return;
      }

      const res: any = await getAnimeBySlug(slug);
      const anime = res?.data ?? null;
      const animeErr = res?.error ?? null;

      if (!mounted) return;

      if (animeErr || !anime?.id) {
        setError("Anime not found.");
        setLoading(false);
        return;
      }

      const animeTitle = getAnimeDisplayTitle(anime);

      // ✅ find the episode row for this anime + episode_number
      const episodeRes = await supabase
        .from("anime_episodes")
        .select("id, episode_number")
        .eq("anime_id", anime.id)
        .eq("episode_number", epNum)
        .maybeSingle();

      if (!mounted) return;

      if (episodeRes.error) {
        console.error("Episode activity: episode lookup error", episodeRes.error);
      }

      const episodeRow = episodeRes.data ?? null;
      if (!episodeRow?.id) {
        setError(`Episode ${epNum} not found.`);
        setLoading(false);
        return;
      }

      setPageTitle(`Your activity · ${animeTitle} · Episode ${epNum}`);

      const [episodeLogs, episodeReviews, watchedMark, likedMark, watchlistMark, ratingMark] =
        await Promise.all([
          supabase
            .from("anime_episode_logs")
            .select("id, logged_at, rating, note, visibility")
            .eq("user_id", user.id)
            .eq("anime_id", anime.id)
            .eq("anime_episode_id", episodeRow.id)
            .order("logged_at", { ascending: false }),

          // ✅ Reviews table: episode review = anime_id set AND anime_episode_id = this episode
          supabase
            .from("reviews")
            .select("id, created_at, rating, content, contains_spoilers")
            .eq("user_id", user.id)
            .eq("anime_id", anime.id)
            .eq("anime_episode_id", episodeRow.id)
            .order("created_at", { ascending: false }),

          supabase
            .from("user_marks")
            .select("id, created_at")
            .eq("user_id", user.id)
            .eq("kind", "watched")
            .eq("anime_id", anime.id)
            .eq("anime_episode_id", episodeRow.id)
            .is("manga_id", null)
            .is("manga_chapter_id", null)
            .maybeSingle(),

          supabase
            .from("user_marks")
            .select("id, created_at")
            .eq("user_id", user.id)
            .eq("kind", "liked")
            .eq("anime_id", anime.id)
            .eq("anime_episode_id", episodeRow.id)
            .is("manga_id", null)
            .is("manga_chapter_id", null)
            .maybeSingle(),

          supabase
            .from("user_marks")
            .select("id, created_at")
            .eq("user_id", user.id)
            .eq("kind", "watchlist")
            .eq("anime_id", anime.id)
            .eq("anime_episode_id", episodeRow.id)
            .is("manga_id", null)
            .is("manga_chapter_id", null)
            .maybeSingle(),

          supabase
            .from("user_marks")
            .select("id, created_at, stars")
            .eq("user_id", user.id)
            .eq("kind", "rating")
            .eq("anime_id", anime.id)
            .eq("anime_episode_id", episodeRow.id)
            .is("manga_id", null)
            .is("manga_chapter_id", null)
            .maybeSingle(),
        ]);

      if (!mounted) return;

      if (episodeLogs.error) console.error("Episode activity: episodeLogs error", episodeLogs.error);
      if (episodeReviews.error)
        console.error("Episode activity: episodeReviews error", episodeReviews.error);

      const merged: ActivityItem[] = [];
      const subLabel = `Episode ${epNum}`;

      if (watchedMark.data?.id) {
        merged.push({
          id: watchedMark.data.id,
          kind: "mark",
          type: "watched",
          title: animeTitle,
          subLabel,
          logged_at: watchedMark.data.created_at,
        });
      }

      if (likedMark.data?.id) {
        merged.push({
          id: likedMark.data.id,
          kind: "mark",
          type: "liked",
          title: animeTitle,
          subLabel,
          logged_at: likedMark.data.created_at,
        });
      }

      if (watchlistMark.data?.id) {
        merged.push({
          id: watchlistMark.data.id,
          kind: "mark",
          type: "watchlist",
          title: animeTitle,
          subLabel,
          logged_at: watchlistMark.data.created_at,
        });
      }

      if (ratingMark.data?.id) {
        merged.push({
          id: ratingMark.data.id,
          kind: "mark",
          type: "rating",
          title: animeTitle,
          subLabel,
          logged_at: ratingMark.data.created_at,
          stars: ratingMark.data.stars ?? null,
        });
      }

      episodeReviews.data?.forEach((row: any) => {
        merged.push({
          id: row.id,
          kind: "review",
          type: "anime_episode_review",
          title: animeTitle,
          subLabel,
          logged_at: row.created_at,
          rating: typeof row.rating === "number" ? row.rating : null,
          content: row.content ?? null,
          contains_spoilers: Boolean(row.contains_spoilers),
        });
      });

      episodeLogs.data?.forEach((row: any) => {
        merged.push({
          id: row.id,
          kind: "log",
          type: "anime_episode",
          title: animeTitle,
          subLabel,
          rating: row.rating,
          note: row.note,
          logged_at: row.logged_at,
          visibility: row.visibility,
        });
      });

      merged.sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());

      setItems(merged);
      setLoading(false);
    }

    run();

    return () => {
      mounted = false;
    };
  }, [router, slug, episodeNumber]);

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
            if (item.kind === "mark" && item.type === "watched") {
              return (
                <li key={`watched-${item.id}`} className="rounded-md border border-neutral-800 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">
                      You marked <span className="font-bold text-black">{item.title}</span> as
                      watched
                      {item.subLabel ? <span className="ml-2 text-neutral-400">· {item.subLabel}</span> : null}
                    </div>

                    <div className="text-xs text-neutral-500 whitespace-nowrap">
                      {formatRelativeShort(item.logged_at)}
                    </div>
                  </div>
                </li>
              );
            }

            if (item.kind === "mark" && item.type === "liked") {
              return (
                <li key={`liked-${item.id}`} className="rounded-md border border-neutral-800 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">
                      You liked <span className="font-bold text-black">{item.title}</span>
                      {item.subLabel ? <span className="ml-2 text-neutral-400">· {item.subLabel}</span> : null}
                    </div>

                    <div className="text-xs text-neutral-500 whitespace-nowrap">
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
                      You added <span className="font-bold text-black">{item.title}</span> to your
                      watchlist
                      {item.subLabel ? <span className="ml-2 text-neutral-400">· {item.subLabel}</span> : null}
                    </div>

                    <div className="text-xs text-neutral-500 whitespace-nowrap">
                      {formatRelativeShort(item.logged_at)}
                    </div>
                  </div>
                </li>
              );
            }

            if (item.kind === "mark" && item.type === "rating") {
              const hs = clampInt(Number(item.stars ?? 0), 0, 10);

              return (
                <li key={`rating-${item.id}`} className="rounded-md border border-neutral-800 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">
                      You rated <span className="font-bold text-black">{item.title}</span>
                      {item.subLabel ? <span className="ml-2 text-neutral-400">· {item.subLabel}</span> : null}
                      {hs > 0 ? <HalfStarsRow halfStars={hs} /> : null}
                    </div>

                    <div className="text-xs text-neutral-500 whitespace-nowrap">
                      {formatRelativeShort(item.logged_at)}
                    </div>
                  </div>
                </li>
              );
            }

            if (item.kind === "review") {
              return (
                <li key={`review-${item.id}`} className="rounded-md border border-neutral-800 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">
                      You reviewed <span className="font-bold text-black">{item.title}</span>
                      {item.subLabel ? <span className="ml-2 text-neutral-400">· {item.subLabel}</span> : null}
                    </div>

                    <div className="text-xs text-neutral-500 whitespace-nowrap">
                      {formatRelativeShort(item.logged_at)}
                    </div>
                  </div>
                </li>
              );
            }

            if (item.kind !== "log") return null;

            return (
              <li
                key={`log-${item.type}-${item.id}`}
                className="rounded-md border border-neutral-800 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-medium">
                    You watched <span className="font-bold text-black">{item.title}</span>{" "}
                    {item.subLabel ? <span className="ml-2 text-neutral-400">· {item.subLabel}</span> : null}
                    {" "}on {formatOnFullDate(item.logged_at)}
                  </div>

                  <div className="text-xs text-neutral-500 whitespace-nowrap">
                    {formatRelativeShort(item.logged_at)}
                  </div>
                </div>

                {item.rating !== null && <div className="mt-2 text-sm">Rating: {item.rating}</div>}

                {item.note && (
                  <div className="mt-1 text-sm text-neutral-400 line-clamp-2">{item.note}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
};

export default AnimeEpisodeActivityPage;
