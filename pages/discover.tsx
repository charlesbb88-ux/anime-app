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
          .from("top_review_weekly")
          .select(
            "review_id, author_id, author_username, author_avatar_url, anime_id, anime_slug, anime_title, anime_image_url, manga_id, manga_slug, manga_title, manga_image_url, content, created_at, replies_count, likes_count, score, anime_episode_id, manga_chapter_id, post_id, rating"
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

    return [...a, ...m].sort((x, y) => y.score - x.score).slice(0, 4);
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
      };
    });
  }, [popularRows]);

  const justReviewed: DiscoverReviewItem[] = useMemo(() => {
    return latestRows.map((r) => {
      const isAnime = !!r.anime_id;

      const kind: "anime" | "manga" = isAnime ? "anime" : "manga";
      const title = (isAnime ? r.anime_title : r.manga_title) ?? (isAnime ? "Anime" : "Manga");
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

        // ✅ NEW
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
          <div className="text-sm text-slate-500">Loading…</div>
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
          <div className="text-sm text-slate-500">Loading…</div>
        ) : latestError ? (
          <div className="text-sm text-red-600">{latestError}</div>
        ) : (
          <DiscoverJustReviewed items={justReviewed} />
        )}
      </DiscoverSection>

      {/* Popular reviews */}
      <DiscoverSection title="Popular reviews this week">
        {popularLoading ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : popularError ? (
          <div className="text-sm text-red-600">{popularError}</div>
        ) : (
          <DiscoverPopularReviews items={popularReviews} />
        )}
      </DiscoverSection>
    </main>
  );
}