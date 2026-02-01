"use client";

import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import Image from "next/image";

import MangaMetaBox from "@/components/manga/MangaMetaBox";
import MangaQuickLogBox from "@/components/manga/MangaQuickLogBox";
import ChapterNavigatorMobile from "@/components/ChapterNavigatorMobile";
import PostFeed from "@/components/PostFeed";
import MangaActionBox from "@/components/actions/MangaActionBox";
import EnglishTitle from "@/components/EnglishTitle";
import FeedShell from "@/components/FeedShell";

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

export default function MangaPhoneLayout(props: {
    slug: string | null;
    manga: Manga;
    backdropUrl: string | null;

    tags: MangaTag[];
    tagsLoading: boolean;
    showSpoilers: boolean;
    setShowSpoilers: Dispatch<SetStateAction<boolean>>;

    cleanSynopsis: (raw: string) => string;

    actionBoxNonce: number;
    chapterLogsNonce: number;

    onOpenLog: () => void;
    onShowActivity: () => void;
    onOpenLogForChapter: (chapterId: string | null) => void;

    feedNonce: number;
    reviewSaveMsg: string | null;
}) {
    const {
        slug,
        manga,
        backdropUrl,
        tags,
        tagsLoading,
        showSpoilers,
        setShowSpoilers,
        cleanSynopsis,
        actionBoxNonce,
        chapterLogsNonce,
        onOpenLog,
        onShowActivity,
        onOpenLogForChapter,
        feedNonce,
        reviewSaveMsg,
    } = props;

    const m: any = manga;

    const hasGenres = Array.isArray(m.genres) && m.genres.length > 0;
    const genres: string[] = m.genres || [];

    const spoilerTags = tags.filter(
        (t) => t.is_general_spoiler === true || t.is_media_spoiler === true
    );
    const spoilerCount = spoilerTags.length;

    // poster clamp (safe, local, predictable)
    const POSTER_W = 110; // px
    const POSTER_H = 165; // px (≈ 2:3)

    return (
        <>
            {/* ✅ FULL-BLEED BACKDROP */}
            {backdropUrl && (
                <div className="relative h-[420px] w-screen overflow-hidden">
                    <Image
                        src={backdropUrl}
                        alt=""
                        fill
                        priority
                        unoptimized
                        sizes="100vw"
                        className="object-cover object-[50%_25%]"
                    />
                    <img
                        src="/overlays/my-overlay.png"
                        alt=""
                        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                    />
                </div>
            )}

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
                            {manga.image_url ? (
                                <img
                                    src={manga.image_url}
                                    alt={manga.title}
                                    className="h-full w-full object-cover"
                                    style={{ display: "block" }}
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-gray-200">
                                    {manga.title?.[0] ?? "?"}
                                </div>
                            )}
                        </div>

                        {/* Title + description (NO actions here on mobile) */}
                        <div className="min-w-0 flex-1">
                            <div className="-mt-1">
                                <EnglishTitle
                                    as="h1"
                                    className="text-[22px] font-bold leading-tight"
                                    titles={{
                                        title_english: manga.title_english,
                                        title_preferred: manga.title_preferred,
                                        title: manga.title,
                                        title_native: manga.title_native,
                                    }}
                                    fallback={manga.title ?? manga.title_native ?? "Untitled"}
                                />
                            </div>

                            {typeof m.description === "string" && m.description.trim() && (
                                <div className="mt-1">
                                    <p className="whitespace-pre-line text-sm text-black">
                                        {cleanSynopsis(m.description)}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Chapter nav full width (directly under poster+text) */}
                    {slug && (
                        <div className="mt-4 w-full min-w-0 overflow-hidden">
                            <ChapterNavigatorMobile
                                slug={slug}
                                totalChapters={manga.total_chapters}
                                currentChapterNumber={null}
                            />
                        </div>
                    )}

                    {/* =========================
              FULL-WIDTH ROW: actions + chapter nav
              (this is the key change)
              ========================= */}
                    <div className="mt-4 w-full">
                        {/* Actions full width */}
                        <div className="flex w-full flex-col items-start gap-2">
                            <MangaActionBox
                                key={actionBoxNonce}
                                mangaId={manga.id}
                                onOpenLog={onOpenLog}
                                onShowActivity={onShowActivity}
                            />

                            <MangaQuickLogBox
                                mangaId={manga.id}
                                totalChapters={manga.total_chapters}
                                refreshToken={chapterLogsNonce}
                                onOpenLog={(chapterId) => onOpenLogForChapter(chapterId ?? null)}
                            />
                        </div>
                    </div>

                    {/* Genres */}
                    {hasGenres && (
                        <div className="mt-4">
                            <h2 className="mb-1 text-sm font-semibold text-black-300">
                                Genres
                            </h2>
                            <div className="flex flex-wrap gap-2">
                                {genres.map((g) => (
                                    <span
                                        key={g}
                                        className="rounded-full bg-black px-3 py-1 text-xs text-gray-100"
                                    >
                                        {g}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tags */}
                    {tags.length > 0 && (
                        <div className="mt-5">
                            <div className="mb-1 flex items-center gap-2">
                                <h2 className="text-base font-semibold text-black-300">Tags</h2>
                                {tagsLoading && (
                                    <span className="text-[10px] uppercase tracking-wide text-gray-500">
                                        Loading…
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-col gap-1">
                                <div className="flex w-full flex-col gap-1">
                                    {tags.map((tag) => {
                                        const isSpoiler =
                                            tag.is_general_spoiler === true ||
                                            tag.is_media_spoiler === true;

                                        if (isSpoiler && !showSpoilers) return null;

                                        let percent: number | null = null;
                                        if (typeof tag.rank === "number") {
                                            percent = Math.max(0, Math.min(100, Math.round(tag.rank)));
                                        }

                                        return (
                                            <div key={tag.id} className="group relative inline-flex">
                                                <span
                                                    className="
                            relative inline-flex w-full items-center justify-between
                            rounded-full border border-gray-700 bg-gray-900/80
                            px-3 py-[3px] text-[13px] font-medium
                            whitespace-nowrap overflow-hidden
                          "
                                                >
                                                    {percent !== null && (
                                                        <span
                                                            className="pointer-events-none absolute inset-y-0 left-0 bg-blue-500/20"
                                                            style={{ width: `${percent}%` }}
                                                        />
                                                    )}

                                                    <span
                                                        className={`relative ${isSpoiler ? "text-red-400" : "text-gray-100"
                                                            }`}
                                                    >
                                                        {tag.name}
                                                    </span>

                                                    {percent !== null && (
                                                        <span className="relative text-[11px] font-semibold text-gray-200">
                                                            {percent}%
                                                        </span>
                                                    )}
                                                </span>

                                                {tag.description && (
                                                    <div
                                                        className="
                              pointer-events-none absolute left-0 top-full z-20 mt-1 w-64
                              rounded-md bg-black px-3 py-2 text-xs text-gray-100 shadow-lg
                              opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0
                              transition duration-200 delay-150
                            "
                                                    >
                                                        {tag.description}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {spoilerCount > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setShowSpoilers((prev) => !prev)}
                                    className="mt-2 text-sm font-medium text-blue-400 hover:text-blue-300"
                                >
                                    {showSpoilers
                                        ? `Hide ${spoilerCount} spoiler tag${spoilerCount === 1 ? "" : "s"
                                        }`
                                        : `Show ${spoilerCount} spoiler tag${spoilerCount === 1 ? "" : "s"
                                        }`}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Meta box */}
                    <div className="mt-6">
                        <MangaMetaBox
                            titleEnglish={manga.title_english}
                            titlePreferred={manga.title_preferred}
                            titleNative={manga.title_native}
                            totalVolumes={manga.total_volumes}
                            totalChapters={manga.total_chapters}
                            format={m.format}
                            status={m.status}
                            startDate={m.start_date}
                            endDate={m.end_date}
                            season={m.season}
                            seasonYear={m.season_year}
                            averageScore={m.average_score}
                        />
                    </div>

                    {/* Feed */}
                    <div className="mt-6">
                        <FeedShell>
                            <PostFeed key={feedNonce} mangaId={manga.id} />
                        </FeedShell>
                    </div>

                    {reviewSaveMsg ? null : null}

                    {/* Footer links */}
                    <div className="mt-4 flex items-center gap-4">
                        <Link
                            href={`/manga/${slug}/art`}
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
