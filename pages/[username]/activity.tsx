// pages/[username]/activity.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import Link from "next/link";

import { supabase } from "@/lib/supabaseClient";
import ProfileLayout from "@/components/profile/ProfileLayout";

const CARD_CLASS = "bg-black p-4 text-neutral-100";

function postHref(postId: string) {
  return `/posts/${postId}`;
}

type Visibility = "public" | "friends" | "private";

/* ---------------------------------- Types --------------------------------- */

type ActivityItem =
  | {
      id: string;
      kind: "log";
      domain: "anime" | "manga";
      scope: "series" | "episode" | "chapter";

      // routing + labeling
      anime_id?: string | null;
      anime_episode_id?: string | null;
      manga_id?: string | null;
      manga_chapter_id?: string | null;

      title: string;
      subLabel?: string;

      rating: number | null; // 0..100 or 1..10 depending on your data
      note: string | null; // episode pages never show notes; here we keep null for episodes
      logged_at: string;
      visibility: Visibility;

      liked?: boolean | null;
      review_id?: string | null;
    }
  | {
      id: string;
      kind: "review";
      domain: "anime" | "manga";
      scope: "series" | "episode" | "chapter";

      anime_id?: string | null;
      anime_episode_id?: string | null;
      manga_id?: string | null;
      manga_chapter_id?: string | null;

      title: string;
      subLabel?: string;

      logged_at: string; // reviews.created_at
      rating: number | null;
      content: string | null;
      contains_spoilers: boolean;
    }
  | {
      id: string;
      kind: "mark";
      domain: "anime" | "manga";
      scope: "series" | "episode" | "chapter";

      anime_id?: string | null;
      anime_episode_id?: string | null;
      manga_id?: string | null;
      manga_chapter_id?: string | null;

      type: "watched" | "liked" | "watchlist" | "rating";
      title: string;
      subLabel?: string;

      logged_at: string; // user_marks.created_at
      stars?: number | null; // half-stars 1..10 (rating mark)
    };

/* --------------------------------- Helpers -------------------------------- */

function getAnimeDisplayTitle(anime: any): string {
  return (
    anime?.title_english ||
    anime?.title_preferred ||
    anime?.title_native ||
    anime?.title ||
    "Unknown anime"
  );
}

