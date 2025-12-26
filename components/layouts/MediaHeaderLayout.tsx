"use client";

import React from "react";
import Image from "next/image";

type Props = {
  /** Backdrop URL (already normalized server-side if you want) */
  backdropUrl: string | null;

  /** Poster URL */
  posterUrl: string | null;

  /** Big title */
  title: string;

  /** Optional: overlay image drawn over the backdrop */
  overlaySrc?: string | null;

  /** Optional: if no posterUrl, what character to show */
  posterFallbackChar?: string;

  /** Optional: height of backdrop area */
  backdropHeightClassName?: string; // e.g. "h-[620px]"

  /** Optional: page content below the header */
  children?: React.ReactNode;
};

export default function MediaHeaderLayout({
  backdropUrl,
  posterUrl,
  title,
  overlaySrc = "/overlays/my-overlay.png",
  posterFallbackChar,
  backdropHeightClassName = "h-[620px]",
  children,
}: Props) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-0 pb-8">
      {/* Backdrop */}
      {backdropUrl && (
        <div className={`relative w-full overflow-hidden ${backdropHeightClassName}`}>
          <Image
            src={backdropUrl}
            alt=""
            width={1920}
            height={1080}
            priority
            sizes="100vw"
            className="h-full w-full object-cover object-bottom"
          />

          {overlaySrc ? (
            <img
              src={overlaySrc}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
        </div>
      )}

      {/* Foreground row (poster + title) */}
      <div className="-mt-5 relative z-10 px-3">
        <div className="mb-8 flex flex-row gap-7">
          {/* Poster */}
          <div className="flex-shrink-0 w-56">
            {posterUrl ? (
              <img
                src={posterUrl}
                alt={title}
                className="h-84 w-56 rounded-md object-cover border border-black/100"
              />
            ) : (
              <div className="flex h-64 w-56 items-center justify-center rounded-lg bg-gray-800 text-4xl font-bold text-gray-200">
                {posterFallbackChar ?? title?.[0] ?? "?"}
              </div>
            )}
          </div>

          {/* Title */}
          <div className="min-w-0 flex-1">
            <h1 className="mb-2 text-4xl font-bold leading-tight">{title}</h1>

            {/* Any page-specific stuff goes below the title */}
            {children ? <div className="mt-4 min-w-0">{children}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
