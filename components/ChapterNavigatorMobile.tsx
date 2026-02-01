// components/ChapterNavigatorMobile.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { buildChapterNavGroups } from "@/lib/chapterNavigation";
import type { NavGroup } from "@/lib/chapterNavigation";

type Props = {
    slug: string;
    totalChapters?: number | null;
    currentChapterNumber?: number | null; // null on main manga page
    className?: string;
};

type ChapterRow = {
    id: string;
    chapter_number: number;
    title: string | null;
};

type CoverRow = {
    volume: string | null;
    locale: string | null;
    cached_url: string | null;
    is_main: boolean | null;
};

type ChapterMeta = {
    title: string | null;
};

type VolumeMapRow = {
    mapping: Record<string, string[]> | null;
};

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}
function pad2(n: number) {
    return String(n).padStart(2, "0");
}
function isNumericLike(s: string) {
    return /^(\d+)(\.\d+)?$/.test(String(s).trim());
}

function normVol(v: any): string | null {
    const s0 = String(v ?? "").trim();
    if (!s0) return null;
    if (s0.toLowerCase() === "none") return null;

    if (/^\d+(\.\d+)?$/.test(s0)) {
        const n = Number(s0);
        if (!Number.isFinite(n) || n <= 0) return null;
        return String(Math.trunc(n));
    }

    const m = s0.match(/(\d+)/);
    if (m?.[1]) {
        const n = Number(m[1]);
        if (Number.isFinite(n) && n > 0) return String(Math.trunc(n));
    }

    return s0;
}

function pickBestCoverUrl(rows: CoverRow[]): string | null {
    const usable = (rows || []).filter((r) => r?.cached_url);
    if (!usable.length) return null;

    const mains = usable.filter((r) => r.is_main);
    const pool = mains.length ? mains : usable;

    const pref = ["en", "ja"];
    for (const p of pref) {
        const hit = pool.find(
            (r) => (r.locale || "").toLowerCase() === p && r.cached_url
        );
        if (hit?.cached_url) return hit.cached_url;
    }

    return pool[0].cached_url ?? null;
}

function hashStringToUint32(str: string) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function pickStableRandomFromPool(pool: string[], seed: string): string | null {
    if (!pool.length) return null;
    const h = hashStringToUint32(seed);
    return pool[h % pool.length] ?? null;
}

