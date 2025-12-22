// components/layouts/MediaLayout.tsx
"use client";

import React from "react";

type MediaLayoutProps = {
  backdropUrl?: string | null;
  posterUrl?: string | null;

  title: string;
  subtitle?: string | null; // like "Episode 7" or "Chapter 12"
  metaLine?: string | null; // year • format • etc

  children: React.ReactNode;
};

export default function MediaLayout({
  backdropUrl,
  posterUrl,
  title,
  subtitle,
  metaLine,
  children,
}: MediaLayoutProps) {
  return (
    <div>
      {/* Backdrop + mask */}
      <div className="relative">
        <div className="h-[320px] w-full overflow-hidden bg-black">
          {backdropUrl ? (
            <img
              src={backdropUrl}
              alt=""
              className="h-full w-full object-cover opacity-90"
            />
          ) : null}
        </div>

        {/* your “Letterboxd-ish” mask goes here */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-black/15 to-[#f5f5f5]" />
      </div>

      {/* Main container */}
      <div className="mx-auto w-full max-w-[1100px] px-4">
        {/* Header row */}
        <div className="-mt-20 flex gap-4">
          <div className="h-[180px] w-[120px] shrink-0 overflow-hidden rounded-md bg-zinc-200 shadow">
            {posterUrl ? (
              <img src={posterUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>

          <div className="pt-2">
            <div className="text-[28px] font-semibold leading-tight">{title}</div>
            {subtitle ? (
              <div className="mt-1 text-sm text-zinc-600">{subtitle}</div>
            ) : null}
            {metaLine ? (
              <div className="mt-1 text-sm text-zinc-600">{metaLine}</div>
            ) : null}
          </div>
        </div>

        {/* Content */}
        <div className="mt-6 pb-10">{children}</div>
      </div>
    </div>
  );
}
