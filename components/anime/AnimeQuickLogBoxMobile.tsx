// components/anime/AnimeQuickLogBoxMobile.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { buildChapterNavGroups } from "@/lib/chapterNavigation";
import type { NavGroup } from "@/lib/chapterNavigation";
import { createAnimeEpisodeLog } from "@/lib/logs";

import AnimeQuickLogRowMobile from "@/components/anime/AnimeQuickLogRowMobile";

type EpisodeRow = {
    id: string;
    anime_id: string;
    episode_number: number; // normalized
    title: string | null;
};

type EpisodeRowRaw = {
    id: string;
    anime_id: string;
    episode_number: any; // may come back as string/number
    title: string | null;
};

type SeasonMapRow = {
    mapping: Record<string, string[]> | null;
};

type Props = {
    animeId: string;
    totalEpisodes?: number | null;
    onOpenLog: (episodeId?: string) => void;
    widthClassName?: string;

    // bump this from the page when an episode log/review is created via the modal
    refreshToken?: number;
};

type DragScrollOptions = {
    ignoreFromSelector?: string;
    allowInteractiveTargets?: boolean;
    thresholdPx?: number;
};

type DragScrollHook = {
    ref: React.MutableRefObject<HTMLDivElement | null>;
    drag: React.MutableRefObject<{
        isDown: boolean;
        startY: number;
        startScrollTop: number;
        moved: boolean;
        pointerId: number | null;
        captured: boolean;
    }>;
    bind: {
        onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
        onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
        onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
        onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
        onPointerLeave: (e: React.PointerEvent<HTMLDivElement>) => void;
    };
};

function toFiniteNumber(v: any): number | null {
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v === "string") {
        const n = Number.parseFloat(v);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

function intPart(n: number) {
    return Math.floor(n);
}

function useDragScroll(options?: DragScrollOptions): DragScrollHook {
    const ref = useRef<HTMLDivElement | null>(null);

    const ignoreFromSelector = options?.ignoreFromSelector ?? "";
    const allowInteractiveTargets = options?.allowInteractiveTargets ?? false;
    const thresholdPx = options?.thresholdPx ?? 3;

    const drag = useRef<{
        isDown: boolean;
        startY: number;
        startScrollTop: number;
        moved: boolean;
        pointerId: number | null;
        captured: boolean;
    }>({
        isDown: false,
        startY: 0,
        startScrollTop: 0,
        moved: false,
        pointerId: null,
        captured: false,
    });

    function isInsideIgnoreZone(target: EventTarget | null) {
        if (!ignoreFromSelector) return false;
        const el = target as HTMLElement | null;
        if (!el) return false;
        return Boolean(el.closest(ignoreFromSelector));
    }

    function isInteractive(target: EventTarget | null) {
        const el = target as HTMLElement | null;
        if (!el) return false;
        return Boolean(
            el.closest(
                'button, a, input, textarea, select, label, [role="button"], [data-no-drag="true"]'
            )
        );
    }

    function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
        const el = ref.current;
        if (!el) return;

        if (e.pointerType === "mouse" && (e as any).button !== 0) return;
        if (isInsideIgnoreZone(e.target)) return;
        if (!allowInteractiveTargets && isInteractive(e.target)) return;

        drag.current.isDown = true;
        drag.current.moved = false;
        drag.current.startY = e.clientY;
        drag.current.startScrollTop = el.scrollTop;
        drag.current.pointerId = e.pointerId;
        drag.current.captured = false;
    }

    function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
        const el = ref.current;
        if (!el) return;
        if (!drag.current.isDown) return;
        if (drag.current.pointerId !== e.pointerId) return;

        const dy = e.clientY - drag.current.startY;

        if (!drag.current.moved && Math.abs(dy) >= thresholdPx) {
            drag.current.moved = true;

            if (!drag.current.captured) {
                try {
                    (e.currentTarget as any).setPointerCapture?.(e.pointerId);
                    drag.current.captured = true;
                } catch {
                    // ignore
                }
            }

            e.preventDefault();
        }

        if (drag.current.moved) {
            el.scrollTop = drag.current.startScrollTop - dy;
        }
    }

    function endPointer(e: React.PointerEvent<HTMLDivElement>) {
        if (!drag.current.isDown) return;
        if (drag.current.pointerId !== e.pointerId) return;

        drag.current.isDown = false;
        drag.current.pointerId = null;
        drag.current.captured = false;

        setTimeout(() => {
            drag.current.moved = false;
        }, 0);
    }

    return {
        ref,
        drag,
        bind: {
            onPointerDown,
            onPointerMove,
            onPointerUp: endPointer,
            onPointerCancel: endPointer,
            onPointerLeave: endPointer,
        },
    };
}

