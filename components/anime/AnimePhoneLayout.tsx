"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import FeedShell from "@/components/FeedShell";
import PostFeed from "@/components/PostFeed";

import EpisodeNavigatorResponsive from "@/components/EpisodeNavigatorResponsive";
import CharacterNavigatorResponsive from "@/components/CharacterNavigatorResponsive";

import AnimeMetaBox from "@/components/anime/AnimeMetaBox";
import AnimeQuickLogBoxMobile from "@/components/anime/AnimeQuickLogBoxMobile";
import ActionBoxMobile from "@/components/actions/ActionBoxMobile";

import AnimeInfoDropdownMobile from "@/components/anime/AnimeInfoDropdownMobile";

import EnglishTitle from "@/components/EnglishTitle";
import { pickEnglishTitle } from "@/lib/pickEnglishTitle";

import SmartBackdropImage from "@/components/SmartBackdropImage";
import { FALLBACK_BACKDROP_SRC } from "@/lib/fallbacks";

type AnimeTag = {
  id: number;
  anime_id: string;
  name: string;
  description: string | null;
  rank: number | null;
  is_adult: boolean | null;
  is_general_spoiler: boolean | null;
  is_media_spoiler: boolean | null;
  category: string | null;
};

type Anime = {
  id: string;
  title: string;
  slug: string;

  image_url: string | null;

  title_english?: string | null;
  title_native?: string | null;

  description?: string | null;

  total_episodes?: number | null;
  format?: string | null;
  status?: string | null;
  season?: string | null;
  season_year?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  average_score?: number | null;

  genres?: string[] | null;
};

