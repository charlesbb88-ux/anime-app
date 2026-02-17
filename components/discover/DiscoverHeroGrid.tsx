// components/discover/DiscoverHeroGrid.tsx
"use client";

import React from "react";
import Link from "next/link";
import type { DiscoverHeroItem } from "./discoverTypes";

type Props = {
  items: DiscoverHeroItem[];
};

function KindPill({ kind }: { kind: "anime" | "manga" }) {
  return (
    <span className="rounded-sm bg-white px-1 text-[10px] font-semibold uppercase tracking-wider text-black border-2 border-black">
      {kind === "anime" ? "Anime" : "Manga"}
    </span>
  );
}

export default function DiscoverHeroGrid({ items }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {items.slice(0, 4).map((it) => {
        const href = `/${it.kind}/${it.slug}`;

        return (
          <Link key={it.id} href={href} className="block">
            <div
              className={[
                "relative overflow-hidden rounded-sm border-2 border-black",
                "aspect-[2/3]",
                "bg-slate-200",
                "ring-1 ring-black/5",
                "transition-transform",
                "hover:-translate-y-0.5",
              ].join(" ")}
            >
              {it.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.posterUrl} alt={it.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                  Poster
                </div>
              )}

              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />

              <div className="absolute left-2 top-1">
                <KindPill kind={it.kind} />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}