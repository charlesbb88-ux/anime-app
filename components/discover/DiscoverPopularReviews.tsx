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

export default function DiscoverPopularReviews({ items }: Props) {
  if (!items || items.length === 0) {
    return <div className="text-sm text-slate-500">No reviews yet this week.</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {items.map((it, idx) => {
        const mediaHref =
          it.mediaSlug && it.kind ? `/${it.kind}/${it.mediaSlug}` : null;

        return (
          <Link
            key={it.reviewId}
            href={`/review/${it.reviewId}`}
            className="block rounded-2xl bg-white p-4 ring-1 ring-black/5 hover:bg-slate-50"
          >
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
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
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

                  <span className="font-semibold text-slate-700">{it.authorUsername}</span>
                  <span>•</span>
                  <span className="uppercase tracking-wider">{it.kind}</span>

                  {mediaHref ? (
                    <>
                      <span>•</span>
                      <span
                        className="underline text-slate-700"
                        onClick={(e) => {
                          // allow the "view" click to go to media instead of review
                          e.preventDefault();
                          window.location.href = mediaHref;
                        }}
                      >
                        view
                      </span>
                    </>
                  ) : null}
                </div>

                {/* snippet */}
                <div className="mt-2 text-sm text-slate-700 line-clamp-3">
                  {clampText(it.snippet, 220)}
                </div>

                {/* metrics */}
                <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2 py-1">👍 {it.likesCount}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">💬 {it.repliesCount}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">🔥 {Math.round(it.score)}</span>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}