export default function AnimePhoneLayout(props: {
  slug: string | null;
  anime: Anime;
  backdropUrl: string | null;

  tags: AnimeTag[];
  tagsLoading: boolean;
  showSpoilers: boolean;
  setShowSpoilers: Dispatch<SetStateAction<boolean>>;

  cleanSynopsis: (raw: string) => string;

  actionBoxNonce: number;
  episodeLogsNonce: number;

  onOpenLog: () => void;
  onShowActivity: () => void;
  onOpenLogForEpisode: (episodeId: string | null, episodeNumber?: number | null) => void;

  feedNonce: number;
  reviewSaveMsg: string | null;
}) {
  const {
    slug,
    anime,
    backdropUrl,
    tags,
    tagsLoading,
    showSpoilers,
    setShowSpoilers,
    cleanSynopsis,
    actionBoxNonce,
    episodeLogsNonce,
    onOpenLog,
    onShowActivity,
    onOpenLogForEpisode,
    feedNonce,
    reviewSaveMsg,
  } = props;

  const a: any = anime;

  const picked = pickEnglishTitle({
    title_english: (a as any).title_english,
    title_preferred: (a as any).title_preferred,
    title: anime.title,
    title_native: (a as any).title_native,
  });

  const mainTitle = picked?.value ?? anime.title;

  // show the "other" title as a smaller subtitle (only if it exists and differs)
  const secondaryTitle = (() => {
    const eng = typeof a.title_english === "string" ? a.title_english.trim() : "";
    const base = typeof anime.title === "string" ? anime.title.trim() : "";
    const nat = typeof a.title_native === "string" ? a.title_native.trim() : "";

    // Prefer showing the original (anime.title) if the mainTitle became English.
    if (mainTitle && base && base !== mainTitle) return base;

    // Otherwise, if mainTitle is base and we have a different English, show English
    if (mainTitle && eng && eng !== mainTitle) return eng;

    // Otherwise, show native if it's different
    if (mainTitle && nat && nat !== mainTitle) return nat;

    return "";
  })();

  const hasGenres = Array.isArray(a.genres) && a.genres.length > 0;
  const genres: string[] = a.genres || [];

  const spoilerTags = tags.filter(
    (t) => t.is_general_spoiler === true || t.is_media_spoiler === true
  );
  const spoilerCount = spoilerTags.length;

  // poster clamp (safe, local, predictable)
  const POSTER_W = 110; // px
  const POSTER_H = 165; // px (≈ 2:3)

  // Title -> Synopsis gap is mt-1 => 4px
  const SYNOPSIS_TOP_GAP_PX = 4;

  // A little breathing room so synopsis doesn’t feel too cramped
  const SYNOPSIS_BREATH_PX = 26;

  // =====
  // Synopsis clamp-to-poster-bottom behavior (accounts for title height)
  // =====
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [synopsisCanExpand, setSynopsisCanExpand] = useState(false);

  const synopsisRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLDivElement | null>(null);

  const [synopsisClampPx, setSynopsisClampPx] = useState<number>(POSTER_H - 2);

  const synopsisText = useMemo(() => {
    if (typeof a.description !== "string") return "";
    const s = a.description.trim();
    if (!s) return "";
    return cleanSynopsis(s);
  }, [a.description, cleanSynopsis]);

  const useIsoLayoutEffect =
    typeof window === "undefined" ? useEffect : useLayoutEffect;

  const toggleSynopsis = () => {
    if (!synopsisCanExpand) return;
    setSynopsisExpanded((v) => !v);
  };

  useIsoLayoutEffect(() => {
    const synEl = synopsisRef.current;
    const titleEl = titleRef.current;
    if (!synEl || !titleEl) return;

    const measure = () => {
      const titleH = Math.round(titleEl.getBoundingClientRect().height);

      const clampPx = Math.max(
        24,
        POSTER_H - titleH - SYNOPSIS_TOP_GAP_PX + SYNOPSIS_BREATH_PX
      );

      setSynopsisClampPx(clampPx);

      if (synopsisExpanded) {
        setSynopsisCanExpand(true);
        return;
      }

      const overflows = synEl.scrollHeight > clampPx + 1;
      setSynopsisCanExpand(overflows);
    };

    measure();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => measure());
      ro.observe(titleEl);
      ro.observe(synEl);
    }

    return () => {
      if (ro) ro.disconnect();
    };
  }, [POSTER_H, synopsisText, synopsisExpanded]);

  useEffect(() => {
    setSynopsisExpanded(false);
  }, [anime?.id]);

  return (
    <>
      {/* ✅ FULL-BLEED BACKDROP (backdrop → poster → final fallback) */}
      <div className="relative h-[420px] w-screen overflow-hidden">
        <SmartBackdropImage
          src={backdropUrl}
          posterFallbackSrc={anime.image_url ?? null}
          finalFallbackSrc={FALLBACK_BACKDROP_SRC}
          alt=""
          // fill-like behavior: make the Image cover the container
          className="h-full w-full object-cover object-bottom"
          priority
          sizes="100vw"
          // only poster moves (tweak as needed)
          posterFallbackObjectPosition="50% 30%"
          // final fallback file positioning (keep your preferred)
          finalFallbackObjectPosition="50% 13%"
        />

        <img
          src="/overlays/my-overlay.png"
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      </div>

      {/* ✅ CONTENT */}
      <div className="mx-auto max-w-6xl px-4 pb-8">
        <div className="-mt-4 relative z-10">
          {/* =========================
              TOP ROW: poster left, text right
              ========================= */}
          <div className="flex items-start gap-4">
            {/* Poster */}
            <div
              className="shrink-0 overflow-hidden rounded-md border-3 border-black/100 bg-gray-800"
              style={{ width: POSTER_W, height: POSTER_H }}
            >
              {anime.image_url ? (
                <img
                  src={anime.image_url}
                  alt={mainTitle}
                  className="h-full w-full object-cover"
                  style={{ display: "block" }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-gray-200">
                  {anime.title?.[0] ?? "?"}
                </div>
              )}
            </div>

            {/* Title + synopsis */}
            <div className="min-w-0 flex-1">
              {/* Title: clicking should also expand/collapse synopsis */}
              <div
                className="-mt-1"
                ref={titleRef}
                role={synopsisCanExpand ? "button" : undefined}
                tabIndex={synopsisCanExpand ? 0 : -1}
                onClick={toggleSynopsis}
                onKeyDown={(e) => {
                  if (!synopsisCanExpand) return;
                  if (e.key === "Enter" || e.key === " ") toggleSynopsis();
                }}
                style={{
                  cursor: synopsisCanExpand ? "pointer" : "default",
                  userSelect: synopsisCanExpand ? "none" : "auto",
                }}
              >
                <h1 className="text-[22px] font-bold leading-tight">
                  {mainTitle}
                </h1>

                {!!secondaryTitle && (
                  <div className="mt-0.5 text-[13px] font-semibold text-gray-500">
                    {secondaryTitle}
                  </div>
                )}
              </div>

              {!!synopsisText && (
                <div className="mt-1">
                  <div
                    ref={synopsisRef}
                    role={synopsisCanExpand ? "button" : undefined}
                    tabIndex={synopsisCanExpand ? 0 : -1}
                    onClick={toggleSynopsis}
                    onKeyDown={(e) => {
                      if (!synopsisCanExpand) return;
                      if (e.key === "Enter" || e.key === " ") toggleSynopsis();
                    }}
                    className={synopsisCanExpand ? "cursor-pointer select-none" : ""}
                    style={{
                      position: "relative",
                      maxHeight: synopsisExpanded ? "none" : `${synopsisClampPx}px`,
                      overflow: synopsisExpanded ? "visible" : "hidden",
                    }}
                  >
                    <p className="whitespace-pre-line text-sm text-black">
                      {synopsisText}
                    </p>

                    {!synopsisExpanded && synopsisCanExpand && (
                      <div
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-10"
                        style={{
                          background:
                            "linear-gradient(to bottom, rgba(223,228,233,0), var(--site-bg))",
                        }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Episode nav full width */}
          {slug && (
            <div className="mt-4 w-full min-w-0 overflow-hidden">
              <EpisodeNavigatorResponsive
                slug={slug}
                totalEpisodes={anime.total_episodes ?? null}
                currentEpisodeNumber={null}
              />
            </div>
          )}

          {/* Characters */}
          <CharacterNavigatorResponsive slug={slug as string} className="mt-4" />

          {/* Actions full width */}
          <div className="mt-4 w-full">
            <div className="flex w-full flex-col items-start gap-2">
              <ActionBoxMobile
                key={actionBoxNonce}
                animeId={anime.id}
                onOpenLog={onOpenLog}
                onShowActivity={onShowActivity}
              />

              <AnimeQuickLogBoxMobile
                animeId={anime.id}
                totalEpisodes={anime.total_episodes ?? null}
                refreshToken={episodeLogsNonce}
                onOpenLog={(episodeId, episodeNumber) =>
                  onOpenLogForEpisode(episodeId ?? null, episodeNumber ?? null)
                }
              />
            </div>
          </div>

          <AnimeInfoDropdownMobile
            anime={anime}
            tags={tags}
            tagsLoading={tagsLoading}
            showSpoilers={showSpoilers}
            setShowSpoilers={setShowSpoilers}
          />

          {/* Feed */}
          <div className="mt-6 -mx-4 border-y-[1px] border-black">
            <FeedShell>
              <PostFeed key={feedNonce} animeId={anime.id} />
            </FeedShell>
          </div>

          {reviewSaveMsg ? null : null}

          {/* Footer links */}
          <div className="mt-4 flex items-center gap-4">
            <Link
              href={`/anime/${slug}/art`}
              className="text-sm text-blue-500 hover:underline"
            >
              Art
            </Link>

            <Link href="/" className="text-xs text-blue-400 hover:text-blue-300">
              ← Back home
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
