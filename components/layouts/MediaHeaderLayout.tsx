"use client";

import React from "react";
import Image from "next/image";

import SmartBackdropImage from "@/components/SmartBackdropImage";
import { FALLBACK_BACKDROP_SRC } from "@/lib/fallbacks";

type Props = {
  /** Backdrop URL (already normalized server-side if desired) */
  backdropUrl: string | null;

  /** Poster URL */
  posterUrl: string | null;

  /** Big title */
  title: string;

  /**
   * Overlay image drawn over the backdrop.
   * IMPORTANT: This should still show even if backdropUrl is null.
   */
  overlaySrc?: string | null;

  /** If no posterUrl, what character to show */
  posterFallbackChar?: string;

  /** Height of backdrop area */
  backdropHeightClassName?: string; // e.g. "h-[620px]"

  /**
   * Content to render under the poster (left column), e.g. genres/tags.
   * This is how your anime page works.
   */
  leftColumnBelowPoster?: React.ReactNode;

  /**
   * Pinned top-right action area (e.g. ActionBox).
   * If provided, we reserve space on the right so text never goes under it.
   */
  rightPinned?: React.ReactNode;

  /**
   * How much space to reserve on the right for rightPinned.
   * Matches your anime page's "pr-[260px]".
   */
  reserveRightClassName?: string; // e.g. "pr-[260px]"

  /**
   * Main content under the title (synopsis, episode nav, feed, etc).
   * This is your page-specific content.
   */
  children?: React.ReactNode;
};

export default function MediaHeaderLayout({
  backdropUrl,
  posterUrl,
  title,
  overlaySrc = "/overlays/my-overlay4.png",
  posterFallbackChar,
  backdropHeightClassName = "h-[620px]",
  leftColumnBelowPoster,
  rightPinned,
  reserveRightClassName = "pr-[260px]",
  children,
}: Props) {
  // ✅ Always render the "backdrop area" so the overlay can always show.
  const showOverlay = typeof overlaySrc === "string" && overlaySrc.length > 0;

  const safeBackdrop =
    typeof backdropUrl === "string" && backdropUrl.trim().length > 0 ? backdropUrl.trim() : null;

  const safePoster =
    typeof posterUrl === "string" && posterUrl.trim().length > 0 ? posterUrl.trim() : null;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-0 pb-8">
      {/* Backdrop area (always exists; overlay can render even without backdropUrl) */}
      <div className={`relative w-full overflow-hidden ${backdropHeightClassName} -mt-10`}>
        {/* ✅ Backdrop -> poster fallback -> final local fallback
            ✅ Prevent local final fallback from flashing while poster is still loading */}
        <SmartBackdropImage
          src={safeBackdrop}
          posterFallbackSrc={safePoster}
          finalFallbackSrc={FALLBACK_BACKDROP_SRC}
          alt=""
          width={1920}
          height={1080}
          priority
          sizes="100vw"
          className="h-full w-full object-cover object-bottom"
          deferFinalUntilPosterResolved
          posterResolved={!!safePoster}
          // Only affects FINAL fallback (your local file), not poster
          finalFallbackObjectPosition="50% 13%"
          // If you ever want to move ONLY the poster fallback framing, uncomment:
          // posterFallbackObjectPosition="50% 30%"
        />

        {showOverlay ? (
          <img
            src={overlaySrc as string}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
      </div>

      {/* Foreground row (poster + title) — same overlap and spacing */}
      <div className="-mt-35 relative z-10 px-3">
        <div className="mb-8 flex flex-row gap-7">
          {/* LEFT: Poster + below-poster area (genres/tags/etc) */}
          <div className="flex-shrink-0 w-56">
            {safePoster ? (
              <img
                src={safePoster}
                alt={title}
                className="h-84 w-56 rounded-md object-cover border-2 border-black/100"
              />
            ) : (
              <div className="flex h-64 w-56 items-center justify-center rounded-lg bg-gray-800 text-4xl font-bold text-gray-200">
                {posterFallbackChar ?? title?.[0] ?? "?"}
              </div>
            )}

            {leftColumnBelowPoster ? <div className="mt-4">{leftColumnBelowPoster}</div> : null}
          </div>

          {/* RIGHT: Title + pinned actions + main content */}
          <div className="min-w-0 flex-1">
            <h1 className="mb-2 text-4xl font-bold leading-tight">{title}</h1>

            <div className="relative w-full">
              {rightPinned ? <div className="absolute right-0 top-1">{rightPinned}</div> : null}

              <div className={`min-w-0 ${rightPinned ? reserveRightClassName : ""}`}>
                {children ? <div className="mt-4 min-w-0">{children}</div> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}