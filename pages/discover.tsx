// pages/discover.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

import DiscoverHeroGrid from "@/components/discover/DiscoverHeroGrid";
import DiscoverSection from "@/components/discover/DiscoverSection";
import DiscoverJustReviewed from "@/components/discover/DiscoverJustReviewed";
import DiscoverPopularReviews from "@/components/discover/DiscoverPopularReviews";

import type {
  DiscoverHeroItem,
  DiscoverReviewItem,
  TopReviewWeeklyRow,
  DiscoverPopularReview,
  LatestReviewRow,
} from "@/components/discover/discoverTypes";

type TrendingRow = {
  slug: string;
  title: string;
  image_url: string | null;
  score: number | null;
};

function toScore(v: unknown) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
}

function clampText(s: string, max: number) {
  const t = (s ?? "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

/* -------------------- Skeletons -------------------- */

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-sm bg-slate-200 ${className}`} />;
}

function HeroGridSkeleton() {
  // Match DiscoverHeroGrid behavior:
  // - Mobile: 6 tiles (2 rows of 3)
  // - Desktop (md+): only 4 visible (1 row of 4)
  return (
    <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className={[
            "relative overflow-hidden rounded-sm border-2 border-black",
            "aspect-[2/3]",
            "bg-slate-200",
            "ring-1 ring-black/5",
            // Hide tiles 5-6 on desktop so it stays one row of 4
            i >= 4 ? "md:hidden" : "",
          ].join(" ")}
        >
          <div className="absolute left-1 top-1">
            <div className="animate-pulse rounded-sm bg-slate-100 h-4 w-12" />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/10 to-transparent" />
        </div>
      ))}
    </div>
  );
}

function JustReviewedSkeleton() {
  // matches: grid grid-cols-1 gap-3 sm:grid-cols-2
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="relative flex gap-1.5 sm:gap-3 rounded-xs bg-white pt-2 px-2 pb-2 border-2 border-black ring-1 ring-black/5"
        >
          {/* poster */}
          <SkeletonBlock className="h-20 w-15 shrink-0" />

          <div className="min-w-0 flex-1">
            {/* action row placeholder (top right) */}
            <div className="absolute right-1 top-1">
              <SkeletonBlock className="h-6 w-16 rounded-full" />
            </div>

            {/* avatar + username + meta */}
            <div className="flex items-center gap-2">
              <SkeletonBlock className="h-7 w-7 rounded-full" />
              <SkeletonBlock className="h-4 w-24" />
              <SkeletonBlock className="h-3 w-28" />
            </div>

            {/* title */}
            <div className="mt-2">
              <SkeletonBlock className="h-4 w-5/6" />
            </div>

            {/* snippet (2 lines) */}
            <div className="mt-2 space-y-2">
              <SkeletonBlock className="h-3 w-full" />
              <SkeletonBlock className="h-3 w-4/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PopularReviewsSkeleton() {
  // matches: grid grid-cols-1 gap-4, each card has rank + poster + right content
  return (
    <div className="grid grid-cols-1 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="block rounded-xs bg-white pt-2 pb-2 pl-1 pr-1 border-2 border-black"
        >
          <div className="flex items-start gap-1">
            {/* left column */}
            <div className="flex shrink-0 flex-col items-center">
              <SkeletonBlock className="h-5 w-5 rounded-full bg-slate-100" />
              <div className="mt-1 flex flex-col items-center gap-2 sm:hidden">
                <SkeletonBlock className="h-12 w-10 rounded-full" />
                <SkeletonBlock className="h-12 w-10 rounded-full" />
              </div>
            </div>

            {/* poster */}
            <SkeletonBlock className="h-20 w-14 mr-1 shrink-0 self-start rounded-xs" />

            {/* right content */}
            <div className="relative min-w-0 flex-1">
              {/* pc overlay actions placeholder */}
              <div className="absolute right-[-4px] top-[-6px] hidden sm:block">
                <SkeletonBlock className="h-6 w-20 rounded-full" />
              </div>

              {/* title */}
              <SkeletonBlock className="h-4 w-3/4" />

              {/* author row */}
              <div className="mt-2 flex items-center gap-2">
                <SkeletonBlock className="h-6 w-6 rounded-full" />
                <SkeletonBlock className="h-4 w-24" />
                <SkeletonBlock className="h-3 w-28" />
              </div>

              {/* snippet */}
              <div className="mt-2 space-y-2">
                <SkeletonBlock className="h-3 w-full" />
                <SkeletonBlock className="h-3 w-5/6" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------- Page -------------------- */

export default function DiscoverPage() {
  // hero
  const [animeRows, setAnimeRows] = useState<TrendingRow[]>([]);
  const [mangaRows, setMangaRows] = useState<TrendingRow[]>([]);
  const [heroLoading, setHeroLoading] = useState(true);
  const [heroError, setHeroError] = useState<string | null>(null);

  // popular reviews
  const [popularRows, setPopularRows] = useState<TopReviewWeeklyRow[]>([]);
  const [popularLoading, setPopularLoading] = useState(true);
  const [popularError, setPopularError] = useState<string | null>(null);

  // latest reviews
  const [latestRows, setLatestRows] = useState<LatestReviewRow[]>([]);
  const [latestLoading, setLatestLoading] = useState(true);
  const [latestError, setLatestError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHero() {
      setHeroLoading(true);
      setHeroError(null);

      try {
        const [animeRes, mangaRes] = await Promise.all([
          supabase
            .from("anime_weekly_trending")
            .select("slug, title, image_url, score")
            .order("score", { ascending: false })
            .limit(10),
          supabase
            .from("manga_weekly_trending")
            .select("slug, title, image_url, score")
            .order("score", { ascending: false })
            .limit(10),
        ]);

        if (animeRes.error) throw animeRes.error;
        if (mangaRes.error) throw mangaRes.error;

        if (cancelled) return;

        setAnimeRows((animeRes.data ?? []) as TrendingRow[]);
        setMangaRows((mangaRes.data ?? []) as TrendingRow[]);
      } catch (e: any) {
        if (!cancelled) {
          setHeroError(e?.message ?? "Failed to load hero posters.");
          setAnimeRows([]);
          setMangaRows([]);
        }
      } finally {
        if (!cancelled) setHeroLoading(false);
      }
    }

    async function loadPopularReviews() {
      setPopularLoading(true);
      setPopularError(null);

      try {
        const { data, error } = await supabase
          .from("top_review_weekly_with_numbers")
          .select(
            "review_id, author_id, author_username, author_avatar_url, anime_id, anime_slug, anime_title, anime_image_url, manga_id, manga_slug, manga_title, manga_image_url, content, created_at, replies_count, likes_count, score, anime_episode_id, manga_chapter_id, anime_episode_number, manga_chapter_number, post_id, rating"
          )
          .order("score", { ascending: false })
          .limit(12);

        if (error) throw error;
        if (cancelled) return;

        setPopularRows((data ?? []) as TopReviewWeeklyRow[]);
      } catch (e: any) {
        if (!cancelled) {
          setPopularError(e?.message ?? "Failed to load popular reviews.");
          setPopularRows([]);
        }
      } finally {
        if (!cancelled) setPopularLoading(false);
      }
    }

    async function loadLatestReviews() {
      setLatestLoading(true);
      setLatestError(null);

      try {
        const { data, error } = await supabase
          .from("latest_reviews")
          .select(
            "review_id, content, created_at, rating, author_id, author_username, author_avatar_url, anime_id, anime_slug, anime_title, anime_image_url, manga_id, manga_slug, manga_title, manga_image_url, anime_episode_id, manga_chapter_id, anime_episode_number, manga_chapter_number, post_id"
          )
          .order("created_at", { ascending: false })
          .limit(8);

        if (error) throw error;
        if (cancelled) return;

        setLatestRows((data ?? []) as LatestReviewRow[]);
      } catch (e: any) {
        if (!cancelled) {
          setLatestError(e?.message ?? "Failed to load newest reviews.");
          setLatestRows([]);
        }
      } finally {
        if (!cancelled) setLatestLoading(false);
      }
    }

    loadHero();
    loadPopularReviews();
    loadLatestReviews();

    return () => {
      cancelled = true;
    };
  }, []);

  const heroItems: DiscoverHeroItem[] = useMemo(() => {
    const a: DiscoverHeroItem[] = animeRows.map((r) => ({
      id: `anime-${r.slug}`,
      kind: "anime",
      slug: r.slug,
      title: r.title,
      posterUrl: r.image_url,
      score: toScore(r.score),
    }));

    const m: DiscoverHeroItem[] = mangaRows.map((r) => ({
      id: `manga-${r.slug}`,
      kind: "manga",
      slug: r.slug,
      title: r.title,
      posterUrl: r.image_url,
      score: toScore(r.score),
    }));

    return [...a, ...m].sort((x, y) => y.score - x.score).slice(0, 8);
  }, [animeRows, mangaRows]);

  const popularReviews: DiscoverPopularReview[] = useMemo(() => {
    return popularRows.map((r) => {
      const isAnime = !!r.anime_id;

      const kind: "anime" | "manga" = isAnime ? "anime" : "manga";
      const mediaSlug = isAnime ? r.anime_slug : r.manga_slug;
      const mediaTitleRaw = isAnime ? r.anime_title : r.manga_title;
      const mediaPosterUrl = isAnime ? r.anime_image_url : r.manga_image_url;

      return {
        reviewId: r.review_id,

        kind,
        mediaSlug: mediaSlug ?? null,
        mediaTitle: mediaTitleRaw ?? (isAnime ? "Anime" : "Manga"),
        mediaPosterUrl: mediaPosterUrl ?? null,

        authorUsername: r.author_username,
        authorAvatarUrl: r.author_avatar_url,

        createdAt: r.created_at,
        snippet: r.content ?? "",

        repliesCount: r.replies_count ?? 0,
        likesCount: r.likes_count ?? 0,
        score: r.score ?? 0,

        postId: r.post_id ?? null,
        rating: r.rating ?? null,
        animeEpisodeId: r.anime_episode_id ?? null,
        mangaChapterId: r.manga_chapter_id ?? null,

        animeEpisodeNumber: r.anime_episode_number ?? null,
        mangaChapterNumber:
          r.manga_chapter_number == null
            ? null
            : typeof r.manga_chapter_number === "number"
              ? r.manga_chapter_number
              : Number(r.manga_chapter_number),
      };
    });
  }, [popularRows]);

  const justReviewed: DiscoverReviewItem[] = useMemo(() => {
    return latestRows.map((r) => {
      const isAnime = !!r.anime_id;

      const kind: "anime" | "manga" = isAnime ? "anime" : "manga";
      const title =
        (isAnime ? r.anime_title : r.manga_title) ?? (isAnime ? "Anime" : "Manga");
      const posterUrl = (isAnime ? r.anime_image_url : r.manga_image_url) ?? null;

      return {
        id: r.review_id,
        kind,
        title,
        posterUrl,
        username: r.author_username,
        avatarUrl: r.author_avatar_url ?? null,
        createdAtLabel: "",
        snippet: clampText(r.content ?? "", 180),

        animeEpisodeId: r.anime_episode_id ?? null,
        mangaChapterId: r.manga_chapter_id ?? null,

        animeEpisodeNumber: r.anime_episode_number ?? null,
        mangaChapterNumber:
          r.manga_chapter_number == null
            ? null
            : typeof r.manga_chapter_number === "number"
              ? r.manga_chapter_number
              : Number(r.manga_chapter_number),

        postId: r.post_id ?? null,
        rating: r.rating ?? null,
      };
    });
  }, [latestRows]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-4">
      {/* Hero */}
      <DiscoverSection title="Most popular this week">
        {heroLoading ? (
          <HeroGridSkeleton />
        ) : heroError ? (
          <div className="text-sm text-red-600">{heroError}</div>
        ) : heroItems.length === 0 ? (
          <div className="text-sm text-slate-500">No activity yet this week.</div>
        ) : (
          <DiscoverHeroGrid items={heroItems} />
        )}
      </DiscoverSection>

      {/* Just reviewed */}
      <DiscoverSection title="Just reviewed">
        {latestLoading ? (
          <JustReviewedSkeleton />
        ) : latestError ? (
          <div className="text-sm text-red-600">{latestError}</div>
        ) : (
          <DiscoverJustReviewed items={justReviewed} />
        )}
      </DiscoverSection>

      {/* Popular reviews */}
      <DiscoverSection title="Popular reviews this week">
        {popularLoading ? (
          <PopularReviewsSkeleton />
        ) : popularError ? (
          <div className="text-sm text-red-600">{popularError}</div>
        ) : (
          <DiscoverPopularReviews items={popularReviews} />
        )}
      </DiscoverSection>
    </main>
  );
}
