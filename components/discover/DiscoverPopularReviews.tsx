// components/discover/DiscoverPopularReviews.tsx
"use client";

import React from "react";
import Link from "next/link";
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
    <span className="inline-flex items-center gap-[2px]" aria-label={`${hs / 2} stars`}>
      {nodes}
    </span>
  );
}

/* -------------------- Episode / Chapter label -------------------- */

function formatEpisodeLabel(n: number | null | undefined) {
  if (n == null) return null;
  return `EPISODE ${n}`;
}

function formatChapterLabel(n: number | null | undefined) {
  if (n == null) return null;
  // chapter_number can be numeric/decimal in DB; support integers + decimals
  const asString = Number.isFinite(Number(n)) ? String(n) : String(n);
  return `CHAPTER ${asString}`;
}

export default function DiscoverPopularReviews({ items }: Props) {
  if (!items || items.length === 0) {
    return <div className="text-sm text-slate-500">No reviews yet this week.</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {items.map((it, idx) => {
        const mediaHref =
          it.mediaSlug && it.kind ? `/${it.kind}/${it.mediaSlug}` : null;

        const postHref = it.postId ? `/posts/${it.postId}` : null;

        // @ts-expect-error: support older builds where these might not exist yet
        const animeEpNum: number | null | undefined = it.animeEpisodeNumber ?? null;
        // @ts-expect-error: support older builds where these might not exist yet
        const mangaChNum: number | null | undefined = it.mangaChapterNumber ?? null;

        const episodeOrChapterLabel =
          it.kind === "anime"
            ? formatEpisodeLabel(animeEpNum)
            : formatChapterLabel(mangaChNum);

        const halfStars =
          it.rating != null ? rating100ToHalfStars(it.rating) : null;

        const CardInner = (
          <div className="flex items-start gap-4">
            {/* rank */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
              {idx + 1}
            </div>

            {/* media cover */}
            <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-200 ring-1 ring-black/5">
              {it.mediaPosterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={it.mediaPosterUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              {/* media title */}
              <div
                className="truncate text-base font-semibold text-slate-900"
                title={it.mediaTitle}
              >
                {it.mediaTitle}
              </div>

              {/* author row */}
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <div className="h-5 w-5 overflow-hidden rounded-full bg-slate-200 ring-1 ring-black/5">
                  {it.authorAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={it.authorAvatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>

                <span className="font-semibold text-slate-700">
                  {it.authorUsername}
                </span>
                <span>•</span>
                <span className="uppercase tracking-wider">{it.kind}</span>

                {episodeOrChapterLabel ? (
                  <>
                    <span>•</span>
                    <span className="text-xs text-slate-500">
                      {episodeOrChapterLabel}
                    </span>
                  </>
                ) : null}

                {/* stars to the right of episode/chapter */}
                {halfStars != null ? (
                  <span className="ml-1 inline-flex items-center">
                    <ReviewStarsRow halfStars={halfStars} size={14} />
                  </span>
                ) : null}

                {mediaHref ? (
                  <>
                    <span>•</span>
                    <Link
                      href={mediaHref}
                      className="underline text-slate-700"
                      onClick={(e) => e.stopPropagation()}
                    >
                      view
                    </Link>
                  </>
                ) : null}
              </div>

              {/* snippet */}
              <div className="mt-2 text-sm text-slate-700 line-clamp-3">
                {clampText(it.snippet, 220)}
              </div>

              {/* metrics */}
              <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-2 py-1">
                  👍 {it.likesCount}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-1">
                  💬 {it.repliesCount}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-1">
                  🔥 {Math.round(it.score)}
                </span>
              </div>
            </div>
          </div>
        );

        // If we have a postId, the whole card should go to /posts/:id
        // If not, we fall back to /review/:reviewId (keeps behavior working even if data is missing)
        const href = postHref ?? `/review/${it.reviewId}`;

        return (
          <Link
            key={it.reviewId}
            href={href}
            className="block rounded-2xl bg-white p-4 ring-1 ring-black/5 hover:bg-slate-50"
          >
            {CardInner}
          </Link>
        );
      })}
    </div>
  );
}