export default function AnimeQuickLogBoxMobile({
    animeId,
    totalEpisodes,
    onOpenLog,
    widthClassName,
    refreshToken,
}: Props) {
    const [open, setOpen] = useState(false);

    const [episodes, setEpisodes] = useState<EpisodeRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [errMsg, setErrMsg] = useState<string | null>(null);

    const [seasonMap, setSeasonMap] = useState<Record<string, string[]> | null>(null);
    const [seasonMapLoaded, setSeasonMapLoaded] = useState(false);

    const [busyId, setBusyId] = useState<string | null>(null);
    const [msg, setMsg] = useState<string | null>(null);

    const [logCounts, setLogCounts] = useState<Record<string, number>>({});
    const [logBump, setLogBump] = useState(0);

    const [reviewCounts, setReviewCounts] = useState<Record<string, number>>({});
    const [reviewBump, setReviewBump] = useState(0);

    const [expandedSeasonKey, setExpandedSeasonKey] = useState<string | null>(null);

    const fetchedForAnimeId = useRef<string | null>(null);

    const panelDrag = useDragScroll({
        allowInteractiveTargets: true,
        ignoreFromSelector: "[data-inner-drag='true']",
        thresholdPx: 3,
    });

    const innerDrag = useDragScroll({
        allowInteractiveTargets: false,
        thresholdPx: 3,
    });

    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

    // 1) Load episodes
    useEffect(() => {
        if (!animeId) return;
        if (fetchedForAnimeId.current === animeId) return;

        let cancelled = false;

        async function run() {
            setLoading(true);
            setErrMsg(null);
            setMsg(null);

            const { data, error } = await supabase
                .from("anime_episodes")
                .select("id, anime_id, episode_number, title")
                .eq("anime_id", animeId)
                .order("episode_number", { ascending: true });

            if (cancelled) return;

            if (error || !data) {
                console.error("AnimeQuickLogBoxMobile: error loading episodes", error);
                setEpisodes([]);
                setErrMsg("Couldn’t load episodes.");
                fetchedForAnimeId.current = null;
                setLoading(false);
                return;
            }

            const normalized: EpisodeRow[] = (data as EpisodeRowRaw[])
                .map((row) => {
                    const n = toFiniteNumber(row.episode_number);
                    return {
                        id: row.id,
                        anime_id: row.anime_id,
                        episode_number: n ?? Number.NaN,
                        title: row.title ?? null,
                    };
                })
                .filter((r) => Number.isFinite(r.episode_number) && r.episode_number > 0)
                .sort((a, b) => a.episode_number - b.episode_number);

            setEpisodes(normalized);
            fetchedForAnimeId.current = animeId;
            setLoading(false);
        }

        run();

        return () => {
            cancelled = true;
        };
    }, [animeId]);

    // 2) Load season map
    useEffect(() => {
        if (!animeId) return;

        let cancelled = false;

        async function run() {
            setSeasonMap(null);
            setSeasonMapLoaded(false);
            setExpandedSeasonKey(null);

            const { data, error } = await supabase
                .from("anime_season_episode_map")
                .select("mapping")
                .eq("anime_id", animeId)
                .eq("source", "anilist")
                .maybeSingle();

            if (cancelled) return;

            if (!error && data) {
                const row = data as unknown as SeasonMapRow;
                if (row?.mapping && typeof row.mapping === "object") setSeasonMap(row.mapping);
                else setSeasonMap(null);
            } else {
                if (error) console.warn("AnimeQuickLogBoxMobile: season map load failed", error);
                setSeasonMap(null);
            }

            setSeasonMapLoaded(true);
        }

        run();

        return () => {
            cancelled = true;
        };
    }, [animeId]);

    // 3) Load LOG counts
    useEffect(() => {
        if (!animeId) return;

        let cancelled = false;

        async function run() {
            const {
                data: { user },
                error: userErr,
            } = await supabase.auth.getUser();

            if (cancelled) return;

            if (userErr || !user) {
                setLogCounts({});
                return;
            }

            const { data, error } = await supabase
                .from("anime_episode_logs")
                .select("anime_episode_id")
                .eq("anime_id", animeId)
                .eq("user_id", user.id)
                .limit(5000);

            if (cancelled) return;

            if (error || !data) {
                console.warn("AnimeQuickLogBoxMobile: failed to load episode log counts", error);
                setLogCounts({});
                return;
            }

            const counts: Record<string, number> = {};
            for (const row of data as any[]) {
                const id = row?.anime_episode_id as string | null;
                if (!id) continue;
                counts[id] = (counts[id] ?? 0) + 1;
            }

            setLogCounts(counts);
        }

        run();

        return () => {
            cancelled = true;
        };
    }, [animeId, refreshToken, logBump]);

    // 4) Load REVIEW counts
    useEffect(() => {
        if (!animeId) return;

        let cancelled = false;

        async function run() {
            const {
                data: { user },
                error: userErr,
            } = await supabase.auth.getUser();

            if (cancelled) return;

            if (userErr || !user) {
                setReviewCounts({});
                return;
            }

            const { data, error } = await supabase
                .from("reviews")
                .select("anime_episode_id")
                .eq("anime_id", animeId)
                .eq("user_id", user.id)
                .not("anime_episode_id", "is", null)
                .limit(5000);

            if (cancelled) return;

            if (error || !data) {
                console.warn("AnimeQuickLogBoxMobile: failed to load episode review counts", error);
                setReviewCounts({});
                return;
            }

            const counts: Record<string, number> = {};
            for (const row of data as any[]) {
                const id = row?.anime_episode_id as string | null;
                if (!id) continue;
                counts[id] = (counts[id] ?? 0) + 1;
            }

            setReviewCounts(counts);
        }

        run();

        return () => {
            cancelled = true;
        };
    }, [animeId, refreshToken, reviewBump]);

    const derivedTotalEpisodes = useMemo(() => {
        if (typeof totalEpisodes === "number" && Number.isFinite(totalEpisodes) && totalEpisodes > 0) {
            return totalEpisodes;
        }
        if (episodes.length === 0) return null;
        const max = episodes[episodes.length - 1]?.episode_number;
        if (typeof max !== "number" || !Number.isFinite(max)) return null;
        return Math.max(1, Math.floor(max));
    }, [totalEpisodes, episodes]);

    const cappedTotal = useMemo(() => {
        if (typeof derivedTotalEpisodes !== "number") return null;
        return Math.min(derivedTotalEpisodes, 5000);
    }, [derivedTotalEpisodes]);

    const navGroups = useMemo<NavGroup[]>(() => {
        if (!seasonMapLoaded) return [];
        return buildChapterNavGroups({
            volumeMap: seasonMap,
            totalChapters: cappedTotal,
            chunkSize: 25,
        });
    }, [seasonMapLoaded, seasonMap, cappedTotal]);

    const hasNavGroups = seasonMapLoaded && navGroups.length > 0;

    const episodesByInt = useMemo(() => {
        const map: Record<number, EpisodeRow[]> = {};
        for (const ep of episodes) {
            const k = intPart(ep.episode_number);
            (map[k] ??= []).push(ep);
        }
        for (const kStr of Object.keys(map)) {
            const k = Number(kStr);
            map[k].sort((a, b) => a.episode_number - b.episode_number);
        }
        return map;
    }, [episodes]);

    const sections = useMemo(() => {
        if (hasNavGroups) {
            return navGroups.map((g) => {
                const ints = g.chapters.slice().sort((a, b) => a - b);

                if (g.kind === "volume") {
                    return {
                        key: g.key,
                        labelTop: g.labelTop,
                        labelBottom: g.labelBottom ?? null,
                        intEpisodeNums: ints,
                    };
                }

                const start = ints[0];
                const end = ints[ints.length - 1];

                return {
                    key: g.key,
                    labelTop: `Ep ${start}–${end}`,
                    labelBottom: null,
                    intEpisodeNums: ints,
                };
            });
        }

        const ints = Array.from(new Set(episodes.map((e) => intPart(e.episode_number)))).sort(
            (a, b) => a - b
        );

        const min = ints.length ? ints[0] : null;
        const max = ints.length ? ints[ints.length - 1] : null;

        return [
            {
                key: "all",
                labelTop: "All",
                labelBottom: min !== null && max !== null ? `${min}–${max}` : null,
                intEpisodeNums: ints,
            },
        ];
    }, [hasNavGroups, navGroups, episodes]);

    const expandedSection = useMemo(() => {
        if (!expandedSeasonKey) return null;
        return sections.find((s) => s.key === expandedSeasonKey) ?? null;
    }, [sections, expandedSeasonKey]);

    const expandedEpisodes = useMemo(() => {
        if (!expandedSection) return [];
        const out: EpisodeRow[] = [];
        for (const n of expandedSection.intEpisodeNums) {
            const bucket = episodesByInt[n];
            if (bucket?.length) out.push(...bucket);
        }
        out.sort((a, b) => a.episode_number - b.episode_number);
        return out;
    }, [expandedSection, episodesByInt]);

    const canInteract = !loading && !errMsg && episodes.length > 0;

    function getSectionProgress(sectionKey: string) {
        const s = sections.find((x) => x.key === sectionKey);
        if (!s) return { logged: 0, total: 0, pct: 0 };

        let totalLocal = 0;
        let loggedLocal = 0;

        for (const n of s.intEpisodeNums) {
            const bucket = episodesByInt[n];
            if (!bucket?.length) continue;

            for (const ep of bucket) {
                totalLocal += 1;
                if ((logCounts[ep.id] ?? 0) > 0) loggedLocal += 1;
            }
        }

        const pct = totalLocal > 0 ? Math.round((loggedLocal / totalLocal) * 1000) / 10 : 0;
        return { logged: loggedLocal, total: totalLocal, pct };
    }

    async function quickLogEpisode(ep: EpisodeRow) {
        if (!ep?.id) return;
        if (!canInteract) return;
        if (busyId) return;

        setBusyId(ep.id);
        setMsg(null);

        try {
            const { data: auth, error: authErr } = await supabase.auth.getUser();
            const user = auth?.user;

            if (authErr || !user) {
                setMsg("You must be logged in to log.");
                return;
            }

            {
                const del = await supabase
                    .from("user_marks")
                    .delete()
                    .eq("user_id", user.id)
                    .eq("kind", "watched")
                    .eq("anime_id", animeId)
                    .eq("anime_episode_id", ep.id)
                    .is("manga_id", null)
                    .is("manga_chapter_id", null);

                if (del.error) {
                    console.error("[AnimeQuickLogBoxMobile] watched mark delete failed:", del.error);
                    setMsg("Couldn’t log (watched mark failed).");
                    return;
                }

                const ins = await supabase.from("user_marks").insert({
                    user_id: user.id,
                    kind: "watched",
                    anime_id: animeId,
                    anime_episode_id: ep.id,
                });

                if (ins.error) {
                    console.error("[AnimeQuickLogBoxMobile] watched mark insert failed:", ins.error);
                    setMsg("Couldn’t log (watched mark failed).");
                    return;
                }
            }

            {
                const { error } = await createAnimeEpisodeLog({
                    anime_id: animeId,
                    anime_episode_id: ep.id,
                    rating: null,
                    liked: false,
                    review_id: null,
                    note: null,
                    contains_spoilers: false,
                });

                if (error) {
                    console.error("[AnimeQuickLogBoxMobile] createAnimeEpisodeLog failed:", error);
                    setMsg("Couldn’t log (see console).");
                    return;
                }
            }

            setLogCounts((prev) => ({
                ...prev,
                [ep.id]: (prev[ep.id] ?? 0) + 1,
            }));
            setLogBump((n) => n + 1);

            setMsg(`Logged Ep ${ep.episode_number} ✅`);
        } finally {
            setBusyId(null);
        }
    }

    function scrollSectionIntoPanelView(sectionKey: string) {
        const panel = panelDrag.ref.current;
        const card = sectionRefs.current[sectionKey];
        if (!panel || !card) return;

        const panelRect = panel.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();

        const above = cardRect.top < panelRect.top;
        const below = cardRect.bottom > panelRect.bottom;

        if (above) panel.scrollTop -= panelRect.top - cardRect.top + 8;
        else if (below) panel.scrollTop += cardRect.bottom - panelRect.bottom + 8;
    }

    return (
        <div
            className={[
                // mobile: full-width, slightly softer radius, no fixed width default
                "mt-2 overflow-hidden rounded-md border border-gray-800 bg-black text-gray-200 shadow-sm",
                widthClassName ?? "w-full",
            ].join(" ")}
        >
            <style jsx global>{`
        .aqb-scroll {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .aqb-scroll::-webkit-scrollbar {
          width: 0px;
          height: 0px;
        }
      `}</style>

            <AnimeQuickLogRowMobile
                animeId={animeId}
                episodes={episodes}
                canInteract={canInteract}
                refreshToken={(refreshToken ?? 0) * 100000 + logBump + reviewBump}
                onOpenLog={onOpenLog}
                onMessage={setMsg}
                onLogCreated={() => {
                    setLogBump((n) => n + 1);
                }}
            />

            <button
                type="button"
                onClick={() =>
                    setOpen((v) => {
                        const next = !v;
                        if (next) {
                            setExpandedSeasonKey(null);
                            requestAnimationFrame(() => {
                                if (panelDrag.ref.current) panelDrag.ref.current.scrollTop = 0;
                            });
                        }
                        return next;
                    })
                }
                className={[
                    // mobile: bigger tap row, slightly larger text
                    "w-full px-3 py-2.5 text-left text-[12px] font-semibold text-gray-100",
                    "transition-colors duration-150",
                    "hover:bg-sky-500/10 active:bg-sky-500/20",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30",
                    "flex items-center justify-between",
                ].join(" ")}
            >
                <span>Episodes</span>
                <ChevronDown
                    className={["h-4 w-4 transition-transform duration-200", open ? "rotate-180" : ""].join(
                        " "
                    )}
                />
            </button>

            <Divider />

            <div
                ref={panelDrag.ref}
                {...panelDrag.bind}
                onClickCapture={(e) => {
                    if (panelDrag.drag.current.moved) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }}
                className={[
                    "aqb-scroll transition-all duration-200 ease-out",
                    "cursor-grab active:cursor-grabbing select-none",
                    // mobile: slightly shorter max height so it doesn't feel endless
                    open ? "max-h-[520px] opacity-100 overflow-y-auto" : "max-h-0 opacity-0 overflow-hidden",
                ].join(" ")}
            >
                <div className="px-2 py-2.5">
                    {loading ? (
                        <div className="text-xs text-gray-400">Loading episodes…</div>
                    ) : errMsg ? (
                        <div className="text-xs text-red-300">{errMsg}</div>
                    ) : episodes.length === 0 ? (
                        <div className="text-xs text-gray-400">No episodes found.</div>
                    ) : (
                        <>
                            <div className="flex flex-col gap-2">
                                {sections.map((s) => {
                                    const isOpen = expandedSeasonKey === s.key;
                                    const prog = getSectionProgress(s.key);
                                    const hasProg = prog.total > 0;

                                    return (
                                        <div
                                            key={s.key}
                                            ref={(el) => {
                                                sectionRefs.current[s.key] = el;
                                            }}
                                            className="rounded-md p-[2px]"
                                            style={{
                                                backgroundImage: hasProg
                                                    ? `conic-gradient(#0ea5e9 0 ${prog.pct}%, rgba(55,65,81,0.7) ${prog.pct}% 100%)`
                                                    : undefined,
                                                backgroundColor: hasProg ? undefined : "rgba(55,65,81,0.7)",
                                            }}
                                        >
                                            <div
                                                className={[
                                                    "overflow-hidden rounded-md border border-gray-800 bg-black",
                                                    "transition-all duration-200",
                                                    "hover:border-sky-500/70 hover:shadow-[0_0_0_1px_rgba(14,165,233,0.35)]",
                                                    "hover:bg-[#0b1220]",
                                                ].join(" ")}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (panelDrag.drag.current.moved) return;

                                                        setMsg(null);
                                                        setExpandedSeasonKey((cur) => {
                                                            const next = cur === s.key ? null : s.key;
                                                            if (next) {
                                                                requestAnimationFrame(() => {
                                                                    scrollSectionIntoPanelView(s.key);
                                                                });
                                                            }
                                                            return next;
                                                        });
                                                    }}
                                                    className={[
                                                        "w-full px-3 py-2.5 text-left",
                                                        "flex items-center justify-between",
                                                        "transition-colors duration-150",
                                                        "hover:bg-sky-500/10 active:bg-sky-500/20",
                                                        "focus:outline-none focus:ring-2 focus:ring-sky-500/30",
                                                    ].join(" ")}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[12px] font-semibold text-gray-100">
                                                            {s.labelTop}
                                                        </span>
                                                        <ChevronDown
                                                            className={[
                                                                "h-4 w-4 text-gray-400 transition-transform duration-200",
                                                                isOpen ? "rotate-180" : "",
                                                            ].join(" ")}
                                                        />
                                                    </div>

                                                    {s.labelBottom ? (
                                                        <span className="text-[11px] font-semibold text-gray-400">
                                                            {s.labelBottom}
                                                        </span>
                                                    ) : null}
                                                </button>

                                                <div
                                                    className="grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out"
                                                    style={{
                                                        gridTemplateRows: isOpen ? "1fr" : "0fr",
                                                        opacity: isOpen ? 1 : 0,
                                                    }}
                                                >
                                                    <div className="min-h-0 overflow-hidden">
                                                        <div className="px-0 pb-0">
                                                            <div
                                                                data-inner-drag="true"
                                                                ref={isOpen ? innerDrag.ref : undefined}
                                                                {...(isOpen ? innerDrag.bind : {})}
                                                                onClickCapture={(e) => {
                                                                    if (!isOpen) return;
                                                                    if (innerDrag.drag.current.moved) {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                    }
                                                                }}
                                                                className={[
                                                                    // mobile: a bit shorter list
                                                                    "aqb-scroll max-h-[260px] overflow-y-auto",
                                                                    "rounded-md border border-gray-800 bg-black",
                                                                    "cursor-grab active:cursor-grabbing select-none",
                                                                ].join(" ")}
                                                            >
                                                                {!isOpen ? null : expandedEpisodes.length === 0 ? (
                                                                    <div className="px-3 py-3 text-xs text-gray-500">
                                                                        No episodes found for this section.
                                                                    </div>
                                                                ) : (
                                                                    <div className="divide-y divide-gray-800">
                                                                        {expandedEpisodes.map((ep) => {
                                                                            const title =
                                                                                typeof ep.title === "string" && ep.title.trim()
                                                                                    ? ep.title.trim()
                                                                                    : null;

                                                                            const rowBusy = busyId === ep.id;

                                                                            const logCount = logCounts[ep.id] ?? 0;
                                                                            const isLogged = logCount > 0;
                                                                            const showLogBadge = logCount > 1;

                                                                            const reviewCount = reviewCounts[ep.id] ?? 0;
                                                                            const hasReview = reviewCount > 0;
                                                                            const showReviewBadge = reviewCount > 1;

                                                                            return (
                                                                                <div
                                                                                    key={ep.id}
                                                                                    className="flex items-center justify-between gap-2 px-3 py-2.5"
                                                                                >
                                                                                    <div className="min-w-0">
                                                                                        <div className="text-[12px] font-semibold text-gray-100">
                                                                                            Ep {ep.episode_number}
                                                                                        </div>
                                                                                        {title ? (
                                                                                            <div className="mt-0.5 truncate text-[11px] text-gray-500">
                                                                                                {title}
                                                                                            </div>
                                                                                        ) : null}
                                                                                    </div>

                                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                                        <button
                                                                                            type="button"
                                                                                            disabled={!canInteract || rowBusy}
                                                                                            onClick={() => {
                                                                                                if (innerDrag.drag.current.moved) return;
                                                                                                onOpenLog(ep.id);
                                                                                                setReviewBump((n) => n + 1);
                                                                                            }}
                                                                                            className={[
                                                                                                // mobile: slightly larger button
                                                                                                "relative rounded-md border px-3.5 py-2 text-[11px] font-semibold",
                                                                                                "transition-all duration-150",
                                                                                                hasReview
                                                                                                    ? "border-sky-500/70 text-sky-300 bg-sky-500/10"
                                                                                                    : "border-gray-700 text-gray-200",
                                                                                                "hover:border-sky-500/70 hover:bg-sky-500/10",
                                                                                                "active:bg-sky-500/20 active:scale-[0.98]",
                                                                                                "focus:outline-none focus:ring-2 focus:ring-sky-500/30",
                                                                                                !canInteract || rowBusy
                                                                                                    ? "opacity-60 cursor-not-allowed"
                                                                                                    : "",
                                                                                            ].join(" ")}
                                                                                        >
                                                                                            Review
                                                                                            {showReviewBadge ? (
                                                                                                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-bold leading-none text-black">
                                                                                                    {reviewCount}
                                                                                                </span>
                                                                                            ) : null}
                                                                                        </button>

                                                                                        <button
                                                                                            type="button"
                                                                                            disabled={!canInteract || rowBusy}
                                                                                            onClick={() => {
                                                                                                if (innerDrag.drag.current.moved) return;
                                                                                                quickLogEpisode(ep);
                                                                                            }}
                                                                                            className={[
                                                                                                "relative inline-flex h-9 w-9 items-center justify-center rounded-full border",
                                                                                                "transition-all duration-150",
                                                                                                isLogged
                                                                                                    ? "border-sky-500 text-sky-400 bg-sky-500/10"
                                                                                                    : "border-gray-700 text-gray-200",
                                                                                                "hover:border-sky-400 hover:bg-sky-500/20",
                                                                                                "active:scale-95",
                                                                                                "focus:outline-none focus:ring-2 focus:ring-sky-500/40",
                                                                                                !canInteract || rowBusy
                                                                                                    ? "opacity-60 cursor-not-allowed"
                                                                                                    : "",
                                                                                            ].join(" ")}
                                                                                            aria-label={`Quick log episode ${ep.episode_number}`}
                                                                                            title={
                                                                                                isLogged
                                                                                                    ? logCount > 1
                                                                                                        ? `Logged ${logCount} times`
                                                                                                        : "Logged"
                                                                                                    : "Quick log"
                                                                                            }
                                                                                        >
                                                                                            <Check className="h-4 w-4" />
                                                                                            {showLogBadge ? (
                                                                                                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-bold leading-none text-black">
                                                                                                    {logCount}
                                                                                                </span>
                                                                                            ) : null}
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {msg ? <div className="mt-2.5 text-xs text-gray-300">{msg}</div> : null}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function Divider() {
    return <div className="h-px bg-gray-700/60" />;
}
