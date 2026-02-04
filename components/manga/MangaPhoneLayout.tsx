"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import MangaQuickLogBoxMobile from "@/components/manga/MangaQuickLogBoxMobile";
import ChapterNavigatorMobile from "@/components/ChapterNavigatorMobile";
import PostFeed from "@/components/PostFeed";
import MangaActionBoxMobile from "@/components/actions/MangaActionBoxMobile";
import EnglishTitle from "@/components/EnglishTitle";
import FeedShell from "@/components/FeedShell";
import MangaInfoDropdownMobile from "@/components/manga/MangaInfoDropdownMobile";


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

    // poster clamp (safe, local, predictable)
    const POSTER_W = 110; // px
    const POSTER_H = 165; // px (≈ 2:3)

    // Title -> Synopsis gap is `mt-1` => 4px
    const SYNOPSIS_TOP_GAP_PX = 4;

    // Give it a little breathing room so it doesn’t feel too tight visually
    // (tweak 8–14 if you ever want)
    const SYNOPSIS_BREATH_PX = 26;

    // ==========
    // Synopsis clamp-to-poster-bottom behavior (accounts for title height)
    // ==========
    const [synopsisExpanded, setSynopsisExpanded] = useState(false);
    const [synopsisCanExpand, setSynopsisCanExpand] = useState(false);

    const synopsisRef = useRef<HTMLDivElement | null>(null);
    const titleRef = useRef<HTMLDivElement | null>(null);

    const [synopsisClampPx, setSynopsisClampPx] = useState<number>(POSTER_H - 2);

    const synopsisText = useMemo(() => {
        if (typeof m.description !== "string") return "";
        const s = m.description.trim();
        if (!s) return "";
        return cleanSynopsis(s);
    }, [m.description, cleanSynopsis]);

    // Re-measure after render & when text/expanded changes
    const useIsoLayoutEffect =
        typeof window === "undefined" ? useEffect : useLayoutEffect;

    // Shared toggle so title + synopsis can both trigger expand/collapse
    const toggleSynopsis = () => {
        if (!synopsisCanExpand) return;
        setSynopsisExpanded((v) => !v);
    };

    useIsoLayoutEffect(() => {
        const synEl = synopsisRef.current;
        const titleEl = titleRef.current;
        if (!synEl || !titleEl) return;

        const measure = () => {
            // How tall is the title block right now (1 line, 2 lines, etc)?
            const titleH = Math.round(titleEl.getBoundingClientRect().height);

            // Available synopsis height so that (title + gap + synopsis) ends at poster bottom,
            // plus a little "breathing room" so it doesn't feel cramped.
            const clampPx = Math.max(
                24, // don’t let it go to 0 if title is insanely tall
                POSTER_H - titleH - SYNOPSIS_TOP_GAP_PX + SYNOPSIS_BREATH_PX
            );

            setSynopsisClampPx(clampPx);

            if (synopsisExpanded) {
                // If expanded, we still want the click behavior (so user can collapse)
                setSynopsisCanExpand(true);
                return;
            }

            const overflows = synEl.scrollHeight > clampPx + 1;
            setSynopsisCanExpand(overflows);
        };

        measure();

        // Keep it responsive if fonts/layout change.
        // Observe BOTH title and synopsis because title wrapping changes clamp.
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

    // If manga changes, collapse by default
    useEffect(() => {
        setSynopsisExpanded(false);
    }, [manga?.id]);

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
                            {/* Title: clicking this should also expand/collapse synopsis */}
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
                                            <>
                                                {/* Fade matching site bg */}
                                                <div
                                                    className="pointer-events-none absolute inset-x-0 bottom-0 h-10"
                                                    style={{
                                                        background:
                                                            "linear-gradient(to bottom, rgba(223,228,233,0), var(--site-bg))",
                                                    }}
                                                />
                                            </>
                                        )}
                                    </div>
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
              ========================= */}
                    <div className="mt-4 w-full">
                        {/* Actions full width */}
                        <div className="flex w-full flex-col items-start gap-2">
                            <MangaActionBoxMobile
                                key={actionBoxNonce}
                                mangaId={manga.id}
                                onOpenLog={onOpenLog}
                                onShowActivity={onShowActivity}
                            />

                            <MangaQuickLogBoxMobile
                                mangaId={manga.id}
                                totalChapters={manga.total_chapters}
                                refreshToken={chapterLogsNonce}
                                onOpenLog={(chapterId) => onOpenLogForChapter(chapterId ?? null)}
                            />


                        </div>
                    </div>
                    <MangaInfoDropdownMobile
                        manga={manga}
                        tags={tags}
                        tagsLoading={tagsLoading}
                        showSpoilers={showSpoilers}
                        setShowSpoilers={setShowSpoilers}
                    />

                    {/* Feed */}
                    <div className="mt-6 -mx-4 border-y-[1px] border-black">
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
