// components/discover/DiscoverPopularReviews.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import ActionRowSpread from "@/components/ActionRowSpread";
import type { DiscoverPopularReview } from "./discoverTypes";

type Props = {
  items: DiscoverPopularReview[];
};

function clampText(s: string, max: number) {
  const t = (s ?? "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

/* -------------------- Stars (NO placeholder/backing row) -------------------- */

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

// reviews.rating is 0..100 -> halfStars 0..10 (0.5 steps)
function rating100ToHalfStars(rating100: number): number {
  const r = Math.max(0, Math.min(100, rating100));
  return clampInt((r / 100) * 10, 0, 10);
}

// halfStars is 0..10
// starIndex is 1..5
// returns 0, 50, or 100
function computeStarFillPercent(shownHalfStars: number, starIndex: number) {
  const starHalfStart = (starIndex - 1) * 2; // 0,2,4,6,8
  const remaining = shownHalfStars - starHalfStart;

  if (remaining >= 2) return 100 as const;
  if (remaining === 1) return 50 as const;
  return 0 as const;
}

function ReviewStarsRow({
  halfStars,
  size = 14,
}: {
  halfStars: number;
  size?: number;
}) {
  const hs = clampInt(halfStars, 0, 10);

  const nodes: React.ReactNode[] = [];
  for (let i = 1; i <= 5; i++) {
    const fill = computeStarFillPercent(hs, i);
    if (fill === 0) continue;

    nodes.push(
      <span
        key={i}
        className="relative inline-block align-middle"
        style={{ width: size, height: size }}
      >
        <span
          className="absolute left-0 top-0 leading-none text-emerald-500"
          style={{
            fontSize: size,
            lineHeight: `${size}px`,
            display: "block",
          }}
          aria-hidden="true"
        >
          <span
            style={{
              display: "block",
              width: fill === 100 ? "100%" : "50%",
              overflow: "hidden",
            }}
          >
            ★
          </span>
        </span>
      </span>
    );
  }

  if (nodes.length === 0) return null;

  return (
    <span
      className="inline-flex items-center gap-[2px]"
      aria-label={`${hs / 2} stars`}
    >
      {nodes}
    </span>
  );
}

/* -------------------- Episode / Chapter label -------------------- */

function formatEpisodeLabel(n: number | null | undefined) {
  if (n == null) return null;
  return `EPISODE ${n}`;
}

function formatChapterLabel(n: number | string | null | undefined) {
  if (n == null) return null;
  return `CHAPTER ${String(n)}`;
}

/* -------------------- Action Meta (RPC) -------------------- */

type ActionMetaRow = {
  post_id: string;
  likes_count: number;
  replies_count: number;
  liked_by_me: boolean;
};

export default function DiscoverPopularReviews({ items }: Props) {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const postIds = useMemo(() => {
    const ids = items.map((x) => x.postId).filter(Boolean) as string[];
    return Array.from(new Set(ids));
  }, [items]);

  const [metaByPostId, setMetaByPostId] = useState<
    Record<string, { likes: number; replies: number; liked: boolean }>
  >({});

  useEffect(() => {
    let cancelled = false;

    async function loadActionMeta() {
      if (postIds.length === 0) {
        setMetaByPostId({});
        return;
      }

      const { data, error } = await supabase.rpc("get_post_action_meta", {
        post_ids: postIds,
      });

      if (cancelled) return;

      if (error) {
        console.error("get_post_action_meta error:", error);
        setMetaByPostId({});
        return;
      }

      const next: Record<string, { likes: number; replies: number; liked: boolean }> =
        {};

      (data as ActionMetaRow[] | null | undefined)?.forEach((row) => {
        if (!row?.post_id) return;
        next[row.post_id] = {
          likes: row.likes_count ?? 0,
          replies: row.replies_count ?? 0,
          liked: !!row.liked_by_me,
        };
      });

      setMetaByPostId(next);
    }

    loadActionMeta();

    return () => {
      cancelled = true;
    };
  }, [postIds]);

  async function toggleLike(postId: string) {
    if (!userId) {
      router.push("/login");
      return;
    }

    const current = metaByPostId[postId] ?? { likes: 0, replies: 0, liked: false };
    const nextLiked = !current.liked;

    // optimistic UI
    setMetaByPostId((prev) => ({
      ...prev,
      [postId]: {
        ...current,
        liked: nextLiked,
        likes: Math.max(0, current.likes + (nextLiked ? 1 : -1)),
      },
    }));

    // write to DB
    if (nextLiked) {
      const { error } = await supabase.from("likes").insert({
        post_id: postId,
        user_id: userId,
      });

      if (error) {
        console.error("like insert error:", error);
        setMetaByPostId((prev) => ({
          ...prev,
          [postId]: current,
        }));
      }
    } else {
      const { error } = await supabase
        .from("likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId);

      if (error) {
        console.error("like delete error:", error);
        setMetaByPostId((prev) => ({
          ...prev,
          [postId]: current,
        }));
      }
    }
  }

  if (!items || items.length === 0) {
    return <div className="text-sm text-slate-500">No reviews yet this week.</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {items.map((it, idx) => {
        const postHref = it.postId ? `/posts/${it.postId}` : null;

        const animeEpNum: number | null | undefined = it.animeEpisodeNumber ?? null;
        const mangaChNum: number | string | null | undefined = it.mangaChapterNumber ?? null;

        const episodeOrChapterLabel =
          it.kind === "anime"
            ? formatEpisodeLabel(animeEpNum)
            : formatChapterLabel(mangaChNum);

        const halfStars = it.rating != null ? rating100ToHalfStars(it.rating) : null;

        // Nodes for meta row: kind -> episode/chapter -> rating
        const kindNode = it.kind ? (
          <span key="kind" className="uppercase tracking-wider">
            {it.kind}
          </span>
        ) : null;

        const episodeOrChapterNode = episodeOrChapterLabel ? (
          <span key="epch" className="text-xs text-slate-500">
            {episodeOrChapterLabel}
          </span>
        ) : null;

        const starsNode =
          halfStars != null ? (
            <span key="stars" className="inline-flex items-center">
              <ReviewStarsRow halfStars={halfStars} size={14} />
            </span>
          ) : null;

        // ✅ Only show dots between existing pieces
        const metaParts = [kindNode, episodeOrChapterNode, starsNode].filter(
          Boolean
        ) as React.ReactNode[];

        const actionMeta =
          it.postId && metaByPostId[it.postId]
            ? metaByPostId[it.postId]
            : { likes: 0, replies: 0, liked: false };

        const CardInner = (
          <div className="flex items-start gap-1">
            {/* rank */}
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-black">
              {idx + 1}
            </div>

            {/* media cover */}
            <div className="h-20 w-14 mr-1 shrink-0 self-start overflow-hidden rounded-xs bg-slate-200 ring-1 ring-black/5">
              {it.mediaPosterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.mediaPosterUrl} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>

            {/* ✅ make this relative so the action row can pin to its top-right */}
            <div className="relative min-w-0 flex-1">
              {/* ✅ overlay action row (takes ZERO layout space) */}
              {it.postId ? (
                <div className="absolute right-[-4px] top-[-6px] z-10 pointer-events-auto leading-none">
                  <ActionRowSpread
                    layout="compact"
                    iconSize={16}
                    replyCount={actionMeta.replies}
                    likeCount={actionMeta.likes}
                    likedByMe={actionMeta.liked}
                    hideShare
                    onReply={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      router.push(`/posts/${it.postId}`);
                    }}
                    onLike={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleLike(it.postId!);
                    }}
                  />
                </div>
              ) : null}

              {/* ✅ title (minimal height again) */}
              <div
                className="truncate text-base leading-none font-semibold text-slate-900"
                title={it.mediaTitle}
              >
                {it.mediaTitle}
              </div>

              {/* author row */}
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <div className="h-6 w-6 overflow-hidden rounded-full bg-slate-200 ring-1 ring-black/5">
                  {it.authorAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.authorAvatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>

                {/* username */}
                <span className="font-semibold text-sm text-slate-700">{it.authorUsername}</span>

                {/* ✅ kind • episode/chapter • rating (only between existing) */}
                {metaParts.map((node, i) => (
                  <React.Fragment key={i}>
                    <span>•</span>
                    {node}
                  </React.Fragment>
                ))}
              </div>

              {/* snippet */}
              <div
                className="text-sm text-slate-700 whitespace-normal break-words"
                style={{
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                  overflow: "hidden",
                }}
              >
                {it.snippet}
              </div>
            </div>
          </div>
        );

        const href = postHref ?? `/review/${it.reviewId}`;

        return (
          <Link
            key={it.reviewId}
            href={href}
            className="block rounded-xs bg-white pt-2 pb-2 pl-1 pr-1 border-2 border-black hover:bg-slate-50"
          >
            {CardInner}
          </Link>
        );
      })}
    </div>
  );
}
