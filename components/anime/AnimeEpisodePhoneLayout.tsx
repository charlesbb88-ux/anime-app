// components/anime/AnimeEpisodePhoneLayout.tsx
"use client";

import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import Image from "next/image";

import EpisodeNavigatorMobile from "@/components/EpisodeNavigatorMobile";
import FeedShell from "@/components/FeedShell";
import PostFeed from "@/components/PostFeed";

// If you already have a mobile ActionBox, swap this import.
// Otherwise we reuse ActionBox (it’ll still work; styling may not be perfect but layout will be).
import ActionBox from "@/components/actions/ActionBox";

type Anime = {
  id: string;
  title: string;
  slug: string;

  image_url: string | null;
  total_episodes: number | null;
};

type AnimeEpisode = {
  id: string;
  title: string | null;
  synopsis: string | null;
};

export default function AnimeEpisodePhoneLayout(props: {
  slug: string;
  episodeNum: number;

  anime: Anime;
  episode: AnimeEpisode | null;

  backdropUrl: string | null;

  actionBoxNonce: number;

  onOpenLog: () => void;
  onShowActivity: () => void;

  // test + info row props (so you don’t lose functionality)
  savingReview: boolean;
  savingLog: boolean;
  myLogCount: number | null;
  reviewSaveMsg: string | null;
  logSaveMsg: string | null;
  isAnimeLoading: boolean;
  animeError: string | null;
  isEpisodeLoading: boolean;
  episodeError: string | null;

  onTestSaveReview: () => void;
  onTestLogEpisode: () => void;

  feedNonce: number;
}) {
  const {
    slug,
    episodeNum,
    anime,
    episode,
    backdropUrl,
    actionBoxNonce,
    onOpenLog,
    onShowActivity,

    savingReview,
    savingLog,
    myLogCount,
    reviewSaveMsg,
    logSaveMsg,
    isAnimeLoading,
    animeError,
    isEpisodeLoading,
    episodeError,
    onTestSaveReview,
    onTestLogEpisode,

    feedNonce,
  } = props;

  const POSTER_W = 110;
  const POSTER_H = 165;

  return (
    <>
      {/* Backdrop */}
      {backdropUrl && (
        <div className="relative h-[420px] w-screen overflow-hidden">
          <Image
            src={backdropUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-bottom"
            unoptimized={backdropUrl.includes("artworks.thetvdb.com")}
          />

          <img
            src="/overlays/my-overlay.png"
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 pb-8">
        <div className="-mt-4 relative z-10">
          {/* Poster + Title block */}
          <div className="flex items-start gap-4">
            <div
              className="shrink-0 overflow-hidden rounded-md border border-black/100 bg-gray-800"
              style={{ width: POSTER_W, height: POSTER_H }}
            >
              {anime.image_url ? (
                <img
                  src={anime.image_url}
                  alt={anime.title}
                  className="h-full w-full object-cover"
                  style={{ display: "block" }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-gray-200">
                  {(anime.title?.[0] ?? "?").toUpperCase()}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-[22px] font-bold leading-tight">
                {episode?.title ? episode.title : `Episode ${episodeNum}`}
              </h1>

              <div className="mt-1 text-sm text-gray-700">
                <Link href={`/anime/${slug}`} className="hover:text-gray-900">
                  {anime.title}
                </Link>
                <span className="mx-1">•</span>
                <span>Episode {episodeNum}</span>
              </div>

              {/* Synopsis */}
              <div className="mt-2">
                {episode?.synopsis ? (
                  <p className="whitespace-pre-line text-sm text-black">
                    {episode.synopsis}
                  </p>
                ) : episode ? (
                  <p className="text-sm text-gray-500">
                    No synopsis has been added for this episode yet.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Episode nav */}
          <div className="mt-4 w-full min-w-0 overflow-hidden">
            <EpisodeNavigatorMobile
              slug={slug}
              totalEpisodes={anime.total_episodes}
              currentEpisodeNumber={episodeNum}
            />
          </div>

          <div className="mt-1">
            <Link
              href={`/anime/${slug}`}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              ← Back to anime main page
            </Link>
          </div>

          {/* Actions (stacked) */}
          <div className="mt-4 w-full">
            <div className="flex flex-col gap-2">
              {anime && episode ? (
                <ActionBox
                  key={actionBoxNonce}
                  animeId={anime.id}
                  animeEpisodeId={episode.id}
                  onOpenLog={onOpenLog}
                  onShowActivity={onShowActivity}
                />
              ) : null}

              {/* test buttons row (kept, just stacked nicely) */}
              {anime && episode && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onTestSaveReview}
                    disabled={savingReview}
                    className="rounded-md border border-gray-300 bg-white/70 px-3 py-1 text-xs font-medium text-gray-900 hover:bg-white disabled:opacity-60"
                  >
                    {savingReview ? "Saving…" : "Test: Save episode review"}
                  </button>

                  <button
                    type="button"
                    onClick={onTestLogEpisode}
                    disabled={savingLog}
                    className="rounded-md border border-gray-300 bg-white/70 px-3 py-1 text-xs font-medium text-gray-900 hover:bg-white disabled:opacity-60"
                  >
                    {savingLog ? "Logging…" : "Test: Log episode"}
                  </button>

                  <button
                    type="button"
                    onClick={onOpenLog}
                    className="rounded-md border border-gray-300 bg-white/70 px-3 py-1 text-xs font-medium text-gray-900 hover:bg-white"
                  >
                    Log
                  </button>

                  {typeof myLogCount === "number" && (
                    <span className="text-xs text-gray-600">
                      You logged this{" "}
                      <span className="font-semibold text-gray-900">
                        {myLogCount}
                      </span>{" "}
                      time{myLogCount === 1 ? "" : "s"}
                    </span>
                  )}

                  {reviewSaveMsg && (
                    <span className="text-xs text-gray-600">{reviewSaveMsg}</span>
                  )}
                  {logSaveMsg && (
                    <span className="text-xs text-gray-600">{logSaveMsg}</span>
                  )}

                  {isAnimeLoading && (
                    <span className="text-xs text-gray-500">
                      Loading anime details…
                    </span>
                  )}
                  {!isAnimeLoading && animeError && (
                    <span className="text-xs text-red-500">{animeError}</span>
                  )}
                  {isEpisodeLoading && (
                    <span className="text-xs text-gray-500">Loading episode…</span>
                  )}
                  {!isEpisodeLoading && episodeError && (
                    <span className="text-xs text-red-500">{episodeError}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Feed (full-bleed style) */}
          {anime && episode && (
            <div className="mt-6 -mx-4 border-y border-black">
              <FeedShell>
                <div className="px-4 py-4">
                  <div className="mb-3 text-lg font-semibold text-gray-900">
                    Episode discussion
                  </div>
                  <PostFeed
                    key={feedNonce}
                    animeId={anime.id}
                    animeEpisodeId={episode.id}
                  />
                </div>
              </FeedShell>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
