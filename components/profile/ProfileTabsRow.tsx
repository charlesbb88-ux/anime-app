// components/profile/ProfileTabsRow.tsx
"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

export type ProfileTab =
    | "posts"
    | "watchlist"
    | "activity"
    | "journal"
    | "library"
    | "completions";

type Props = {
    username: string;
    activeTab?: ProfileTab;
    className?: string;

    /** visual style */
    variant?: "plain" | "card";
    /** center align tabs (desktop); still scrolls on mobile */
    center?: boolean;
};

export default function ProfileTabsRow({
    username,
    activeTab,
    className = "",
    variant = "plain",
    center = false,
}: Props) {
    const router = useRouter();
    const baseProfilePath = `/${username}`;

    function isPathActive(path: string) {
        return router.asPath === path || router.asPath.startsWith(`${path}/`);
    }

    const computedActive: ProfileTab = useMemo(() => {
        if (activeTab) return activeTab;
        if (isPathActive(`${baseProfilePath}/completions`)) return "completions";
        if (isPathActive(`${baseProfilePath}/watchlist`)) return "watchlist";
        if (isPathActive(`${baseProfilePath}/activity`)) return "activity";
        if (isPathActive(`${baseProfilePath}/journal`)) return "journal";
        if (isPathActive(`${baseProfilePath}/library`)) return "library";
        return "posts";
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, router.asPath, baseProfilePath]);

    function tabClass(isActive: boolean) {
        return [
            "inline-flex items-center",
            "pt-[2px] pb-1",
            "text-[14px] leading-3 font-semibold tracking-wide",
            isActive
                ? "border-b-2 border-black text-black"
                : "text-slate-500 hover:text-slate-800",
        ].join(" ");
    }

    const navClass = [
        // container
        variant === "card" ? "rounded-sm bg-white border-3 border-black" : "",
        // padding
        variant === "card" ? "px-4" : "",
        // bottom divider ONLY for plain variant (card already has a full border)
        variant === "card" ? "" : "border-b border-slate-200",
        "min-w-0",
        "overflow-x-auto whitespace-nowrap [-webkit-overflow-scrolling:touch]",
        "overflow-y-visible",
        "py-1",
        "md:overflow-visible",
    ]
        .filter(Boolean)
        .join(" ");

    const innerClass = [
        "flex gap-8 w-max md:w-auto",
        center ? "md:justify-center md:w-full" : "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={`w-full ${className}`}>
            <nav className={navClass}>
                <div className={innerClass}>
                    <Link href={baseProfilePath} className={tabClass(computedActive === "posts")}>
                        Posts
                    </Link>

                    <Link
                        href={`${baseProfilePath}/completions`}
                        className={tabClass(computedActive === "completions")}
                    >
                        Completions
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
                </div>
            </nav>
        </div>
    );
}