// components/discover/DiscoverJustReviewed.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import ActionRowSpread from "@/components/ActionRowSpread";

import type { DiscoverReviewItem } from "./discoverTypes";

/* -------------------- Stars (match ReviewPostRow behavior) -------------------- */

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
      className="inline-flex items-center gap-[2px] translate-y-[1px]"
      aria-label={`${hs / 2} stars`}
    >
      {nodes}
    </span>
  );
}

/* -------------------- Component -------------------- */

type Props = {
  items: DiscoverReviewItem[];
};

type ActionMetaRow = {
  post_id: string;
  likes_count: number;
  replies_count: number;
  liked_by_me: boolean;
};

export default function DiscoverJustReviewed({ items }: Props) {
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
        // keep UI working without counts
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
        // revert
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
        // revert
        setMetaByPostId((prev) => ({
          ...prev,
          [postId]: current,
        }));
      }
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((it) => {
        const halfStarsForReview =
          it.rating != null ? rating100ToHalfStars(it.rating) : null;

        const cardClassName = [
          "relative flex gap-3 rounded-xs bg-white pt-2 px-2 pb-2 border-2 border-black",
          "ring-1 ring-black/5",
        ].join(" ");

        const episodeOrChapterNode =
          it.animeEpisodeNumber != null ? (
            <span className="text-xs text-slate-500">
              EPISODE {it.animeEpisodeNumber}
            </span>
          ) : it.mangaChapterNumber != null ? (
            <span className="text-xs text-slate-500">
              CHAPTER {it.mangaChapterNumber}
            </span>
          ) : null;

        const starsNode =
          halfStarsForReview != null ? (
            <ReviewStarsRow halfStars={halfStarsForReview} size={14} />
          ) : null;

        // Only show dots between existing pieces
        const metaParts = [
          <span key="time">{it.createdAtLabel}</span>,
          episodeOrChapterNode ? <span key="epch">{episodeOrChapterNode}</span> : null,
          starsNode ? <span key="stars">{starsNode}</span> : null,
        ].filter(Boolean) as React.ReactNode[];

        const actionMeta =
          it.postId && metaByPostId[it.postId]
            ? metaByPostId[it.postId]
            : { likes: 0, replies: 0, liked: false };

        const CardInner = (
          <>
            {/* poster thumb */}
            <div className="h-20 w-15 shrink-0 overflow-hidden rounded-xs bg-slate-200">
              {it.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={it.posterUrl}
                  alt={it.title}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              {/* ✅ Action row overlay (doesn't take layout space) */}
              {it.postId ? (
                <div className="absolute right-1 top-1 z-10">
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

              <div className="flex items-center gap-1 text-xs text-slate-500">
                {/* avatar */}
                <div className="h-7 w-7 overflow-hidden rounded-full bg-slate-200 ring-1 ring-black/5">
                  {it.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={it.avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>

                <span className="text-sm font-semibold text-slate-700">
                  {it.username}
                </span>

                {metaParts.map((node, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 ? <span>•</span> : null}
                    {node}
                  </React.Fragment>
                ))}
              </div>

              <div className="truncate text-sm font-semibold text-slate-900">
                {it.title}
              </div>

              <div
                className="text-xs text-slate-600 whitespace-normal break-words"
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
          </>
        );

        if (it.postId) {
          return (
            <Link key={it.id} href={`/posts/${it.postId}`} className={cardClassName}>
              {CardInner}
            </Link>
          );
        }

        return (
          <div key={it.id} className={cardClassName}>
            {CardInner}
          </div>
        );
      })}
    </div>
  );
}
