// components/discover/DiscoverJustReviewed.tsx
"use client";

import React from "react";
import type { DiscoverReviewItem } from "./discoverTypes";

type Props = {
  items: DiscoverReviewItem[];
};

export default function DiscoverJustReviewed({ items }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((it) => (
        <div
          key={it.id}
          className={[
            "flex gap-3 rounded-xs bg-white p-2 border-2 border-black",
            "ring-1 ring-black/5",
          ].join(" ")}
        >
          {/* poster thumb */}
          <div className="h-24 w-18 shrink-0 overflow-hidden rounded-xs bg-slate-200">
            {it.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.posterUrl} alt={it.title} className="h-full w-full object-cover" />
            ) : null}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              {/* avatar */}
              <div className="h-7 w-7 overflow-hidden rounded-full bg-slate-200 ring-1 ring-black/5">
                {it.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>

              <span className="text-sm font-semibold text-slate-700">
                {it.username}
              </span>
              <span>•</span>
              <span>{it.createdAtLabel}</span>
              <span>•</span>
              <span className="uppercase tracking-wider">{it.kind}</span>
            </div>

            <div className="mt-1 truncate text-sm font-semibold text-slate-900">{it.title}</div>
            <div className="mt-1 text-xs text-slate-600 line-clamp-2">{it.snippet}</div>
          </div>
        </div>
      ))}
    </div>
  );
}