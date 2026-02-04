"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import MangaMetaBox from "@/components/manga/MangaMetaBox";

type Manga = {
  id: string;
  title: string;
  slug: string;
  total_chapters: number | null;
  total_volumes: number | null;
  image_url: string | null;
  banner_image_url: string | null;

  title_english: string | null;
  title_native: string | null;
  title_preferred: string | null;

  description: string | null;
  format: string | null;
  status: string | null;
  season: string | null;
  season_year: number | null;
  start_date: string | null;
  end_date: string | null;
  average_score: number | null;
  source: string | null;

  genres: string[] | null;

  created_at: string;
};

type MangaTag = {
  id: number;
  manga_id: string;
  name: string;
  description: string | null;
  rank: number | null;
  is_adult: boolean | null;
  is_general_spoiler: boolean | null;
  is_media_spoiler: boolean | null;
  category: string | null;
};

export default function MangaInfoDropdownMobile(props: {
  manga: Manga;
  tags: MangaTag[];
  tagsLoading: boolean;
  showSpoilers: boolean;
  setShowSpoilers: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { manga, tags, tagsLoading, showSpoilers, setShowSpoilers } = props;

  const [open, setOpen] = useState(false);

  const genres = Array.isArray(manga.genres) ? manga.genres : [];
  const hasGenres = genres.length > 0;

  const spoilerTags = useMemo(() => {
    return tags.filter(
      (t) => t.is_general_spoiler === true || t.is_media_spoiler === true
    );
  }, [tags]);

  const spoilerCount = spoilerTags.length;

  const visibleTags = useMemo(() => {
    return tags.filter((tag) => {
      const isSpoiler =
        tag.is_general_spoiler === true || tag.is_media_spoiler === true;
      if (isSpoiler && !showSpoilers) return false;
      return true;
    });
  }, [tags, showSpoilers]);

  // centered content width for genres + tags
  const contentWrap = "mx-auto w-full max-w-[520px]";

  return (
    <div
      className={[
        "mt-3 w-full min-w-0",
        "overflow-hidden rounded-md border border-gray-800 bg-black text-gray-200 shadow-sm",
      ].join(" ")}
    >
      {/* Header / Toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "w-full px-3 py-2 text-left",
          "grid grid-cols-[1fr_auto_1fr] items-center",
          "transition-colors duration-150",
          "hover:bg-white/5 active:bg-white/10",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/10",
        ].join(" ")}
      >
        {/* left spacer to keep true center */}
        <div />

        {/* centered title — match QUICK LOG style */}
        <div className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-300">
          Info
        </div>

        {/* chevron on the right */}
        <div className="flex justify-end">
          <ChevronDown
            className={[
              "h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200",
              open ? "rotate-180" : "",
            ].join(" ")}
          />
        </div>
      </button>

      <Divider />

      {/* Panel */}
      <div
        className={[
          "transition-all duration-200 ease-out",
          open
            ? "max-h-[900px] opacity-100 overflow-hidden"
            : "max-h-0 opacity-0 overflow-hidden",
        ].join(" ")}
      >
        <div className="px-3 py-3">
          {/* Genres */}
          {hasGenres && (
            <div className="mb-4">
              <div className={contentWrap}>
                <h3 className="mb-2 text-center text-[12px] font-semibold text-gray-200">
                  Genres
                </h3>

                <div className="flex flex-wrap justify-center gap-2">
                  {genres.map((g) => (
                    <span
                      key={g}
                      className="rounded-full border border-gray-700 bg-black px-3 py-1 text-[11px] font-semibold text-gray-200"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="mb-4">
              <div className={contentWrap}>
                <div className="mb-2 flex items-center justify-center gap-2">
                  <h3 className="text-[12px] font-semibold text-gray-200">Tags</h3>
                  {tagsLoading && (
                    <span className="text-[10px] uppercase tracking-wide text-gray-500">
                      Loading…
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  {visibleTags.map((tag) => {
                    const isSpoiler =
                      tag.is_general_spoiler === true ||
                      tag.is_media_spoiler === true;

                    let percent: number | null = null;
                    if (typeof tag.rank === "number") {
                      percent = Math.max(0, Math.min(100, Math.round(tag.rank)));
                    }

                    return (
                      <div key={tag.id} className="group relative">
                        <span
                          className={[
                            "relative inline-flex w-full items-center justify-between",
                            "rounded-full border border-gray-700 bg-black",
                            "px-3 py-[3px] text-[12px] font-semibold",
                            "whitespace-nowrap overflow-hidden",
                            "transition-colors duration-150",
                            "hover:bg-white/5",
                          ].join(" ")}
                        >
                          {percent !== null && (
                            <span
                              className="pointer-events-none absolute inset-y-0 left-0 bg-sky-500/15"
                              style={{ width: `${percent}%` }}
                            />
                          )}

                          <span
                            className={[
                              "relative truncate",
                              isSpoiler ? "text-red-400" : "text-gray-100",
                            ].join(" ")}
                            title={tag.name}
                          >
                            {tag.name}
                          </span>

                          {percent !== null && (
                            <span className="relative ml-2 text-[11px] font-semibold text-gray-300">
                              {percent}%
                            </span>
                          )}
                        </span>

                        {tag.description && (
                          <div
                            className={[
                              "pointer-events-none absolute left-1/2 top-full z-20 mt-1 w-64 -translate-x-1/2",
                              "rounded-md border border-gray-700 bg-black px-3 py-2",
                              "text-xs text-gray-100 shadow-lg",
                              "opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0",
                              "transition duration-200 delay-150",
                            ].join(" ")}
                          >
                            {tag.description}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {spoilerCount > 0 && (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => setShowSpoilers((prev) => !prev)}
                      className="mt-2 text-[12px] font-semibold text-sky-400 hover:text-sky-300"
                    >
                      {showSpoilers
                        ? `Hide ${spoilerCount} spoiler tag${
                            spoilerCount === 1 ? "" : "s"
                          }`
                        : `Show ${spoilerCount} spoiler tag${
                            spoilerCount === 1 ? "" : "s"
                          }`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Meta (MangaMetaBox is max-w[340] internally, so center + optionally widen via className override) */}
          <div className="mx-auto w-full max-w-[520px]">
            <MangaMetaBox
              className="mx-auto !max-w-[520px]"
              titleEnglish={manga.title_english}
              titlePreferred={manga.title_preferred}
              titleNative={manga.title_native}
              totalVolumes={manga.total_volumes}
              totalChapters={manga.total_chapters}
              format={manga.format}
              status={manga.status}
              startDate={manga.start_date}
              endDate={manga.end_date}
              season={manga.season}
              seasonYear={manga.season_year}
              averageScore={manga.average_score}
              source={manga.source}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-gray-700/60" />;
}
