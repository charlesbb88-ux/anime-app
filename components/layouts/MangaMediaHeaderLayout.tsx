"use client";

import React from "react";
import Image from "next/image";

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

    /** Content under the poster (left column) */
    leftColumnBelowPoster?: React.ReactNode;

    /** Pinned top-right action area */
    rightPinned?: React.ReactNode;

    /** Space reserved on the right when rightPinned is present */
    reserveRightClassName?: string; // e.g. "pr-[260px]"

    /** Main content under the title */
    children?: React.ReactNode;

    /**
     * Manga pages often used `unoptimized` for Supabase images.
     * Keep default TRUE for manga so you don't fight Next/image.
     */
    unoptimizedBackdrop?: boolean;

    /**
     * Backdrop crop class. To match anime layout exactly, default is object-bottom.
     * If you want your manga crop, pass "object-[50%_25%]" from the page.
     */
    backdropObjectClassName?: string;
};

export default function MangaMediaHeaderLayout({
    backdropUrl,
    posterUrl,
    title,
    // ✅ keep your manga default overlay here
    overlaySrc = "/overlays/my-overlay4.png",
    posterFallbackChar,
    backdropHeightClassName = "h-[620px]",
    leftColumnBelowPoster,
    rightPinned,
    reserveRightClassName = "pr-[260px]",
    children,
    unoptimizedBackdrop = true,
    backdropObjectClassName = "object-bottom",
}: Props) {
    // ✅ EXACT same logic as your MediaHeaderLayout
    const showBackdropImage = typeof backdropUrl === "string" && backdropUrl.length > 0;
    const showOverlay = typeof overlaySrc === "string" && overlaySrc.length > 0;

    return (
        <div className="mx-auto max-w-6xl px-4 pt-0 pb-8">
            {/* ✅ EXACT same wrapper + offsets as MediaHeaderLayout */}
            <div className={`relative w-full overflow-hidden ${backdropHeightClassName} -mt-10`}>
                {showBackdropImage ? (
                    <Image
                        src={backdropUrl as string}
                        alt=""
                        width={1920}
                        height={1080}
                        priority
                        sizes="100vw"
                        className="h-full w-full object-cover"
                        style={{ objectPosition: "50% 20%" }}
                    />
                ) : (
                    <div className="h-full w-full bg-black" />
                )}

                {showOverlay ? (
                    <img
                        src={overlaySrc as string}
                        alt=""
                        className="pointer-events-none absolute -top-12 left-0 h-[calc(100%+3rem)] w-full object-cover"
                    />
                ) : null}
            </div>

            {/* ✅ EXACT same foreground overlap as MediaHeaderLayout */}
            <div className="-mt-35 relative z-10 px-3">
                <div className="mb-8 flex flex-row gap-7">
                    {/* LEFT: poster */}
                    <div className="flex-shrink-0 w-56">
                        {posterUrl ? (
                            <img
                                src={posterUrl}
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

                    {/* RIGHT: title + pinned + content */}
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
