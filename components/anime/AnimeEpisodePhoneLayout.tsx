// components/anime/AnimeEpisodePhoneLayout.tsx
"use client";

import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import Image from "next/image";

import FeedShell from "@/components/FeedShell";
import PostFeed from "@/components/PostFeed";

import EpisodeNavigatorMobile from "@/components/EpisodeNavigatorMobile";
import CharacterNavigator from "@/components/CharacterNavigator";

// Mobile versions (you may already have these for manga; if not, we’ll add them next)
import ActionBoxMobile from "@/components/actions/ActionBoxMobile";
import AnimeQuickLogBoxMobile from "@/components/anime/AnimeQuickLogBoxMobile";
import AnimeInfoDropdownMobile from "@/components/anime/AnimeInfoDropdownMobile";

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

    title_english: string | null;
    title_native: string | null;
    title_preferred: string | null;

    total_episodes: number | null;

    format: string | null;
    status: string | null;
    start_date: string | null;
    end_date: string | null;
    season: string | null;
    season_year: number | null;
    average_score: number | null;

    genres: string[] | null;
};

type AnimeEpisode = {
    id: string;
    title: string | null;
    synopsis: string | null;
};

export default function AnimeEpisodePhoneLayout(props: {
    slug: string;
    episodeNum: number;

    anime: Anime | null;
    episode: AnimeEpisode | null;

    backdropUrl: string | null;

    tags: AnimeTag[];
    tagsLoading: boolean;
    showSpoilers: boolean;
    setShowSpoilers: Dispatch<SetStateAction<boolean>>;

    actionBoxNonce: number;
    episodeLogsNonce: number;

    onOpenLog: () => void;
    onShowActivity: () => void;
    onOpenLogForEpisode: (episodeId: string | null) => void;

    feedNonce: number;

    seriesDisplayTitle: string;

    isAnimeLoading: boolean;
    animeError: string | null;
    isEpisodeLoading: boolean;
    episodeError: string | null;
}) {
    const {
        slug,
        episodeNum,
        anime,
        episode,
        backdropUrl,
        tags,
        tagsLoading,
        showSpoilers,
        setShowSpoilers,
        actionBoxNonce,
        episodeLogsNonce,
        onOpenLog,
        onShowActivity,
        onOpenLogForEpisode,
        feedNonce,
        seriesDisplayTitle,
        isAnimeLoading,
        animeError,
        isEpisodeLoading,
        episodeError,
    } = props;

    // poster clamp (safe, local, predictable)
    const POSTER_W = 110;
    const POSTER_H = 165;

    const episodeTitle = episode?.title?.trim()
        ? episode.title!.trim()
        : `Episode ${episodeNum}`;

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
                        unoptimized={backdropUrl.includes("artworks.thetvdb.com")}
                        sizes="100vw"
                        className="object-cover object-bottom"
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
                    {/* Poster + title block */}
                    <div className="flex items-start gap-4">
                        <div
                            className="shrink-0 overflow-hidden rounded-md border-3 border-black/100 bg-gray-800"
                            style={{ width: POSTER_W, height: POSTER_H }}
                        >
                            {anime?.image_url ? (
                                <img
                                    src={anime.image_url}
                                    alt={anime.title}
                                    className="h-full w-full object-cover"
                                    style={{ display: "block" }}
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-gray-200">
                                    {(anime?.title?.[0] ?? "?").toUpperCase()}
                                </div>
                            )}
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="mt-0.5 text-[13px] font-semibold text-black">
                                Episode {episodeNum}
                            </div>

                            <h1 className="text-[22px] font-bold leading-tight">
                                {episodeTitle}
                            </h1>

                            <div className="mt-0.5 text-[13px] font-semibold text-gray-500">
                                <Link href={`/anime/${slug}`} className="hover:underline">
                                    {seriesDisplayTitle}
                                </Link>
                            </div>

                            {/* Synopsis (moved here to match series page placement) */}
                            <div className="mt-1">
                                {episode?.synopsis?.trim() ? (
                                    <p className="whitespace-pre-line text-sm text-black">
                                        {episode.synopsis}
                                    </p>
                                ) : episode ? (
                                    <p className="text-sm text-gray-500">
                                        No synopsis has been added for this episode yet.
                                    </p>
                                ) : null}
                            </div>

                            {/* status/errors line (same info as desktop, just compact) */}
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                {isAnimeLoading && (
                                    <span className="text-xs text-gray-500">Loading anime…</span>
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
                        </div>
                    </div>

                    {/* Episode nav */}
                    <div className="mt-4 w-full min-w-0 overflow-hidden">
                        <EpisodeNavigatorMobile
                            slug={slug}
                            totalEpisodes={anime?.total_episodes ?? null}
                            currentEpisodeNumber={episodeNum}
                        />
                    </div>

                    {/* Characters */}
                    <CharacterNavigator slug={slug} className="mt-4" />

                    <div className="mt-1">
                        <Link href={`/anime/${slug}`} className="text-xs text-black hover:underline">
                            ← Back to anime main page
                        </Link>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 w-full">
                        <div className="flex flex-col gap-2">
                            {anime && episode ? (
                                <>
                                    <ActionBoxMobile
                                        key={actionBoxNonce}
                                        animeId={anime.id}
                                        animeEpisodeId={episode.id}
                                        onOpenLog={onOpenLog}
                                        onShowActivity={onShowActivity}
                                    />

                                    <AnimeQuickLogBoxMobile
                                        animeId={anime.id}
                                        totalEpisodes={anime.total_episodes}
                                        refreshToken={episodeLogsNonce}
                                        onOpenLog={(episodeId) => onOpenLogForEpisode(episodeId ?? null)}
                                    />
                                </>
                            ) : null}
                        </div>
                    </div>

                    {/* Info dropdown (genres/tags/meta moved off the main flow) */}
                    {anime ? (
                        <AnimeInfoDropdownMobile
                            anime={anime}
                            tags={tags}
                            tagsLoading={tagsLoading}
                            showSpoilers={showSpoilers}
                            setShowSpoilers={setShowSpoilers}
                        />
                    ) : null}

                    {/* Feed (full bleed like manga phone) */}
                    <div className="mt-6 -mx-4 border-y border-black">
                        <FeedShell>
                            {anime?.id && episode?.id ? (
                                <PostFeed key={feedNonce} animeId={anime.id} animeEpisodeId={episode.id} />
                            ) : (
                                <p className="text-sm text-gray-500">Loading discussion…</p>
                            )}
                        </FeedShell>
                    </div>

                    <div className="mt-4">
                        <Link href="/" className="text-xs text-blue-400 hover:text-blue-300">
                            ← Back home
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}