function getMangaDisplayTitle(manga: any): string {
  return (
    manga?.title_english ||
    manga?.title_preferred ||
    manga?.title_native ||
    manga?.title ||
    "Unknown manga"
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

// Convert a 0..100 rating to half-stars 1..10
function rating100ToHalfStars(rating: number | null): number | null {
  if (typeof rating !== "number" || !Number.isFinite(rating)) return null;
  const clamped = clampInt(rating, 0, 100);
  if (clamped <= 0) return null;
  return clampInt(Math.round(clamped / 10), 1, 10);
}

// Flexible: if your logs store 1..10 already, use it directly; else treat as 0..100.
function ratingToHalfStarsFlexible(rating: number | null): number | null {
  if (typeof rating !== "number" || !Number.isFinite(rating)) return null;
  if (rating <= 0) return null;

  if (rating <= 10) return clampInt(rating, 1, 10);
  return rating100ToHalfStars(rating);
}

function joinWithCommasAnd(parts: string[]) {
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function actionWordAnime(a: "reviewed" | "liked" | "watched" | "rated") {
  if (a === "rated") return "rated";
  if (a === "reviewed") return "reviewed";
  if (a === "liked") return "liked";
  return "watched";
}

function buildSnapshotPrefixAnime(actions: Array<"reviewed" | "liked" | "watched" | "rated">) {
  return `You ${joinWithCommasAnd(actions.map(actionWordAnime))}`;
}

function actionWordMangaSeries(a: "reviewed" | "liked" | "watched" | "rated") {
  if (a === "rated") return "rated";
  if (a === "reviewed") return "reviewed";
  if (a === "liked") return "liked";
  return "watched";
}

function buildSnapshotPrefixMangaSeries(
  actions: Array<"reviewed" | "liked" | "watched" | "rated">
) {
  return `You ${joinWithCommasAnd(actions.map(actionWordMangaSeries))}`;
}

function actionWordMangaChapter(a: "reviewed" | "liked" | "read" | "rated") {
  if (a === "rated") return "rated";
  if (a === "reviewed") return "reviewed";
  if (a === "liked") return "liked";
  return "read";
}

function buildSnapshotPrefixMangaChapter(
  actions: Array<"reviewed" | "liked" | "read" | "rated">
) {
  return `You ${joinWithCommasAnd(actions.map(actionWordMangaChapter))}`;
}

function markVerb(domain: "anime" | "manga", scope: "series" | "episode" | "chapter", kind: "watched") {
  // anime watched, manga series watched (matches your existing), manga chapter read
  if (domain === "manga" && scope === "chapter") return "read";
  return "watched";
}

/* -------------------------------- Body -------------------------------- */

function ActivityBody({ profileId, username }: { profileId: string; username?: string }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<ActivityItem[]>([]);
  const [feedLimit, setFeedLimit] = useState(20);
  const prefetchLimit = Math.max(120, feedLimit * 3);

  const [reviewIdToPostId, setReviewIdToPostId] = useState<Record<string, string>>({});

  const pageTitle = useMemo(() => {
    if (!username) return "Activity";
    return `${username} · Activity`;
  }, [username]);

  useEffect(() => {
    let mounted = true;

    async function run() {
      // “Load more” behavior
      if (feedLimit > 20) setLoadingMore(true);
      else setLoading(true);

      setError(null);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (!user || userErr) {
        if (!mounted) return;
        setLoading(false);
        setLoadingMore(false);
        router.replace("/login");
        return;
      }

      // Safety: only allow viewing your own activity
      if (profileId !== user.id) {
        if (!mounted) return;
        setError("You can only view your own activity.");
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const uid = profileId;

      const [
        animeSeriesLogsRes,
        animeEpisodeLogsRes,
        mangaSeriesLogsRes,
        mangaChapterLogsRes,

        reviewsRes,

        marksRes,
      ] = await Promise.all([
        supabase
          .from("anime_series_logs")
          .select("id, anime_id, logged_at, rating, note, visibility, liked, review_id")
          .eq("user_id", uid)
          .order("logged_at", { ascending: false })
          .limit(prefetchLimit),

        supabase
          .from("anime_episode_logs")
          .select("id, anime_id, anime_episode_id, logged_at, rating, note, visibility, liked, review_id")
          .eq("user_id", uid)
          .order("logged_at", { ascending: false })
          .limit(prefetchLimit),

        supabase
          .from("manga_series_logs")
          .select("id, manga_id, logged_at, rating, note, visibility, liked, review_id")
          .eq("user_id", uid)
          .order("logged_at", { ascending: false })
          .limit(prefetchLimit),

        supabase
          .from("manga_chapter_logs")
          .select("id, manga_id, manga_chapter_id, logged_at, rating, note, visibility, liked, review_id")
          .eq("user_id", uid)
          .order("logged_at", { ascending: false })
          .limit(prefetchLimit),

        supabase
          .from("reviews")
          .select(
            "id, created_at, rating, content, contains_spoilers, anime_id, anime_episode_id, manga_id, manga_chapter_id"
          )
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(prefetchLimit),

        supabase
          .from("user_marks")
          .select("id, kind, created_at, stars, anime_id, anime_episode_id, manga_id, manga_chapter_id")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(prefetchLimit),
      ]);

      if (!mounted) return;

      // Build ID sets
      const animeIds = new Set<string>();
      const mangaIds = new Set<string>();
      const animeEpisodeIds = new Set<string>();
      const mangaChapterIds = new Set<string>();

      for (const r of animeSeriesLogsRes.data ?? []) if ((r as any)?.anime_id) animeIds.add(String((r as any).anime_id));
      for (const r of animeEpisodeLogsRes.data ?? []) {
        if ((r as any)?.anime_id) animeIds.add(String((r as any).anime_id));
        if ((r as any)?.anime_episode_id) animeEpisodeIds.add(String((r as any).anime_episode_id));
      }
      for (const r of mangaSeriesLogsRes.data ?? []) if ((r as any)?.manga_id) mangaIds.add(String((r as any).manga_id));
      for (const r of mangaChapterLogsRes.data ?? []) {
        if ((r as any)?.manga_id) mangaIds.add(String((r as any).manga_id));
        if ((r as any)?.manga_chapter_id) mangaChapterIds.add(String((r as any).manga_chapter_id));
      }

      for (const r of reviewsRes.data ?? []) {
        if ((r as any)?.anime_id) animeIds.add(String((r as any).anime_id));
        if ((r as any)?.anime_episode_id) animeEpisodeIds.add(String((r as any).anime_episode_id));
        if ((r as any)?.manga_id) mangaIds.add(String((r as any).manga_id));
        if ((r as any)?.manga_chapter_id) mangaChapterIds.add(String((r as any).manga_chapter_id));
      }

      for (const r of marksRes.data ?? []) {
        if ((r as any)?.anime_id) animeIds.add(String((r as any).anime_id));
        if ((r as any)?.anime_episode_id) animeEpisodeIds.add(String((r as any).anime_episode_id));
        if ((r as any)?.manga_id) mangaIds.add(String((r as any).manga_id));
        if ((r as any)?.manga_chapter_id) mangaChapterIds.add(String((r as any).manga_chapter_id));
      }

      // Resolve titles + episode/chapter numbers
      const [animeRes, mangaRes, epsRes, chRes] = await Promise.all([
        animeIds.size
          ? supabase
              .from("anime")
              .select("id, title, title_english, title_native, title_preferred")
              .in("id", Array.from(animeIds).slice(0, 1000))
          : Promise.resolve({ data: [], error: null } as any),

        mangaIds.size
          ? supabase
              .from("manga")
              .select("id, title, title_english, title_native, title_preferred")
              .in("id", Array.from(mangaIds).slice(0, 1000))
          : Promise.resolve({ data: [], error: null } as any),

        animeEpisodeIds.size
          ? supabase.from("anime_episodes").select("id, anime_id, episode_number").in("id", Array.from(animeEpisodeIds).slice(0, 1000))
          : Promise.resolve({ data: [], error: null } as any),

        mangaChapterIds.size
          ? supabase.from("manga_chapters").select("id, manga_id, chapter_number").in("id", Array.from(mangaChapterIds).slice(0, 1000))
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (!mounted) return;

      const animeIdToTitle: Record<string, string> = {};
      const mangaIdToTitle: Record<string, string> = {};
      const animeEpisodeIdToLabel: Record<string, { anime_id: string | null; subLabel: string }> = {};
      const mangaChapterIdToLabel: Record<string, { manga_id: string | null; subLabel: string }> = {};

      for (const a of (animeRes as any)?.data ?? []) {
        if (!a?.id) continue;
        animeIdToTitle[String(a.id)] = getAnimeDisplayTitle(a);
      }

      for (const m of (mangaRes as any)?.data ?? []) {
        if (!m?.id) continue;
        mangaIdToTitle[String(m.id)] = getMangaDisplayTitle(m);
      }

      for (const e of (epsRes as any)?.data ?? []) {
        if (!e?.id) continue;
        const n = e?.episode_number;
        const label = n != null && n !== "" ? `Episode ${n}` : "Episode";
        animeEpisodeIdToLabel[String(e.id)] = { anime_id: e?.anime_id ? String(e.anime_id) : null, subLabel: label };
      }

      for (const c of (chRes as any)?.data ?? []) {
        if (!c?.id) continue;
        const n = c?.chapter_number;
        const label = n != null && n !== "" ? `Chapter ${n}` : "Chapter";
        mangaChapterIdToLabel[String(c.id)] = { manga_id: c?.manga_id ? String(c.manga_id) : null, subLabel: label };
      }

      // Build review_id -> post_id map
      const reviewIdsToResolve = new Set<string>();

      for (const row of animeSeriesLogsRes.data ?? []) if ((row as any)?.review_id) reviewIdsToResolve.add(String((row as any).review_id));
      for (const row of animeEpisodeLogsRes.data ?? []) if ((row as any)?.review_id) reviewIdsToResolve.add(String((row as any).review_id));
      for (const row of mangaSeriesLogsRes.data ?? []) if ((row as any)?.review_id) reviewIdsToResolve.add(String((row as any).review_id));
      for (const row of mangaChapterLogsRes.data ?? []) if ((row as any)?.review_id) reviewIdsToResolve.add(String((row as any).review_id));
      for (const r of reviewsRes.data ?? []) if ((r as any)?.id) reviewIdsToResolve.add(String((r as any).id));

      let nextReviewIdToPostId: Record<string, string> = {};

      if (reviewIdsToResolve.size > 0) {
        const list = Array.from(reviewIdsToResolve);

        const postsRes = await supabase
          .from("posts")
          .select("id, review_id")
          .eq("user_id", uid)
          .in("review_id", list.slice(0, 1000));

        if (postsRes.data) {
          for (const p of postsRes.data as any[]) {
            if (!p?.id || !p?.review_id) continue;
            nextReviewIdToPostId[String(p.review_id)] = String(p.id);
          }
        }
      }

      if (mounted) setReviewIdToPostId(nextReviewIdToPostId);

      // Suppression helpers
      const attachedReviewIds = new Set<string>();
      for (const row of animeSeriesLogsRes.data ?? []) if ((row as any)?.review_id) attachedReviewIds.add(String((row as any).review_id));
      for (const row of animeEpisodeLogsRes.data ?? []) if ((row as any)?.review_id) attachedReviewIds.add(String((row as any).review_id));
      for (const row of mangaSeriesLogsRes.data ?? []) if ((row as any)?.review_id) attachedReviewIds.add(String((row as any).review_id));
      for (const row of mangaChapterLogsRes.data ?? []) if ((row as any)?.review_id) attachedReviewIds.add(String((row as any).review_id));

      type Snap = { ms: number | null; hasWatchedOrRead: boolean; liked: boolean; hasRating: boolean };
      const targetToSnaps: Record<string, Snap[]> = {};

      function addSnap(targetKey: string, iso: string, liked: any, rating: any) {
        const ms = new Date(String(iso ?? "")).getTime();
        const hs = ratingToHalfStarsFlexible(typeof rating === "number" ? rating : null);
        const snap: Snap = {
          ms: Number.isFinite(ms) ? ms : null,
          hasWatchedOrRead: true,
          liked: typeof liked === "boolean" ? liked : Boolean(liked),
          hasRating: hs !== null,
        };
        if (!targetToSnaps[targetKey]) targetToSnaps[targetKey] = [];
        targetToSnaps[targetKey].push(snap);
      }

      for (const row of animeSeriesLogsRes.data ?? []) {
        if (!(row as any)?.anime_id) continue;
        addSnap(`anime:series:${String((row as any).anime_id)}`, (row as any).logged_at, (row as any).liked, (row as any).rating);
      }
      for (const row of animeEpisodeLogsRes.data ?? []) {
        if (!(row as any)?.anime_episode_id) continue;
        addSnap(`anime:episode:${String((row as any).anime_episode_id)}`, (row as any).logged_at, (row as any).liked, (row as any).rating);
      }
      for (const row of mangaSeriesLogsRes.data ?? []) {
        if (!(row as any)?.manga_id) continue;
        addSnap(`manga:series:${String((row as any).manga_id)}`, (row as any).logged_at, (row as any).liked, (row as any).rating);
      }
      for (const row of mangaChapterLogsRes.data ?? []) {
        if (!(row as any)?.manga_chapter_id) continue;
        addSnap(`manga:chapter:${String((row as any).manga_chapter_id)}`, (row as any).logged_at, (row as any).liked, (row as any).rating);
      }

      function shouldSuppressMark(
        markType: "watched" | "liked" | "rating" | "watchlist",
        createdAtIso: string,
        targetKey: string
      ) {
        if (markType === "watchlist") return false;

        const markMs = new Date(createdAtIso).getTime();
        if (!Number.isFinite(markMs)) return false;

        const snaps = targetToSnaps[targetKey] ?? [];
        const windowMs = 2 * 60 * 1000;

        for (const s of snaps) {
          if (s.ms == null) continue;
          const diff = Math.abs(markMs - s.ms);
          if (diff > windowMs) continue;

          if (markType === "watched" && s.hasWatchedOrRead) return true;
          if (markType === "liked" && s.liked) return true;
          if (markType === "rating" && s.hasRating) return true;
        }

        return false;
      }

      // Merge
      const merged: ActivityItem[] = [];

      // ----- LOGS -----
      for (const row of animeSeriesLogsRes.data ?? []) {
        const anime_id = (row as any)?.anime_id ? String((row as any).anime_id) : null;
        if (!anime_id) continue;

        const title = animeIdToTitle[anime_id] ?? "Unknown anime";

        merged.push({
          id: String((row as any).id),
          kind: "log",
          domain: "anime",
          scope: "series",
          anime_id,
          title,
          rating: typeof (row as any).rating === "number" ? (row as any).rating : null,
          note: (row as any).note ?? null,
          logged_at: String((row as any).logged_at),
          visibility: ((row as any).visibility as Visibility) ?? "public",
          liked: typeof (row as any).liked === "boolean" ? (row as any).liked : Boolean((row as any).liked),
          review_id: (row as any).review_id ?? null,
        });
      }

      for (const row of animeEpisodeLogsRes.data ?? []) {
        const anime_episode_id = (row as any)?.anime_episode_id ? String((row as any).anime_episode_id) : null;
        if (!anime_episode_id) continue;

        const ep = animeEpisodeIdToLabel[anime_episode_id] ?? { anime_id: null, subLabel: "Episode" };
        const anime_id = ep.anime_id ?? ((row as any)?.anime_id ? String((row as any).anime_id) : null);
        const title = anime_id && animeIdToTitle[anime_id] ? animeIdToTitle[anime_id] : "Unknown anime";

        merged.push({
          id: String((row as any).id),
          kind: "log",
          domain: "anime",
          scope: "episode",
          anime_id,
          anime_episode_id,
          title,
          subLabel: ep.subLabel,
          rating: typeof (row as any).rating === "number" ? (row as any).rating : null,
          note: null,
          logged_at: String((row as any).logged_at),
          visibility: ((row as any).visibility as Visibility) ?? "public",
          liked: typeof (row as any).liked === "boolean" ? (row as any).liked : Boolean((row as any).liked),
          review_id: (row as any).review_id ?? null,
        });
      }

      for (const row of mangaSeriesLogsRes.data ?? []) {
        const manga_id = (row as any)?.manga_id ? String((row as any).manga_id) : null;
        if (!manga_id) continue;

        const title = mangaIdToTitle[manga_id] ?? "Unknown manga";

        merged.push({
          id: String((row as any).id),
          kind: "log",
          domain: "manga",
          scope: "series",
          manga_id,
          title,
          rating: typeof (row as any).rating === "number" ? (row as any).rating : null,
          note: (row as any).note ?? null,
          logged_at: String((row as any).logged_at),
          visibility: ((row as any).visibility as Visibility) ?? "public",
          liked: typeof (row as any).liked === "boolean" ? (row as any).liked : Boolean((row as any).liked),
          review_id: (row as any).review_id ?? null,
        });
      }

      for (const row of mangaChapterLogsRes.data ?? []) {
        const manga_chapter_id = (row as any)?.manga_chapter_id ? String((row as any).manga_chapter_id) : null;
        if (!manga_chapter_id) continue;

        const ch = mangaChapterIdToLabel[manga_chapter_id] ?? { manga_id: null, subLabel: "Chapter" };
        const manga_id = ch.manga_id ?? ((row as any)?.manga_id ? String((row as any).manga_id) : null);
        const title = manga_id && mangaIdToTitle[manga_id] ? mangaIdToTitle[manga_id] : "Unknown manga";

        merged.push({
          id: String((row as any).id),
          kind: "log",
          domain: "manga",
          scope: "chapter",
          manga_id,
          manga_chapter_id,
          title,
          subLabel: ch.subLabel,
          rating: typeof (row as any).rating === "number" ? (row as any).rating : null,
          note: (row as any).note ?? null,
          logged_at: String((row as any).logged_at),
          visibility: ((row as any).visibility as Visibility) ?? "public",
          liked: typeof (row as any).liked === "boolean" ? (row as any).liked : Boolean((row as any).liked),
          review_id: (row as any).review_id ?? null,
        });
      }

      // ----- REVIEWS (standalone only if not attached to logs) -----
      for (const row of reviewsRes.data ?? []) {
        if (!(row as any)?.id || !(row as any)?.created_at) continue;
        if (attachedReviewIds.has(String((row as any).id))) continue;

        const anime_id = (row as any)?.anime_id ? String((row as any).anime_id) : null;
        const anime_episode_id = (row as any)?.anime_episode_id ? String((row as any).anime_episode_id) : null;
        const manga_id = (row as any)?.manga_id ? String((row as any).manga_id) : null;
        const manga_chapter_id = (row as any)?.manga_chapter_id ? String((row as any).manga_chapter_id) : null;

        if (anime_episode_id) {
          const ep = animeEpisodeIdToLabel[anime_episode_id] ?? { anime_id, subLabel: "Episode" };
          const aid = ep.anime_id ?? anime_id;
          const title = aid && animeIdToTitle[aid] ? animeIdToTitle[aid] : "Unknown anime";

          merged.push({
            id: String((row as any).id),
            kind: "review",
            domain: "anime",
            scope: "episode",
            anime_id: aid ?? null,
            anime_episode_id,
            title,
            subLabel: ep.subLabel,
            logged_at: String((row as any).created_at),
            rating: typeof (row as any).rating === "number" ? (row as any).rating : null,
            content: (row as any).content ?? null,
            contains_spoilers: Boolean((row as any).contains_spoilers),
          });
          continue;
        }

        if (anime_id) {
          const title = animeIdToTitle[anime_id] ?? "Unknown anime";
          merged.push({
            id: String((row as any).id),
            kind: "review",
            domain: "anime",
            scope: "series",
            anime_id,
            title,
            logged_at: String((row as any).created_at),
            rating: typeof (row as any).rating === "number" ? (row as any).rating : null,
            content: (row as any).content ?? null,
            contains_spoilers: Boolean((row as any).contains_spoilers),
          });
          continue;
        }

        if (manga_chapter_id) {
          const ch = mangaChapterIdToLabel[manga_chapter_id] ?? { manga_id, subLabel: "Chapter" };
          const mid = ch.manga_id ?? manga_id;
          const title = mid && mangaIdToTitle[mid] ? mangaIdToTitle[mid] : "Unknown manga";

          merged.push({
            id: String((row as any).id),
            kind: "review",
            domain: "manga",
            scope: "chapter",
            manga_id: mid ?? null,
            manga_chapter_id,
            title,
            subLabel: ch.subLabel,
            logged_at: String((row as any).created_at),
            rating: typeof (row as any).rating === "number" ? (row as any).rating : null,
            content: (row as any).content ?? null,
            contains_spoilers: Boolean((row as any).contains_spoilers),
          });
          continue;
        }

        if (manga_id) {
          const title = mangaIdToTitle[manga_id] ?? "Unknown manga";
          merged.push({
            id: String((row as any).id),
            kind: "review",
            domain: "manga",
            scope: "series",
            manga_id,
            title,
            logged_at: String((row as any).created_at),
            rating: typeof (row as any).rating === "number" ? (row as any).rating : null,
            content: (row as any).content ?? null,
            contains_spoilers: Boolean((row as any).contains_spoilers),
          });
        }
      }

      // ----- MARKS (suppress if duplicate of log submit) -----
      for (const row of marksRes.data ?? []) {
        if (!(row as any)?.id || !(row as any)?.created_at || !(row as any)?.kind) continue;

        const createdAt = String((row as any).created_at);
        const type = String((row as any).kind) as "watched" | "liked" | "watchlist" | "rating";
        if (!["watched", "liked", "watchlist", "rating"].includes(type)) continue;

        const anime_id = (row as any)?.anime_id ? String((row as any).anime_id) : null;
        const anime_episode_id = (row as any)?.anime_episode_id ? String((row as any).anime_episode_id) : null;
        const manga_id = (row as any)?.manga_id ? String((row as any).manga_id) : null;
        const manga_chapter_id = (row as any)?.manga_chapter_id ? String((row as any).manga_chapter_id) : null;

        if (anime_episode_id) {
          const ep = animeEpisodeIdToLabel[anime_episode_id] ?? { anime_id, subLabel: "Episode" };
          const aid = ep.anime_id ?? anime_id;
          const title = aid && animeIdToTitle[aid] ? animeIdToTitle[aid] : "Unknown anime";
          const targetKey = `anime:episode:${anime_episode_id}`;

          if (shouldSuppressMark(type, createdAt, targetKey)) continue;

          merged.push({
            id: String((row as any).id),
            kind: "mark",
            domain: "anime",
            scope: "episode",
            type,
            anime_id: aid ?? null,
            anime_episode_id,
            title,
            subLabel: ep.subLabel,
            logged_at: createdAt,
            stars: type === "rating" ? ((row as any).stars ?? null) : undefined,
          });
          continue;
        }

        if (anime_id) {
          const title = animeIdToTitle[anime_id] ?? "Unknown anime";
          const targetKey = `anime:series:${anime_id}`;

          if (shouldSuppressMark(type, createdAt, targetKey)) continue;

          merged.push({
            id: String((row as any).id),
            kind: "mark",
            domain: "anime",
            scope: "series",
            type,
            anime_id,
            title,
            logged_at: createdAt,
            stars: type === "rating" ? ((row as any).stars ?? null) : undefined,
          });
          continue;
        }

        if (manga_chapter_id) {
          const ch = mangaChapterIdToLabel[manga_chapter_id] ?? { manga_id, subLabel: "Chapter" };
          const mid = ch.manga_id ?? manga_id;
          const title = mid && mangaIdToTitle[mid] ? mangaIdToTitle[mid] : "Unknown manga";
          const targetKey = `manga:chapter:${manga_chapter_id}`;

          if (shouldSuppressMark(type, createdAt, targetKey)) continue;

          merged.push({
            id: String((row as any).id),
            kind: "mark",
            domain: "manga",
            scope: "chapter",
            type,
            manga_id: mid ?? null,
            manga_chapter_id,
            title,
            subLabel: ch.subLabel,
            logged_at: createdAt,
            stars: type === "rating" ? ((row as any).stars ?? null) : undefined,
          });
          continue;
        }

        if (manga_id) {
          const title = mangaIdToTitle[manga_id] ?? "Unknown manga";
          const targetKey = `manga:series:${manga_id}`;

          if (shouldSuppressMark(type, createdAt, targetKey)) continue;

          merged.push({
            id: String((row as any).id),
            kind: "mark",
            domain: "manga",
            scope: "series",
            type,
            manga_id,
            title,
            logged_at: createdAt,
            stars: type === "rating" ? ((row as any).stars ?? null) : undefined,
          });
        }
      }

      const finalItems = merged
        .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime())
        .slice(0, feedLimit);

      if (!mounted) return;
      setItems(finalItems);

      setLoading(false);
      setLoadingMore(false);
    }

    run();

    return () => {
      mounted = false;
    };
  }, [router, profileId, feedLimit]);

  if (loading && items.length === 0) {
    return <div className="text-sm text-slate-500">Loading…</div>;
  }

  return (
    <>
      <div className="mb-4 flex items-end justify-between gap-4">
        <h1 className="text-xl font-semibold text-slate-900">{pageTitle}</h1>

        <Link
          href={username ? `/${username}` : "/"}
          className="text-sm text-slate-600 hover:underline"
        >
          ← Back
        </Link>
      </div>

      {error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-slate-500">No activity yet.</div>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => {
            if (item.kind === "log") {
              const hs = ratingToHalfStarsFlexible(item.rating);

              if (item.domain === "anime" && item.scope === "series") {
                const actions: Array<"watched" | "liked" | "rated" | "reviewed"> = [];
                actions.push("watched");
                if (item.liked) actions.push("liked");
                if (hs !== null) actions.push("rated");
                if (item.review_id) actions.push("reviewed");

                const prefix = buildSnapshotPrefixAnime(actions);
                const postId = item.review_id ? reviewIdToPostId[String(item.review_id)] : undefined;

                return (
                  <li key={`log-${item.id}`} className={CARD_CLASS}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium">
                        {postId ? (
                          <Link href={postHref(postId)} className="inline hover:underline" title="View review post">
                            {prefix} <span className="font-bold text-white">{item.title}</span>
                            {hs !== null ? <HalfStarsRow halfStars={hs} /> : null}
                            <span className="ml-1"> on {formatOnFullDate(item.logged_at)}</span>
                          </Link>
                        ) : (
                          <>
                            {prefix} <span className="font-bold text-white">{item.title}</span>
                            {hs !== null ? <HalfStarsRow halfStars={hs} /> : null}
                            <span className="ml-1"> on {formatOnFullDate(item.logged_at)}</span>
                          </>
                        )}
                      </div>

                      <div className="whitespace-nowrap text-xs text-neutral-100">
                        {formatRelativeShort(item.logged_at)}
                      </div>
                    </div>
                  </li>
                );
              }

              if (item.domain === "anime" && item.scope === "episode") {
                const actions: Array<"watched" | "liked" | "rated" | "reviewed"> = [];
                actions.push("watched");
                if (item.liked) actions.push("liked");
                if (hs !== null) actions.push("rated");
                if (item.review_id) actions.push("reviewed");

                const prefix = buildSnapshotPrefixAnime(actions);
                const postId = item.review_id ? reviewIdToPostId[String(item.review_id)] : undefined;

                return (
                  <li key={`log-${item.id}`} className={CARD_CLASS}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium">
                        {postId ? (
                          <Link href={postHref(postId)} className="inline hover:underline" title="View review post">
                            {prefix} <span className="font-bold text-white">{item.title}</span>
                            {item.subLabel ? <span className="ml-2 text-neutral-400">· {item.subLabel}</span> : null}
                            {hs !== null ? <HalfStarsRow halfStars={hs} /> : null}
                            <span className="ml-1"> on {formatOnFullDate(item.logged_at)}</span>
                          </Link>
                        ) : (
                          <>
                            {prefix} <span className="font-bold text-white">{item.title}</span>
                            {item.subLabel ? <span className="ml-2 text-neutral-400">· {item.subLabel}</span> : null}
                            {hs !== null ? <HalfStarsRow halfStars={hs} /> : null}
                            <span className="ml-1"> on {formatOnFullDate(item.logged_at)}</span>
                          </>
                        )}
                      </div>

                      <div className="whitespace-nowrap text-xs text-neutral-100">
                        {formatRelativeShort(item.logged_at)}
                      </div>
                    </div>
                  </li>
                );
              }

              if (item.domain === "manga" && item.scope === "series") {
                const actions: Array<"watched" | "liked" | "rated" | "reviewed"> = [];
                actions.push("watched");
                if (item.liked) actions.push("liked");
                if (hs !== null) actions.push("rated");
                if (item.review_id) actions.push("reviewed");

                const prefix = buildSnapshotPrefixMangaSeries(actions);
                const postId = item.review_id ? reviewIdToPostId[String(item.review_id)] : undefined;

                return (
                  <li key={`log-${item.id}`} className={CARD_CLASS}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium">
                        {postId ? (
                          <Link href={postHref(postId)} className="inline hover:underline" title="View review post">
                            {prefix} <span className="font-bold text-white">{item.title}</span>
                            {hs !== null ? <HalfStarsRow halfStars={hs} /> : null}
                            <span className="ml-1"> on {formatOnFullDate(item.logged_at)}</span>
                          </Link>
                        ) : (
                          <>
                            {prefix} <span className="font-bold text-white">{item.title}</span>
                            {hs !== null ? <HalfStarsRow halfStars={hs} /> : null}
                            <span className="ml-1"> on {formatOnFullDate(item.logged_at)}</span>
                          </>
                        )}
                      </div>

                      <div className="whitespace-nowrap text-xs text-neutral-100">
                        {formatRelativeShort(item.logged_at)}
                      </div>
                    </div>
                  </li>
                );
              }

              if (item.domain === "manga" && item.scope === "chapter") {
                const actions: Array<"read" | "liked" | "rated" | "reviewed"> = [];
                actions.push("read");
                if (item.liked) actions.push("liked");
                if (hs !== null) actions.push("rated");
                if (item.review_id) actions.push("reviewed");

                const prefix = buildSnapshotPrefixMangaChapter(actions);
                const postId = item.review_id ? reviewIdToPostId[String(item.review_id)] : undefined;

                return (
                  <li key={`log-${item.id}`} className={CARD_CLASS}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium">
                        {postId ? (
                          <Link href={postHref(postId)} className="inline hover:underline" title="View review post">
                            {prefix} <span className="font-bold text-white">{item.title}</span>
                            {item.subLabel ? <span className="ml-1 text-neutral-300">· {item.subLabel}</span> : null}
                            {hs !== null ? <HalfStarsRow halfStars={hs} /> : null}
                            <span className="ml-1"> on {formatOnFullDate(item.logged_at)}</span>
                          </Link>
                        ) : (
                          <>
                            {prefix} <span className="font-bold text-white">{item.title}</span>
                            {item.subLabel ? <span className="ml-1 text-neutral-300">· {item.subLabel}</span> : null}
                            {hs !== null ? <HalfStarsRow halfStars={hs} /> : null}
                            <span className="ml-1"> on {formatOnFullDate(item.logged_at)}</span>
                          </>
                        )}
                      </div>

                      <div className="whitespace-nowrap text-xs text-neutral-100">
                        {formatRelativeShort(item.logged_at)}
                      </div>
                    </div>
                  </li>
                );
              }
            }

            if (item.kind === "mark") {
              if (item.type === "watched") {
                const verb = markVerb(item.domain, item.scope, "watched");

                return (
                  <li key={`mark-${item.id}`} className={CARD_CLASS}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium">
                        You marked <span className="font-bold text-white">{item.title}</span>
                        {item.subLabel ? <span className="ml-1 text-neutral-300">· {item.subLabel}</span> : null} as{" "}
                        {verb}
                      </div>
                      <div className="whitespace-nowrap text-xs text-neutral-100">
                        {formatRelativeShort(item.logged_at)}
                      </div>
                    </div>
                  </li>
                );
              }

              if (item.type === "liked") {
                return (
                  <li key={`mark-${item.id}`} className={CARD_CLASS}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium">
                        You liked <span className="font-bold text-white">{item.title}</span>
                        {item.subLabel ? <span className="ml-1 text-neutral-300">· {item.subLabel}</span> : null}
                      </div>
                      <div className="whitespace-nowrap text-xs text-neutral-100">
                        {formatRelativeShort(item.logged_at)}
                      </div>
                    </div>
                  </li>
                );
              }

              if (item.type === "watchlist") {
                return (
                  <li key={`mark-${item.id}`} className={CARD_CLASS}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium">
                        You added <span className="font-bold text-white">{item.title}</span>
                        {item.subLabel ? <span className="ml-1 text-neutral-300">· {item.subLabel}</span> : null} to your
                        watchlist
                      </div>
                      <div className="whitespace-nowrap text-xs text-neutral-100">
                        {formatRelativeShort(item.logged_at)}
                      </div>
                    </div>
                  </li>
                );
              }

              if (item.type === "rating") {
                const hs = clampInt(Number(item.stars ?? 0), 0, 10);

                return (
                  <li key={`mark-${item.id}`} className={CARD_CLASS}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium">
                        You rated <span className="font-bold text-white">{item.title}</span>
                        {item.subLabel ? <span className="ml-1 text-neutral-300">· {item.subLabel}</span> : null}
                        {hs > 0 ? <HalfStarsRow halfStars={hs} /> : null}
                      </div>
                      <div className="whitespace-nowrap text-xs text-neutral-100">
                        {formatRelativeShort(item.logged_at)}
                      </div>
                    </div>
                  </li>
                );
              }
            }

            if (item.kind === "review") {
              const postId = reviewIdToPostId[String(item.id)];

              return (
                <li key={`review-${item.id}`} className={CARD_CLASS}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">
                      {postId ? (
                        <Link href={postHref(postId)} className="inline hover:underline" title="View review post">
                          You reviewed <span className="font-bold text-white">{item.title}</span>
                          {item.subLabel ? <span className="ml-1 text-neutral-300">· {item.subLabel}</span> : null}
                        </Link>
                      ) : (
                        <>
                          You reviewed <span className="font-bold text-white">{item.title}</span>
                          {item.subLabel ? <span className="ml-1 text-neutral-300">· {item.subLabel}</span> : null}
                        </>
                      )}
                    </div>

                    <div className="whitespace-nowrap text-xs text-neutral-100">
                      {formatRelativeShort(item.logged_at)}
                    </div>
                  </div>
                </li>
              );
            }

            return null;
          })}
        </ul>
      )}

      {!error && items.length >= feedLimit ? (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => setFeedLimit((n) => n + 20)}
            className="inline-flex rounded bg-black px-3 py-2 text-sm text-neutral-100 hover:bg-neutral-700 disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </>
  );
}

/* ---------------------------------- Page ---------------------------------- */

const UserActivityPage: NextPage = () => {
  const router = useRouter();
  const { username } = router.query as { username?: string };

  return (
    <ProfileLayout activeTab="activity">
      {({ profile }) => <ActivityBody profileId={profile.id} username={username} />}
    </ProfileLayout>
  );
};

export default UserActivityPage;
