// components/layouts/ProfileMediaHeaderLayout.tsx
"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";

type Tab = "posts" | "bookmarks" | "watchlist" | "activity" | "journal" | "library";

type Props = {
    backdropUrl: string | null;

    /** ✅ NEW: positioning values from DB */
    backdropPosX?: number | null; // backdrop_pos_x
    backdropPosY?: number | null; // backdrop_pos_y
    backdropZoom?: number | null; // backdrop_zoom

    /** optional so you can hide it (prevents the stray @username in top-left) */
    title?: string;

    /** profile info (drives the built-in nav) */
    username: string;
    avatarUrl: string | null;
    bio?: string | null;

    /** optional; if not provided, we infer from router.asPath */
    activeTab?: Tab;

    overlaySrc?: string | null;
    backdropHeightClassName?: string;

    rightPinned?: React.ReactNode;

    /** how much space to reserve on the right so pinned button doesn't overlap header content */
    reserveRightClassName?: string;

    unoptimizedBackdrop?: boolean;
    backdropObjectClassName?: string;
    backdropObjectPosition?: string;
};

export default function ProfileMediaHeaderLayout({
    backdropUrl,
    backdropPosX = 50,
    backdropPosY = 20,
    backdropZoom = 1,
    title,

    username,
    avatarUrl,
    bio,
    activeTab,

    overlaySrc = "/overlays/my-overlay4.png",
    backdropHeightClassName = "h-[620px]",
    rightPinned,
    reserveRightClassName = "pr-[260px]",
    unoptimizedBackdrop = true,
    backdropObjectClassName = "object-bottom",
    backdropObjectPosition = "50% 20%",
}: Props) {
    const router = useRouter();

    const showBackdropImage = typeof backdropUrl === "string" && backdropUrl.length > 0;
    const showOverlay = typeof overlaySrc === "string" && overlaySrc.length > 0;

    const avatarInitial = useMemo(() => {
        const u = username?.trim();
        return u && u.length > 0 ? u.charAt(0).toUpperCase() : "?";
    }, [username]);

    const baseProfilePath = `/${username}`;

    function isPathActive(path: string) {
        return router.asPath === path || router.asPath.startsWith(`${path}/`);
    }

    // ✅ match ProfileTopNav colors exactly (slate)
    function tabClass(isActive: boolean) {
        return `pb-2 ${isActive
            ? "border-b-2 border-slate-900 text-slate-900"
            : "text-slate-500 hover:text-slate-800"
            }`;
    }

    const computedActive: Tab = useMemo(() => {
        if (activeTab) return activeTab;

        if (isPathActive(`${baseProfilePath}/bookmarks`)) return "bookmarks";
        if (isPathActive(`${baseProfilePath}/watchlist`)) return "watchlist";
        if (isPathActive(`${baseProfilePath}/activity`)) return "activity";
        if (isPathActive(`${baseProfilePath}/journal`)) return "journal";
        if (isPathActive(`${baseProfilePath}/library`)) return "library";
        return "posts";
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, router.asPath, baseProfilePath]);

    // ✅ NEW: compute backdrop positioning + zoom safely
    const posX = Number.isFinite(backdropPosX as number) ? (backdropPosX as number) : 50;
    const posY = Number.isFinite(backdropPosY as number) ? (backdropPosY as number) : 20;
    const zoomRaw = Number.isFinite(backdropZoom as number) ? (backdropZoom as number) : 1;

    // keep it reasonable so it can’t explode layout
    const zoom = Math.min(3, Math.max(1, zoomRaw));

    const computedObjectPosition = backdropObjectPosition ?? `${posX}% ${posY}%`;

    return (
        <div className="mx-auto max-w-6xl px-4 pt-0 pb-0">
            {/* Backdrop (keep exactly like your "good" version) */}
            <div className={`relative w-full overflow-hidden ${backdropHeightClassName} -mt-10`}>
                {showBackdropImage ? (
                    <div
                        className="absolute inset-0"
                        style={{
                            backgroundImage: `url(${backdropUrl})`,
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: `${posX}% ${posY}%`,
                            backgroundSize: `${zoom * 100}%`,
                        }}
                    />
                ) : (
                    <div className="h-full w-full bg-black" />
                )}

                {showOverlay ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={overlaySrc as string}
                        alt=""
                        className="pointer-events-none absolute -top-12 left-0 h-[calc(100%+3rem)] w-full object-cover"
                    />
                ) : null}
            </div>

            {/* Foreground overlap */}
            <div className="-mt-35 relative z-10 px-3">
                {/* Optional title (prevents stray text if you omit it) */}
                {title ? (
                    <h1 className="mb-3 text-4xl font-bold leading-tight text-white drop-shadow">
                        {title}
                    </h1>
                ) : null}

                {/* IMPORTANT: rightPinned should NOT affect centering of the tabs */}
                <div className="relative w-full">
                    {rightPinned ? <div className="absolute right-0 top-1">{rightPinned}</div> : null}

                    {/* Only reserve space for the *left header row* so the button never overlaps it */}
                    <div className={`min-w-0 ${rightPinned ? reserveRightClassName : ""}`}>
                        {/* Avatar + username (LEFT) */}
                        <div className="-mt-50 flex items-center gap-3 pl-2">
                            <div className="w-38 h-38 rounded-full bg-slate-200 overflow-hidden shrink-0 ring-3 ring-black">
                                {avatarUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-sm font-semibold text-slate-700">{avatarInitial}</span>
                                )}
                            </div>

                            <div className="text-3xl font-bold text-slate-900">@{username}</div>
                        </div>

                        {/* Bio (LEFT) */}
                        {bio ? (
                            <div className="mt-2">
                                <p className="text-sm text-slate-800 whitespace-pre-line max-w-2xl">{bio}</p>
                            </div>
                        ) : null}
                    </div>

                    {/* Tabs row: truly centered to the full header width (ignores reserveRightClassName) */}
                    <div className="mt-4">
                        <div className="grid grid-cols-[1fr_auto_1fr] items-end">
                            <div />
                            <nav className="flex gap-8 text-sm font-medium border-b border-slate-200">
                                <Link href={baseProfilePath} className={tabClass(computedActive === "posts")}>
                                    Posts
                                </Link>

                                <Link
                                    href={`${baseProfilePath}/bookmarks`}
                                    className={tabClass(computedActive === "bookmarks")}
                                >
                                    Bookmarks
                                </Link>

                                <Link
                                    href={`${baseProfilePath}/watchlist`}
                                    className={tabClass(computedActive === "watchlist")}
                                >
                                    Watchlist
                                </Link>

                                <Link
                                    href={`${baseProfilePath}/activity`}
                                    className={tabClass(computedActive === "activity")}
                                >
                                    Activity
                                </Link>

                                <Link
                                    href={`${baseProfilePath}/journal`}
                                    className={tabClass(computedActive === "journal")}
                                >
                                    Journal
                                </Link>

                                <Link
                                    href={`${baseProfilePath}/library`}
                                    className={tabClass(computedActive === "library")}
                                >
                                    My Library
                                </Link>
                            </nav>
                            <div />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
