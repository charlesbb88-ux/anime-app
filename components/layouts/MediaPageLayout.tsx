// components/layouts/MediaPageLayout.tsx
"use client";

import React from "react";

type MediaPageLayoutProps = {
  // Header visuals
  bannerUrl?: string | null;
  overlayMaskUrl?: string | null;

  // Poster (optional)
  posterUrl?: string | null;
  posterAlt?: string;

  // ✅ NEW: lets pages provide the exact poster element (including fallback boxes)
  // If provided, this renders instead of posterUrl.
  posterSlot?: React.ReactNode;

  // Title block
  title: string;
  titleSubBlock?: React.ReactNode; // english/native lines, metadata lines, etc.

  // Optional header additions (episode navigator, debug buttons, log count, etc.)
  headerExtras?: React.ReactNode;

  // Action box slot (ActionBox / MangaActionBox)
  actionSlot?: React.ReactNode;

  // Main-top content (Synopsis/Genres/Tags/etc.)
  mainTop?: React.ReactNode;

  // 3-column grid slots
  leftSidebar?: React.ReactNode;
  feed?: React.ReactNode;
  rightSidebar?: React.ReactNode;

  // Optional footer / extra content
  belowGrid?: React.ReactNode;
};

export default function MediaPageLayout({
  bannerUrl,
  overlayMaskUrl,

  posterUrl,
  posterAlt,
  posterSlot,

  title,
  titleSubBlock,

  headerExtras,
  actionSlot,

  mainTop,

  leftSidebar,
  feed,
  rightSidebar,

  belowGrid,
}: MediaPageLayoutProps) {
  return (
    <>
      {/* ------------------------------------------- */}
      {/*                  HEADER                     */}
      {/* ------------------------------------------- */}
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Banner (Letterboxd structure) */}
        {bannerUrl ? (
          <div className="mb-6 h-40 w-full overflow-hidden rounded-lg">
            <div className="relative h-full w-full">
              {/* backdrop image */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${bannerUrl})`,
                  backgroundSize: "cover",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center 0px",
                }}
              />

              {/* overlay mask (optional) */}
              {overlayMaskUrl ? (
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url(${overlayMaskUrl})`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                    backgroundSize: "100% 100%",
                    pointerEvents: "none",
                  }}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Top section */}
        <div className="mb-8 flex flex-col gap-6 md:flex-row">
          {/* Poster */}
          {posterSlot ? (
            <div className="flex-shrink-0">{posterSlot}</div>
          ) : posterUrl ? (
            <div className="flex-shrink-0">
              <img
                src={posterUrl}
                alt={posterAlt || title}
                className="h-64 w-44 rounded-lg object-cover"
              />
            </div>
          ) : null}

          {/* Title + meta + header extras + action */}
          <div className="flex-1">
            <h1 className="mb-1 text-3xl font-bold">{title}</h1>

            {titleSubBlock ? <div className="mb-2">{titleSubBlock}</div> : null}

            {headerExtras ? <div className="mt-4">{headerExtras}</div> : null}

            {actionSlot ? <div className="mt-3">{actionSlot}</div> : null}
          </div>
        </div>

        {/* Main-top content (Synopsis/Genres/Tags/etc.) */}
        {mainTop ? <div>{mainTop}</div> : null}
      </div>

      {/* ------------------------------------------- */}
      {/*                 MAIN GRID                   */}
      {/* ------------------------------------------- */}
      <div className="mx-auto mt-6 max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[19rem_minmax(0,41rem)_19rem]">
          <div>{leftSidebar ?? null}</div>
          <div>{feed ?? null}</div>
          <div>{rightSidebar ?? null}</div>
        </div>
      </div>

      {belowGrid ? <div>{belowGrid}</div> : null}
    </>
  );
}
