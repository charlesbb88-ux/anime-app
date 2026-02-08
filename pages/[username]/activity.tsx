// pages/[username]/activity.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import Link from "next/link";

import { supabase } from "@/lib/supabaseClient";
import ProfileLayout from "@/components/profile/ProfileLayout";

const CARD_CLASS = "bg-black p-4 text-neutral-100";
const PAGE_SIZE = 25;

function postHref(postId: string) {
  return `/posts/${postId}`;
}

type Visibility = "public" | "friends" | "private";

type ActivityEventRow = {
  id: string;

  user_id: string;
  event_at: string;
  event_rank: number;

  kind: "log" | "review" | "mark";
  domain: "anime" | "manga";
  scope: "series" | "episode" | "chapter";

  anime_id: string | null;
  anime_episode_id: string | null;
  manga_id: string | null;
  manga_chapter_id: string | null;

  title: string;
  sub_label: string | null;

  rating: number | null;
  note: string | null;
  contains_spoilers: boolean | null;

  liked: boolean | null;
  visibility: Visibility | null;

  mark_type: "watched" | "liked" | "watchlist" | "rating" | null;
  stars: number | null;

  review_id: string | null;

  source_table: string;
  source_id: string;
};

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

// Flexible: logs might be 1..10 or 0..100
function ratingToHalfStarsFlexible(rating: number | null): number | null {
  if (typeof rating !== "number" || !Number.isFinite(rating)) return null;
  if (rating <= 0) return null;

  if (rating <= 10) return clampInt(rating, 1, 10);

  const clamped = clampInt(rating, 0, 100);
  if (clamped <= 0) return null;
  return clampInt(Math.round(clamped / 10), 1, 10);
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
function buildSnapshotPrefixMangaSeries(actions: Array<"reviewed" | "liked" | "watched" | "rated">) {
  return `You ${joinWithCommasAnd(actions.map(actionWordMangaSeries))}`;
}

function actionWordMangaChapter(a: "reviewed" | "liked" | "read" | "rated") {
  if (a === "rated") return "rated";
  if (a === "reviewed") return "reviewed";
  if (a === "liked") return "liked";
  return "read";
}
function buildSnapshotPrefixMangaChapter(actions: Array<"reviewed" | "liked" | "read" | "rated">) {
  return `You ${joinWithCommasAnd(actions.map(actionWordMangaChapter))}`;
}

function markVerb(domain: "anime" | "manga", scope: "series" | "episode" | "chapter") {
  if (domain === "manga" && scope === "chapter") return "read";
  return "watched";
}

function ActivityBody({ profileId, username }: { profileId: string; username?: string }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<ActivityEventRow[]>([]);
  const [hasMore, setHasMore] = useState(true);

  // cursor = last item in the list
  const [cursorAt, setCursorAt] = useState<string | null>(null);
  const [cursorRank, setCursorRank] = useState<number | null>(null);
  const [cursorId, setCursorId] = useState<string | null>(null);

  const [reviewIdToPostId, setReviewIdToPostId] = useState<Record<string, string>>({});

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const fetchingRef = useRef(false);

  const pageTitle = useMemo(() => {
    if (!username) return "Activity";
    return `${username} · Activity`;
  }, [username]);

  async function resolvePostLinksForReviews(reviewIds: string[]) {
    if (reviewIds.length === 0) return;

    const unique = Array.from(new Set(reviewIds)).slice(0, 1000);

    const postsRes = await supabase
      .from("posts")
      .select("id, review_id")
      .in("review_id", unique);

    if (!postsRes.data) return;

    setReviewIdToPostId((prev) => {
      const next = { ...prev };
      for (const p of postsRes.data as any[]) {
        if (!p?.id || !p?.review_id) continue;
        next[String(p.review_id)] = String(p.id);
      }
      return next;
    });
  }

  async function fetchPage(isFirst: boolean) {
    if (fetchingRef.current) return;
    if (!hasMore && !isFirst) return;

    fetchingRef.current = true;
    if (isFirst) setLoading(true);
    else setLoadingMore(true);

    try {
      setError(null);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (!user || userErr) {
        router.replace("/login");
        return;
      }

      if (profileId !== user.id) {
        setError("You can only view your own activity.");
        setHasMore(false);
        return;
      }

      const rpcRes = await supabase.rpc("get_activity_events_page", {
        p_user_id: profileId,
        p_cursor_at: isFirst ? null : cursorAt,
        p_cursor_rank: isFirst ? null : cursorRank,
        p_cursor_id: isFirst ? null : cursorId,
        p_limit: PAGE_SIZE,
      });

      if (rpcRes.error) {
        setError(rpcRes.error.message);
        return;
      }

      const rows = (rpcRes.data ?? []) as ActivityEventRow[];

      setItems((prev) => {
        if (isFirst) return rows;

        // dedupe by id (safety)
        const seen = new Set(prev.map((r) => r.id));
        const appended = rows.filter((r) => !seen.has(r.id));
        return prev.concat(appended);
      });

      if (rows.length < PAGE_SIZE) {
        setHasMore(false);
      }

      if (rows.length > 0) {
        const last = rows[rows.length - 1];
        setCursorAt(last.event_at);
        setCursorRank(last.event_rank ?? 0);
        setCursorId(last.id);
      }

      // Resolve post links (reviews + logs that reference a review_id)
      const reviewIds = rows
        .map((r) => r.review_id)
        .filter((x): x is string => Boolean(x));

      await resolvePostLinksForReviews(reviewIds);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  }

  // initial load
  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!mounted) return;
      setItems([]);
      setHasMore(true);
      setCursorAt(null);
      setCursorRank(null);
      setCursorId(null);
      setReviewIdToPostId({});
      await fetchPage(true);
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, profileId]);

  // observer for infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (loading || loadingMore) return;
        if (!hasMore) return;
        fetchPage(false);
      },
      { root: null, rootMargin: "800px 0px", threshold: 0 }
    );

    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, loadingMore, cursorAt, cursorId, cursorRank]);

  if (loading && items.length === 0) {
    return <div className="text-sm text-slate-500">Loading…</div>;
  }

  return (
    <>
      {/* If you want the title hidden (like earlier), just remove this h1 block. */}
      <h1 className="sr-only">{pageTitle}</h1>

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
                  <li key={item.id} className={CARD_CLASS}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium">
                        {postId ? (
                          <Link href={postHref(postId)} className="inline hover:underline" title="View review post">
                            {prefix} <span className="font-bold text-white">{item.title}</span>
                            {hs !== null ? <HalfStarsRow halfStars={hs} /> : null}
                            <span className="ml-1"> on {formatOnFullDate(item.event_at)}</span>
                          </Link>
                        ) : (
                          <>
                            {prefix} <span className="font-bold text-white">{item.title}</span>
                            {hs !== null ? <HalfStarsRow halfStars={hs} /> : null}
                            <span className="ml-1"> on {formatOnFullDate(item.event_at)}</span>
                          </>
                        )}
                      </div>

                      <div className="whitespace-nowrap text-xs text-neutral-100">
                        {formatRelativeShort(item.event_at)}
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
                  <li key={item.id} className={CARD_CLASS}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium">
                        {postId ? (
                          <Link href={postHref(postId)} className="inline hover:underline" title="View review post">
                            {prefix} <span className="font-bold text-white">{item.title}</span>
                            {item.sub_label ? <span className="ml-2 text-neutral-400">· {item.sub_label}</span> : null}
                            {hs !== null ? <HalfStarsRow halfStars={hs} /> : null}
                            <span className="ml-1"> on {formatOnFullDate(item.event_at)}</span>
                          </Link>
                        ) : (
                          <>
                            {prefix} <span className="font-bold text-white">{item.title}</span>
                            {item.sub_label ? <span className="ml-2 text-neutral-400">· {item.sub_label}</span> : null}
                            {hs !== null ? <HalfStarsRow halfStars={hs} /> : null}
                            <span className="ml-1"> on {formatOnFullDate(item.event_at)}</span>
                          </>
                        )}
                      </div>

                      <div className="whitespace-nowrap text-xs text-neutral-100">
                        {formatRelativeShort(item.event_at)}
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
                  <li key={item.id} className={CARD_CLASS}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium">
                        {postId ? (
                          <Link href={postHref(postId)} className="inline hover:underline" title="View review post">
                            {prefix} <span className="font-bold text-white">{item.title}</span>
                            {hs !== null ? <HalfStarsRow halfStars={hs} /> : null}
                            <span className="ml-1"> on {formatOnFullDate(item.event_at)}</span>
                          </Link>
                        ) : (
                          <>
                            {prefix} <span className="font-bold text-white">{item.title}</span>
                            {hs !== null ? <HalfStarsRow halfStars={hs} /> : null}
                            <span className="ml-1"> on {formatOnFullDate(item.event_at)}</span>
                          </>
                        )}
                      </div>

                      <div className="whitespace-nowrap text-xs text-neutral-100">
                        {formatRelativeShort(item.event_at)}
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
                  <li key={item.id} className={CARD_CLASS}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium">
                        {postId ? (
                          <Link href={postHref(postId)} className="inline hover:underline" title="View review post">
                            {prefix} <span className="font-bold text-white">{item.title}</span>
                            {item.sub_label ? <span className="ml-1 text-neutral-300">· {item.sub_label}</span> : null}
                            {hs !== null ? <HalfStarsRow halfStars={hs} /> : null}
                            <span className="ml-1"> on {formatOnFullDate(item.event_at)}</span>
                          </Link>
                        ) : (
                          <>
                            {prefix} <span className="font-bold text-white">{item.title}</span>
                            {item.sub_label ? <span className="ml-1 text-neutral-300">· {item.sub_label}</span> : null}
                            {hs !== null ? <HalfStarsRow halfStars={hs} /> : null}
                            <span className="ml-1"> on {formatOnFullDate(item.event_at)}</span>
                          </>
                        )}
                      </div>

                      <div className="whitespace-nowrap text-xs text-neutral-100">
                        {formatRelativeShort(item.event_at)}
                      </div>
                    </div>
                  </li>
                );
              }
            }

            if (item.kind === "mark") {
              if (item.mark_type === "watched") {
                const verb = markVerb(item.domain, item.scope);

                return (
                  <li key={item.id} className={CARD_CLASS}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium">
                        You marked <span className="font-bold text-white">{item.title}</span>
                        {item.sub_label ? <span className="ml-1 text-neutral-300">· {item.sub_label}</span> : null} as{" "}
                        {verb}
                      </div>
                      <div className="whitespace-nowrap text-xs text-neutral-100">
                        {formatRelativeShort(item.event_at)}
                      </div>
                    </div>
                  </li>
                );
              }

              if (item.mark_type === "liked") {
                return (
                  <li key={item.id} className={CARD_CLASS}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium">
                        You liked <span className="font-bold text-white">{item.title}</span>
                        {item.sub_label ? <span className="ml-1 text-neutral-300">· {item.sub_label}</span> : null}
                      </div>
                      <div className="whitespace-nowrap text-xs text-neutral-100">
                        {formatRelativeShort(item.event_at)}
                      </div>
                    </div>
                  </li>
                );
              }

              if (item.mark_type === "watchlist") {
                return (
                  <li key={item.id} className={CARD_CLASS}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium">
                        You added <span className="font-bold text-white">{item.title}</span>
                        {item.sub_label ? <span className="ml-1 text-neutral-300">· {item.sub_label}</span> : null} to your
                        watchlist
                      </div>
                      <div className="whitespace-nowrap text-xs text-neutral-100">
                        {formatRelativeShort(item.event_at)}
                      </div>
                    </div>
                  </li>
                );
              }

              if (item.mark_type === "rating") {
                const hs = clampInt(Number(item.stars ?? 0), 0, 10);

                return (
                  <li key={item.id} className={CARD_CLASS}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium">
                        You rated <span className="font-bold text-white">{item.title}</span>
                        {item.sub_label ? <span className="ml-1 text-neutral-300">· {item.sub_label}</span> : null}
                        {hs > 0 ? <HalfStarsRow halfStars={hs} /> : null}
                      </div>
                      <div className="whitespace-nowrap text-xs text-neutral-100">
                        {formatRelativeShort(item.event_at)}
                      </div>
                    </div>
                  </li>
                );
              }
            }

            if (item.kind === "review") {
              const rid = item.review_id ?? item.source_id;
              const postId = rid ? reviewIdToPostId[String(rid)] : undefined;

              return (
                <li key={item.id} className={CARD_CLASS}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">
                      {postId ? (
                        <Link href={postHref(postId)} className="inline hover:underline" title="View review post">
                          You reviewed <span className="font-bold text-white">{item.title}</span>
                          {item.sub_label ? <span className="ml-1 text-neutral-300">· {item.sub_label}</span> : null}
                        </Link>
                      ) : (
                        <>
                          You reviewed <span className="font-bold text-white">{item.title}</span>
                          {item.sub_label ? <span className="ml-1 text-neutral-300">· {item.sub_label}</span> : null}
                        </>
                      )}
                    </div>

                    <div className="whitespace-nowrap text-xs text-neutral-100">
                      {formatRelativeShort(item.event_at)}
                    </div>
                  </div>
                </li>
              );
            }

            return null;
          })}
        </ul>
      )}

      {/* infinite scroll sentinel */}
      <div ref={sentinelRef} />

      {loadingMore ? (
        <div className="mt-3 flex justify-center text-xs text-slate-500">Loading…</div>
      ) : null}

      {!hasMore && items.length > 0 ? (
        <div className="mt-3 flex justify-center text-xs text-slate-500">End</div>
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