export default function ChapterNavigatorMobile({
    slug,
    totalChapters,
    currentChapterNumber,
    className,
}: Props) {
    const scrollerRef = useRef<HTMLDivElement | null>(null);

    const [viewportW, setViewportW] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    // 👇 this is the big difference vs the “stiff” feel:
    // update React state LESS OFTEN while you fling (top row effectively does 0 JS)
    const rafRef = useRef<number | null>(null);
    const lastEmitMsRef = useRef(0);
    const liveScrollLeftRef = useRef(0);

    const [mangaId, setMangaId] = useState<string | null>(null);
    const [derivedTotalChapters, setDerivedTotalChapters] = useState<number | null>(
        null
    );

    const [volumeMap, setVolumeMap] = useState<Record<string, string[]> | null>(
        null
    );
    const [volumeMapLoaded, setVolumeMapLoaded] = useState(false);
    const [selectedVolume, setSelectedVolume] = useState<string | null>(null); // null = All

    const [coverRows, setCoverRows] = useState<CoverRow[]>([]);
    const [metaByNumber, setMetaByNumber] = useState<Record<number, ChapterMeta>>(
        {}
    );

    // layout tuned for mobile
    const CARD_W = 110;
    const GAP = 12;
    const STEP = CARD_W + GAP;

    const propTotal =
        typeof totalChapters === "number" &&
            Number.isFinite(totalChapters) &&
            totalChapters > 0
            ? Math.floor(totalChapters)
            : null;

    const total = propTotal ?? derivedTotalChapters;
    const hasTotal =
        typeof total === "number" && Number.isFinite(total) && total > 0;
    const cappedTotal = hasTotal ? Math.min(total as number, 5000) : null;

    const current =
        typeof currentChapterNumber === "number" ? currentChapterNumber : null;

    const currentSafe =
        typeof current === "number" && Number.isFinite(current) && current > 0
            ? current
            : null;

    const mangaHref = `/manga/${encodeURIComponent(slug)}`;
    const chapterBase = `${mangaHref}/chapter`;

    // measure viewport width
    useEffect(() => {
        function update() {
            const node = scrollerRef.current;
            if (!node) return;
            setViewportW(node.clientWidth || 0);
        }

        update();

        const node = scrollerRef.current;
        if (!node) return;

        const ro = new ResizeObserver(() => update());
        ro.observe(node);
        return () => ro.disconnect();
    }, []);

    // manga id lookup
    useEffect(() => {
        let cancelled = false;

        async function run() {
            setMangaId(null);
            setDerivedTotalChapters(null);
            setVolumeMap(null);
            setSelectedVolume(null);
            setVolumeMapLoaded(false);
            setCoverRows([]);
            setMetaByNumber({});
            setScrollLeft(0);
            liveScrollLeftRef.current = 0;

            if (!slug) return;

            const { data, error } = await supabase
                .from("manga")
                .select("id")
                .eq("slug", slug)
                .maybeSingle();

            if (cancelled) return;
            if (error || !data?.id) return;

            setMangaId(data.id as string);
        }

        run();
        return () => {
            cancelled = true;
        };
    }, [slug]);

    // derive total chapters
    useEffect(() => {
        let cancelled = false;

        async function run() {
            setDerivedTotalChapters(null);
            if (!mangaId) return;

            const { data, error } = await supabase
                .from("manga_chapters")
                .select("chapter_number")
                .eq("manga_id", mangaId)
                .order("chapter_number", { ascending: false })
                .limit(1);

            if (cancelled) return;
            if (error || !Array.isArray(data) || data.length === 0) return;

            const raw = (data[0] as any)?.chapter_number;
            const n = typeof raw === "number" ? raw : Number(raw);

            if (Number.isFinite(n) && n > 0) setDerivedTotalChapters(Math.floor(n));
        }

        run();
        return () => {
            cancelled = true;
        };
    }, [mangaId]);

    // volume map
    useEffect(() => {
        let cancelled = false;

        async function run() {
            setVolumeMap(null);
            setSelectedVolume(null);
            setVolumeMapLoaded(false);
            if (!mangaId) return;

            const { data, error } = await supabase
                .from("manga_volume_chapter_map")
                .select("mapping")
                .eq("manga_id", mangaId)
                .eq("source", "mangadex")
                .maybeSingle();

            if (cancelled) return;

            if (!error && data) {
                const row = data as unknown as VolumeMapRow;
                if (row?.mapping && typeof row.mapping === "object") {
                    setVolumeMap(row.mapping);
                }
            }

            setVolumeMapLoaded(true);
        }

        run();
        return () => {
            cancelled = true;
        };
    }, [mangaId]);

    // covers
    useEffect(() => {
        let cancelled = false;

        async function run() {
            setCoverRows([]);
            if (!mangaId) return;

            const { data, error } = await supabase
                .from("manga_covers")
                .select("volume, locale, cached_url, is_main")
                .eq("manga_id", mangaId)
                .not("cached_url", "is", null);

            if (cancelled) return;

            if (error || !Array.isArray(data)) {
                setCoverRows([]);
                return;
            }

            setCoverRows(
                (data as any[]).map((r) => ({
                    volume: r?.volume ?? null,
                    locale: r?.locale ?? null,
                    cached_url: r?.cached_url ?? null,
                    is_main: r?.is_main ?? null,
                }))
            );
        }

        run();
        return () => {
            cancelled = true;
        };
    }, [mangaId]);

    // nav groups
    const navGroups = useMemo<NavGroup[]>(() => {
        if (!mangaId) return [];
        if (!volumeMapLoaded) return [];

        return buildChapterNavGroups({
            volumeMap,
            totalChapters: cappedTotal ?? null,
            chunkSize: 25,
        });
    }, [mangaId, volumeMapLoaded, volumeMap, cappedTotal]);

    const showVolumeButtons = navGroups.length > 0;
    const showNavSkeleton = !!slug && (!mangaId || !volumeMapLoaded);

    // cover map by volume
    const coverUrlByVolume = useMemo(() => {
        const byVol: Record<string, CoverRow[]> = {};
        for (const r of coverRows) {
            const v = normVol(r.volume);
            if (!v) continue;
            if (!byVol[v]) byVol[v] = [];
            byVol[v].push(r);
        }

        const out: Record<string, string | null> = {};
        for (const v of Object.keys(byVol)) out[v] = pickBestCoverUrl(byVol[v]);
        return out;
    }, [coverRows]);

    const allCoverUrls = useMemo(() => {
        const urls = (coverRows || [])
            .map((r) => r?.cached_url ?? null)
            .filter((u): u is string => !!u);

        return Array.from(new Set(urls));
    }, [coverRows]);

    const chapterCoverByNumber = useMemo(() => {
        const out: Record<number, string | null> = {};

        const hasAnyVolumeGroup = navGroups.some((g) => g.kind === "volume");

        if (!hasAnyVolumeGroup) {
            for (const g of navGroups) {
                for (const ch of g.chapters) {
                    out[ch] = pickStableRandomFromPool(
                        allCoverUrls,
                        `${mangaId ?? "m"}|ch:${ch}`
                    );
                }
            }
            return out;
        }

        let lastVolumeCover: string | null = null;

        for (const g of navGroups) {
            if (g.kind === "volume") {
                const key = String(g.key || "");
                const rawVol = key.startsWith("vol:")
                    ? key.slice(4)
                    : key.startsWith("vol-")
                        ? key.slice(4)
                        : key;

                const v = normVol(rawVol);
                const cover = v ? coverUrlByVolume[v] ?? null : null;
                if (cover) lastVolumeCover = cover;

                for (const ch of g.chapters) out[ch] = cover;
            } else {
                for (const ch of g.chapters) out[ch] = lastVolumeCover;
            }
        }

        return out;
    }, [navGroups, coverUrlByVolume, allCoverUrls, mangaId]);

    // displayed chapters
    const displayChapters: number[] = useMemo(() => {
        if (selectedVolume) {
            const g = navGroups.find((n) => n.key === selectedVolume);
            if (g) return g.chapters;
        }

        if (volumeMap && typeof volumeMap === "object") {
            const all: number[] = [];
            for (const k of Object.keys(volumeMap)) {
                const arr = volumeMap[k] || [];
                for (const raw of arr) {
                    const s = String(raw ?? "").trim();
                    if (!s) continue;
                    if (!isNumericLike(s)) continue;

                    const n = Number(s);
                    if (Number.isFinite(n) && n > 0) all.push(n);
                }
            }

            const uniq = Array.from(new Set(all));
            uniq.sort((a, b) => a - b);

            if (hasTotal && cappedTotal)
                return uniq.filter((n) => n <= cappedTotal + 0.999999);

            return uniq;
        }

        if (!hasTotal || !cappedTotal) return [];
        const nums: number[] = [];
        for (let i = 1; i <= cappedTotal; i++) nums.push(i);
        return nums;
    }, [selectedVolume, navGroups, volumeMap, hasTotal, cappedTotal]);

    const chapterCount = displayChapters.length;

    // virtualized window
    const VBUF = 18;

    function onScroll() {
        const el = scrollerRef.current;
        if (!el) return;

        liveScrollLeftRef.current = el.scrollLeft;

        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;

            // 👇 throttle React updates so inertia stays buttery
            const now =
                typeof performance !== "undefined" ? performance.now() : Date.now();
            if (now - lastEmitMsRef.current < 48) return; // ~20fps renders
            lastEmitMsRef.current = now;

            setScrollLeft(liveScrollLeftRef.current);
        });
    }

    const { leftPx, rightPx, visibleChapterNumbers } = useMemo(() => {
        if (chapterCount <= 0) {
            return { leftPx: 0, rightPx: 0, visibleChapterNumbers: [] as number[] };
        }

        const maxIdx = chapterCount - 1;

        const vw = viewportW || 0;
        const left = scrollLeft || 0;

        const approxStart = Math.floor(left / STEP) - VBUF;
        const approxEnd = Math.ceil((left + vw) / STEP) + VBUF;

        const s = clamp(approxStart, 0, maxIdx);
        const e = clamp(approxEnd, 0, maxIdx);

        const nums: number[] = [];
        for (let i = s; i <= e; i++) nums.push(displayChapters[i]);

        return {
            leftPx: s * STEP,
            rightPx: (maxIdx - e) * STEP,
            visibleChapterNumbers: nums,
        };
    }, [chapterCount, displayChapters, viewportW, scrollLeft]);

    // initial scroll to current (no animation)
    useEffect(() => {
        const el = scrollerRef.current;
        if (!el) return;
        if (!viewportW) return;
        if (chapterCount <= 0) return;

        let idx = 0;
        if (currentSafe) {
            const found = displayChapters.indexOf(currentSafe);
            if (found >= 0) idx = found;
        }

        idx = clamp(idx, 0, Math.max(0, chapterCount - 1));

        // keep your centering, but DO NOT use snap (snap is what makes it “stop quick”)
        const target = idx * STEP + CARD_W / 2 - viewportW / 2;
        el.scrollLeft = Math.max(0, target);

        liveScrollLeftRef.current = el.scrollLeft;
        setScrollLeft(el.scrollLeft);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug, viewportW, selectedVolume, chapterCount]);

    // meta fetch
    useEffect(() => {
        let cancelled = false;

        async function run() {
            if (!mangaId) return;
            if (!visibleChapterNumbers.length) return;

            const missing = visibleChapterNumbers.filter((n) => !metaByNumber[n]);
            if (missing.length === 0) return;

            const wantedNums = missing.slice(0, 80);

            const { data: chs, error: chErr } = await supabase
                .from("manga_chapters")
                .select("id, chapter_number, title")
                .eq("manga_id", mangaId)
                .in("chapter_number", wantedNums);

            if (cancelled) return;

            if (chErr || !chs) {
                setMetaByNumber((prev) => {
                    const next = { ...prev };
                    for (const n of wantedNums) if (!next[n]) next[n] = { title: null };
                    return next;
                });
                return;
            }

            const rows = chs as ChapterRow[];
            const titleByNumber: Record<number, string | null> = {};

            for (const c of rows) {
                if (typeof c.chapter_number !== "number") continue;
                titleByNumber[c.chapter_number] = c.title ?? null;
            }

            setMetaByNumber((prev) => {
                const next = { ...prev };
                for (const n of wantedNums) {
                    if (!next[n]) next[n] = { title: null };
                    if (titleByNumber[n] !== undefined)
                        next[n] = { title: titleByNumber[n] };
                }
                return next;
            });
        }

        run();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mangaId, visibleChapterNumbers.join("|")]);

    // render guards
    const showNothingYet = !!slug && (!mangaId || !volumeMapLoaded);
    if (!showNothingYet && chapterCount <= 0) return null;

    const cardBase =
        "group relative shrink-0 rounded-xs bg-[var(--card-bg)] ring-1 ring-[var(--ring)] shadow-sm transition";
    const cardHover = "active:scale-[0.99]";
    const cardSize = "h-[170px] w-[110px]";

    // ✅ FIX: keep the “top row” buttons from getting taller when numbers get large.
    // - prevent wrapping on the bottom label
    // - let the button grow a bit wider instead (min-w-max = fit content)
    const pillBase =
        "select-none rounded-sm border px-0 py-1 text-xs font-semibold transition";
    const pillOn = "bg-white text-black border-black";
    const pillOff = "bg-black text-white border-white/20";

    return (
        <div
            className={["min-w-0", className ?? ""].join(" ")}
            style={
                {
                    "--card-bg": "rgba(245, 250, 255, 1)",
                    "--ring": "rgba(245, 250, 255, 1)",
                } as React.CSSProperties
            }
        >
            {/* Volume buttons (native swipe; feels great) */}
            {showVolumeButtons ? (
                <div
                    className={[
                        "mb-2 flex items-center gap-2 overflow-x-auto scrollbar-none",
                        "select-none",
                    ].join(" ")}
                    style={{
                        WebkitOverflowScrolling: "touch",
                        overscrollBehaviorX: "contain",
                    }}
                >
                    <button
                        type="button"
                        className={[
                            pillBase,
                            selectedVolume === null ? pillOn : pillOff,
                            // was min-w-[25px]
                            "min-w-max px-2",
                        ].join(" ")}
                        onClick={() => setSelectedVolume(null)}
                    >
                        <div className="flex flex-col items-center leading-tight">
                            <div className="whitespace-nowrap">All</div>
                            <div className="mt-0.5 whitespace-nowrap text-[10px] font-semibold opacity-0">
                                0–0
                            </div>
                        </div>
                    </button>

                    {navGroups.map((g) => (
                        <button
                            key={g.key}
                            type="button"
                            className={[
                                pillBase,
                                selectedVolume === g.key ? pillOn : pillOff,
                                // was min-w-[45px]
                                "min-w-max px-2",
                            ].join(" ")}
                            onClick={() => setSelectedVolume(g.key)}
                        >
                            <div className="flex flex-col items-center leading-tight">
                                <div className="whitespace-nowrap">{g.labelTop}</div>
                                <div className="mt-0.5 whitespace-nowrap text-[10px] font-semibold opacity-80">
                                    {g.labelBottom}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            ) : showNavSkeleton ? (
                <div className="mb-2 h-[39px] w-full rounded-sm bg-black/10" />
            ) : null}

            {/* Chapters:
          ✅ no scroll-snap (snap is the “stops after tiny bit” feeling)
          ✅ keep iOS momentum
          ✅ throttle React re-renders while flinging so inertia keeps going
      */}
            <div className="w-full overflow-hidden rounded-sm border border-black bg-black">
                <div
                    ref={scrollerRef}
                    className={[
                        "scrollbar-none relative flex overflow-x-auto overflow-y-hidden",
                        "px-0 py-2",
                    ].join(" ")}
                    onScroll={onScroll}
                    style={{
                        WebkitOverflowScrolling: "touch",
                        overscrollBehaviorX: "contain",
                    }}
                >
                    <div style={{ width: leftPx }} className="shrink-0" />

                    <div className="flex gap-3">
                        {visibleChapterNumbers.map((n) => {
                            const meta = metaByNumber[n];
                            const title = meta?.title ?? `Chapter ${n}`;
                            const imageUrl = chapterCoverByNumber[n] ?? null;

                            const metaLine = `CH${pad2(n)}`;
                            const isActive = currentSafe === n;

                            return (
                                <Link
                                    key={n}
                                    href={`${chapterBase}/${n}`}
                                    scroll={false}
                                    draggable={false}
                                    onDragStart={(e) => e.preventDefault()}
                                    className={[
                                        cardBase,
                                        cardHover,
                                        cardSize,
                                        isActive ? "ring-black/15 bg-white" : "",
                                    ].join(" ")}
                                    style={{
                                        contentVisibility: "auto",
                                        containIntrinsicSize: "110px 220px",
                                    }}
                                >
                                    <div className="relative h-full w-full overflow-hidden rounded-xs bg-black">
                                        {imageUrl ? (
                                            <img
                                                src={imageUrl}
                                                alt=""
                                                className="absolute inset-0 h-full w-full object-cover"
                                                draggable={false}
                                                loading="lazy"
                                                decoding="async"
                                            />
                                        ) : (
                                            <div className="absolute inset-0 bg-black" />
                                        )}

                                        <div className="absolute inset-x-0 bottom-0">
                                            <div className="bg-black/70 backdrop-blur-[2px] px-3 py-2">
                                                <div className="text-[11px] font-semibold text-white/80">
                                                    {metaLine}
                                                </div>

                                                <div
                                                    className="mt-0.5 text-sm font-semibold text-white leading-snug"
                                                    style={{
                                                        display: "-webkit-box",
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: "vertical",
                                                        overflow: "hidden",
                                                    }}
                                                >
                                                    {title}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>

                    <div style={{ width: rightPx }} className="shrink-0" />
                </div>
            </div>
        </div>
    );
}
