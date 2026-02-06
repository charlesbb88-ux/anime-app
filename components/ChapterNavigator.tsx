// components/ChapterNavigator.tsx
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
function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function findChapterIndex(nums: number[], target: number) {
  const EPS = 1e-6;
  for (let i = 0; i < nums.length; i++) {
    if (Math.abs(nums[i] - target) < EPS) return i;
  }
  return -1;
}

function isSameChapterNumber(a: number | null, b: number) {
  if (typeof a !== "number") return false;
  const EPS = 1e-6;
  return Math.abs(a - b) < EPS;
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
  // fast stable hash (FNV-1a-ish)
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

export default function ChapterNavigator({
  slug,
  totalChapters,
  currentChapterNumber,
  className,
}: Props) {
  // ---------------------------------------
  // refs / state (declare BEFORE any use)
  // ---------------------------------------
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const rafScrollRef = useRef<number | null>(null);
  const didInitialCenterRef = useRef(false);

  const snappingRef = useRef(false);
  const animRef = useRef<number | null>(null);

  const fastWheelRef = useRef(false);
  const fastWheelClearRef = useRef<number | null>(null);

  const [viewportW, setViewportW] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const [mangaId, setMangaId] = useState<string | null>(null);
  const [derivedTotalChapters, setDerivedTotalChapters] = useState<number | null>(
    null
  );

  const [volumeMap, setVolumeMap] = useState<Record<string, string[]> | null>(
    null
  );
  const [volumeMapLoaded, setVolumeMapLoaded] = useState(false);
  const [selectedVolume, setSelectedVolume] = useState<string | null>(null); // null = All
  const [volumeDragging, setVolumeDragging] = useState(false);

  const [coverRows, setCoverRows] = useState<CoverRow[]>([]);
  const [metaByNumber, setMetaByNumber] = useState<Record<number, ChapterMeta>>(
    {}
  );

  // ---------------------------------------
  // totals / routing (safe + stable)
  // ---------------------------------------
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

  // ---------------------------------------
  // layout constants
  // ---------------------------------------
  const CARD_W = 120;
  const GAP = 12;
  const STEP = CARD_W + GAP;

  // ---------------------------------------
  // viewport width tracking
  // ---------------------------------------
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

  function stopAnim() {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = null;
    snappingRef.current = false;
  }

  function scrollToIndex(idx: number, ms = 260) {
    stopAnim();

    const el0 = scrollerRef.current;
    if (!el0) return;

    snappingRef.current = true;

    const start0 = el0.scrollLeft;
    const vw0 = el0.clientWidth || viewportW || 0;
    const target0 = idx * STEP + CARD_W / 2 - vw0 / 2;

    const t0 = performance.now();

    const tick = (t: number) => {
      const el = scrollerRef.current;
      if (!el) {
        snappingRef.current = false;
        animRef.current = null;
        return;
      }

      const p = Math.min(1, (t - t0) / ms);
      const eased = easeOutCubic(p);

      el.scrollLeft = start0 + (target0 - start0) * eased;

      if (p < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        animRef.current = null;
        snappingRef.current = false;
        setScrollLeft(el.scrollLeft);
      }
    };

    animRef.current = requestAnimationFrame(tick);
  }

  function getMaxIndexFromCount(count: number) {
    return Math.max(0, count - 1);
  }

  function getNearestIndex(count: number): number {
    const el = scrollerRef.current;
    if (!el) return 0;

    const vw = el.clientWidth || viewportW || 0;
    const center = el.scrollLeft + vw / 2;

    const raw = Math.round((center - CARD_W / 2) / STEP);
    return clamp(raw, 0, getMaxIndexFromCount(count));
  }

  function markFastWheel(absDelta: number, count: number) {
    const FAST_DELTA = 60;
    if (absDelta < FAST_DELTA) return;

    fastWheelRef.current = true;

    if (fastWheelClearRef.current) {
      window.clearTimeout(fastWheelClearRef.current);
    }

    fastWheelClearRef.current = window.setTimeout(() => {
      fastWheelRef.current = false;
      fastWheelClearRef.current = null;

      if (dragRef.current.isDown) return;
      if (snappingRef.current) return;

      const idx = getNearestIndex(count);
      scrollToIndex(idx, 220);
    }, 170);
  }

  // ---------------------------------------
  // manga id lookup
  // ---------------------------------------
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

  // ---------------------------------------
  // derive total chapters from DB (so range groups exist even if prop is null)
  // ---------------------------------------
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

      if (Number.isFinite(n) && n > 0) {
        setDerivedTotalChapters(Math.floor(n));
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [mangaId]);

  // ---------------------------------------
  // volume map
  // ---------------------------------------
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

  // ---------------------------------------
  // covers
  // ---------------------------------------
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

      if (error) {
        console.warn("[ChapterNavigator] manga_covers select failed:", error);
        setCoverRows([]);
        return;
      }

      if (!Array.isArray(data)) {
        console.warn("[ChapterNavigator] manga_covers returned non-array:", data);
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

  // ---------------------------------------
  // nav groups (volumes + fallback ranges)
  // IMPORTANT: this is what controls the "range groups"
  // ---------------------------------------
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

  // ---------------------------------------
  // volume cover map
  // ---------------------------------------
  const coverUrlByVolume = useMemo(() => {
    const byVol: Record<string, CoverRow[]> = {};
    for (const r of coverRows) {
      const v = normVol(r.volume);
      if (!v) continue;
      if (!byVol[v]) byVol[v] = [];
      byVol[v].push(r);
    }

    const out: Record<string, string | null> = {};
    for (const v of Object.keys(byVol)) {
      out[v] = pickBestCoverUrl(byVol[v]);
    }
    return out;
  }, [coverRows]);

  // ✅ pool of all cover urls (for no-volume mangas)
  const allCoverUrls = useMemo(() => {
    const urls = (coverRows || [])
      .map((r) => r?.cached_url ?? null)
      .filter((u): u is string => !!u);

    return Array.from(new Set(urls));
  }, [coverRows]);

  const chapterCoverByNumber = useMemo(() => {
    const out: Record<number, string | null> = {};

    const hasAnyVolumeGroup = navGroups.some((g) => g.kind === "volume");

    // ✅ If there are NO volumes at all, assign each chapter a stable-random cover
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

    // Original behavior (perfect) when volumes exist
    let lastVolumeCover: string | null = null;

    for (const g of navGroups) {
      if (g.kind === "volume") {
        const key = String(g.key || "");

        // supports lib keys like: "vol:1" or "vol:05"
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

  // skeleton while nav isn't ready
  const showNavSkeleton = !!slug && (!mangaId || !volumeMapLoaded);

  // ---------------------------------------
  // displayed chapters (All vs selected group)
  // ---------------------------------------
  const displayChapters: number[] = useMemo(() => {
    if (selectedVolume) {
      const g = navGroups.find((n) => n.key === selectedVolume);
      if (g) return g.chapters;
    }

    // All mode: prefer actual chapter identifiers from volumeMap so decimals show
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

      if (hasTotal && cappedTotal) {
        return uniq.filter((n) => n <= cappedTotal + 0.999999);
      }

      return uniq;
    }

    if (!hasTotal || !cappedTotal) return [];
    const nums: number[] = [];
    for (let i = 1; i <= cappedTotal; i++) nums.push(i);
    return nums;
  }, [selectedVolume, navGroups, volumeMap, hasTotal, cappedTotal]);

  const chapterCount = displayChapters.length;

  // ---------------------------------------
  // scroll handler (throttled + snap)
  // ---------------------------------------
  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;

    if (snappingRef.current) return;

    if (rafScrollRef.current) cancelAnimationFrame(rafScrollRef.current);
    rafScrollRef.current = requestAnimationFrame(() => {
      rafScrollRef.current = null;
      const sc = scrollerRef.current;
      if (!sc) return;
      setScrollLeft(sc.scrollLeft);
    });

    if (fastWheelRef.current) return;

    if ((onScroll as any)._t) window.clearTimeout((onScroll as any)._t);
    (onScroll as any)._t = window.setTimeout(() => {
      if (dragRef.current.isDown) return;
      if (snappingRef.current) return;
      if (fastWheelRef.current) return;
      if (chapterCount <= 0) return;

      const idx = getNearestIndex(chapterCount);
      scrollToIndex(idx, 220);
    }, 130);
  }

  // initial centering (re-run when currentSafe becomes available)
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (!viewportW) return;
    if (chapterCount <= 0) return;

    // If we're on the series page, don't force centering; also allow future re-center
    if (!currentSafe) {
      didInitialCenterRef.current = false;
      return;
    }

    // Avoid fighting user scroll if we've already centered once
    if (didInitialCenterRef.current) return;

    let idx = findChapterIndex(displayChapters, currentSafe);
    if (idx < 0) return; // wait until displayChapters actually contains current

    idx = clamp(idx, 0, getMaxIndexFromCount(chapterCount));

    // rAF ensures widths/layout are final
    requestAnimationFrame(() => {
      const vw = el.clientWidth || viewportW || 0;
      const target = idx * STEP + CARD_W / 2 - vw / 2;

      stopAnim();
      el.scrollLeft = Math.max(0, target);
      setScrollLeft(el.scrollLeft);
      didInitialCenterRef.current = true;
    });
  }, [
    viewportW,
    chapterCount,
    selectedVolume,
    currentSafe,
    displayChapters.join("|"),
  ]);

  // ---------------------------------------
  // virtualization window
  // ---------------------------------------
  const VBUF = 14;

  const { leftPx, rightPx, visibleChapterNumbers } = useMemo(() => {
    if (chapterCount <= 0) {
      return { leftPx: 0, rightPx: 0, visibleChapterNumbers: [] as number[] };
    }

    const t = chapterCount;
    const maxIdx = t - 1;

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

  // ---------------------------------------
  // meta fetch (chapter title)
  // ---------------------------------------
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

  // ---------------------------------------
  // drag physics (chapter scroller)
  // ---------------------------------------
  const [dragging, setDragging] = useState(false);

  const dragRef = useRef<{
    isDown: boolean;
    didDrag: boolean;
    startX: number;
    startScrollLeft: number;
    startIndex: number;
    lastX: number;
    blockNextClick: boolean;
    maxMovePx: number;
    samples: Array<{ t: number; x: number }>;
  }>(
    {
      isDown: false,
      didDrag: false,
      startX: 0,
      startScrollLeft: 0,
      startIndex: 0,
      lastX: 0,
      blockNextClick: false,
      maxMovePx: 0,
      samples: [],
    }
  );

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const handler = (ev: WheelEvent) => {
      if (snappingRef.current) {
        ev.preventDefault();
        return;
      }

      stopAnim();

      const deltaX = ev.deltaX;
      const deltaY = ev.deltaY;

      const mostlyVertical = Math.abs(deltaY) > Math.abs(deltaX);
      if (mostlyVertical && !ev.shiftKey) {
        ev.preventDefault();
        el.scrollLeft += deltaY;
        markFastWheel(Math.abs(deltaY), Math.max(1, chapterCount));
        return;
      }

      markFastWheel(
        Math.max(Math.abs(deltaX), Math.abs(deltaY)),
        Math.max(1, chapterCount)
      );

      if (fastWheelRef.current) return;

      if ((handler as any)._t) window.clearTimeout((handler as any)._t);
      (handler as any)._t = window.setTimeout(() => {
        if (dragRef.current.isDown) return;
        if (snappingRef.current) return;
        if (fastWheelRef.current) return;
        if (chapterCount <= 0) return;

        const idx = getNearestIndex(chapterCount);
        scrollToIndex(idx, 220);
      }, 110);
    };

    el.addEventListener("wheel", handler, { passive: false });

    return () => {
      el.removeEventListener("wheel", handler as any);
    };
  }, [chapterCount, viewportW, scrollLeft]);

  const DRAG_THRESHOLD_PX = 6;
  const CLICK_BLOCK_PX = 12;

  const VELOCITY_FLICK = 0.6; // px/ms
  const DISTANCE_THRESHOLD_FACTOR = 0.22;

  const TINY_FLICK_MAX_MS = 90;
  const TINY_FLICK_MAX_PX = 30;

  function recordSample(clientX: number) {
    const now = performance.now();
    const s = dragRef.current.samples;
    s.push({ t: now, x: clientX });
    while (s.length > 0 && now - s[0].t > 120) s.shift();
  }

  function computeVelocity(): number {
    const s = dragRef.current.samples;
    if (s.length < 2) return 0;
    const first = s[0];
    const last = s[s.length - 1];
    const dt = Math.max(1, last.t - first.t);
    return (last.x - first.x) / dt;
  }

  function gestureDurationMs(): number {
    const s = dragRef.current.samples;
    if (s.length < 2) return 0;
    return s[s.length - 1].t - s[0].t;
  }

  function finishDrag() {
    const el = scrollerRef.current;
    const didDrag = dragRef.current.didDrag;

    dragRef.current.isDown = false;

    dragRef.current.blockNextClick =
      didDrag && dragRef.current.maxMovePx > CLICK_BLOCK_PX;

    if (!el) {
      setDragging(false);
      return;
    }

    if (!didDrag) {
      setDragging(false);
      return;
    }

    if (chapterCount <= 0) {
      setDragging(false);
      return;
    }

    const v = computeVelocity();
    const duration = gestureDurationMs();

    const startX = dragRef.current.startX;
    const endX =
      dragRef.current.samples.length > 0
        ? dragRef.current.samples[dragRef.current.samples.length - 1].x
        : startX;

    const dx = endX - startX;

    const step = STEP;
    const startIndex = dragRef.current.startIndex;

    const distThreshold = step * DISTANCE_THRESHOLD_FACTOR;

    const isFlick = Math.abs(v) >= VELOCITY_FLICK;

    const isTinyFlick =
      isFlick && duration <= TINY_FLICK_MAX_MS && Math.abs(dx) <= TINY_FLICK_MAX_PX;

    const draggedScroll = Math.abs(el.scrollLeft - dragRef.current.startScrollLeft);
    const farDrag = draggedScroll > step * 1.1;
    const isFlickAllowed = isFlick && !farDrag;

    let target = startIndex;

    if (isFlickAllowed) {
      const dir = v > 0 ? -1 : 1;
      target = startIndex + dir;

      if (isTinyFlick) {
        target = clamp(target, startIndex - 1, startIndex + 1);
      }
    } else {
      if (draggedScroll < distThreshold) target = startIndex;
      else target = getNearestIndex(chapterCount);
    }

    target = clamp(target, 0, getMaxIndexFromCount(chapterCount));

    scrollToIndex(target, 260);
    window.setTimeout(() => setDragging(false), 0);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = scrollerRef.current;
    if (!el) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    stopAnim();
    if (fastWheelClearRef.current) {
      window.clearTimeout(fastWheelClearRef.current);
      fastWheelClearRef.current = null;
    }
    fastWheelRef.current = false;

    dragRef.current.isDown = true;
    dragRef.current.didDrag = false;

    dragRef.current.startX = e.clientX;
    dragRef.current.startScrollLeft = el.scrollLeft;
    dragRef.current.lastX = e.clientX;

    dragRef.current.blockNextClick = false;
    dragRef.current.maxMovePx = 0;

    dragRef.current.samples = [];
    recordSample(e.clientX);

    dragRef.current.startIndex = getNearestIndex(Math.max(1, chapterCount));
    setDragging(false);

    const onWinMove = (ev: PointerEvent) => {
      const sc = scrollerRef.current;
      if (!sc) return;
      if (!dragRef.current.isDown) return;

      const clientX = ev.clientX;

      recordSample(clientX);

      const dxFromStart = clientX - dragRef.current.startX;
      dragRef.current.maxMovePx = Math.max(
        dragRef.current.maxMovePx,
        Math.abs(dxFromStart)
      );

      if (!dragRef.current.didDrag && Math.abs(dxFromStart) >= DRAG_THRESHOLD_PX) {
        dragRef.current.didDrag = true;
        setDragging(true);
      }

      if (dragRef.current.didDrag) {
        const prevX = dragRef.current.lastX;
        const delta = prevX - clientX;
        sc.scrollLeft = sc.scrollLeft + delta;
        dragRef.current.lastX = clientX;
      }
    };

    const onWinUp = () => {
      if (!dragRef.current.isDown) return;
      finishDrag();
      window.removeEventListener("pointermove", onWinMove);
      window.removeEventListener("pointerup", onWinUp);
      window.removeEventListener("pointercancel", onWinUp);
    };

    window.addEventListener("pointermove", onWinMove, { passive: true });
    window.addEventListener("pointerup", onWinUp, { passive: true });
    window.addEventListener("pointercancel", onWinUp, { passive: true });
  }

  // ---------------------------------------
  // drag-to-scroll for volume button row
  // ---------------------------------------
  const volumeRowRef = useRef<HTMLDivElement | null>(null);

  const volumeDragRef = useRef<{
    isDown: boolean;
    didDrag: boolean;
    startX: number;
    startScrollLeft: number;
    maxMovePx: number;
  }>({
    isDown: false,
    didDrag: false,
    startX: 0,
    startScrollLeft: 0,
    maxMovePx: 0,
  });

  const VOLUME_DRAG_THRESHOLD_PX = 6;
  const VOLUME_CLICK_BLOCK_PX = 10;

  function onVolumePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = volumeRowRef.current;
    if (!el) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    volumeDragRef.current.isDown = true;
    volumeDragRef.current.didDrag = false;
    volumeDragRef.current.startX = e.clientX;
    volumeDragRef.current.startScrollLeft = el.scrollLeft;
    volumeDragRef.current.maxMovePx = 0;

    const onMove = (ev: PointerEvent) => {
      const row = volumeRowRef.current;
      if (!row) return;
      if (!volumeDragRef.current.isDown) return;

      const dx = ev.clientX - volumeDragRef.current.startX;
      volumeDragRef.current.maxMovePx = Math.max(
        volumeDragRef.current.maxMovePx,
        Math.abs(dx)
      );

      if (!volumeDragRef.current.didDrag && Math.abs(dx) >= VOLUME_DRAG_THRESHOLD_PX) {
        volumeDragRef.current.didDrag = true;
        setVolumeDragging(true);
      }

      if (volumeDragRef.current.didDrag) {
        row.scrollLeft = volumeDragRef.current.startScrollLeft - dx;
      }
    };

    const onUp = () => {
      volumeDragRef.current.isDown = false;
      setVolumeDragging(false);

      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onUp, { passive: true });
  }

  function maybeBlockVolumeButtonClick(e: React.MouseEvent, onClick: () => void) {
    if (
      volumeDragRef.current.didDrag &&
      volumeDragRef.current.maxMovePx > VOLUME_CLICK_BLOCK_PX
    ) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClick();
  }

  // ---------------------------------------
  // UI styles
  // ---------------------------------------
  const cardBase =
    "group relative shrink-0 rounded-xs bg-[var(--card-bg)] ring-1 ring-[var(--ring)] shadow-sm transition";
  const cardHover =
    "hover:bg-[var(--card-bg-hover)] hover:shadow-md hover:ring-black/10";
  const cardSize = "h-[180px] w-[120px]";

  const pillBase =
    "select-none rounded-sm border px-0 py-1 text-xs font-semibold transition";
  const pillOn = "bg-white text-black border-black";
  const pillOff = "bg-black text-white border-white/20 hover:border-white/40";

  // ---------------------------------------
  // render guards
  // ---------------------------------------
  const showNothingYet = !!slug && (!mangaId || !volumeMapLoaded);
  if (!showNothingYet && chapterCount <= 0) return null;

  return (
    <div
      className={["min-w-0", className ?? ""].join(" ")}
      style={
        {
          "--card-bg": "rgba(245, 250, 255, 1)",
          "--card-bg-hover": "white",
          "--ring": "rgba(245, 250, 255, 1)",
        } as React.CSSProperties
      }
    >
      {/* Volume buttons */}
      {showVolumeButtons ? (
        <div
          ref={volumeRowRef}
          onPointerDown={onVolumePointerDown}
          className={[
            "mb-2 flex items-center gap-2 overflow-x-auto scrollbar-none select-none touch-pan-y",
            volumeDragging ? "cursor-grabbing" : "cursor-grab",
          ].join(" ")}
        >
          <button
            type="button"
            className={[
              pillBase,
              selectedVolume === null ? pillOn : pillOff,
              "min-w-[25px] cursor-pointer",
            ].join(" ")}
            onClick={(e) => maybeBlockVolumeButtonClick(e, () => setSelectedVolume(null))}
          >
            <div className="flex flex-col items-center leading-tight">
              <div>All</div>
              <div className="mt-0.5 text-[10px] font-semibold opacity-0">0–0</div>
            </div>
          </button>

          {navGroups.map((g) => (
            <button
              key={g.key}
              type="button"
              className={[
                pillBase,
                selectedVolume === g.key ? pillOn : pillOff,
                "min-w-[45px] cursor-pointer",
              ].join(" ")}
              onClick={(e) => maybeBlockVolumeButtonClick(e, () => setSelectedVolume(g.key))}
            >
              <div className="flex flex-col items-center leading-tight">
                <div>{g.labelTop}</div>
                <div className="mt-0.5 text-[10px] font-semibold opacity-80">
                  {g.labelBottom}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : showNavSkeleton ? (
        <div className="mb-2 h-[39px] w-full rounded-sm bg-black/10" />
      ) : null}

      {/* Chapter scroller */}
      <div className="w-full overflow-hidden rounded-sm border border-black bg-black">
        <div
          ref={scrollerRef}
          className={[
            "scrollbar-none relative flex overflow-x-auto overflow-y-hidden",
            "select-none touch-pan-y",
            "px-0 py-2",
            dragging ? "cursor-grabbing" : "cursor-grab",
          ].join(" ")}
          onPointerDown={onPointerDown}
          onScroll={onScroll}
        >
          <div style={{ width: leftPx }} className="shrink-0" />

          <div className="flex gap-3">
            {visibleChapterNumbers.map((n) => {
              const meta = metaByNumber[n];
              const title = meta?.title ?? `Chapter ${n}`;

              const imageUrl = chapterCoverByNumber[n] ?? null;

              const metaLine = `CH${pad2(n)}`;
              const hasSelectedChapter = typeof currentSafe === "number";
              const isActive = isSameChapterNumber(currentSafe, n);

              return (
                <Link
                  key={n}
                  href={`${chapterBase}/${String(n)}`}
                  scroll={false}
                  onClick={(e) => {
                    if (dragRef.current.blockNextClick) {
                      e.preventDefault();
                      dragRef.current.blockNextClick = false;
                    }
                  }}
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  className={[
                    cardBase,
                    cardHover,
                    cardSize,

                    // make non-active slightly quieter
                    hasSelectedChapter && !isActive ? "opacity-80 hover:opacity-100" : "",

                    // active treatment
                    isActive
                      ? [
                        "opacity-100",
                        "ring-2 ring-sky-400",          // strong accent outline
                        "shadow-lg shadow-sky-500/20",  // soft glow
                        "scale-[1.03]",                 // subtle zoom
                        "z-[2]",                        // sit above neighbors
                      ].join(" ")
                      : "",
                  ].join(" ")}
                  style={{
                    contentVisibility: "auto",
                    containIntrinsicSize: "120px 240px",
                  }}
                >
                  <div className="relative h-full w-full overflow-hidden rounded-xs bg-black">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-contain"
                        draggable={false}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-black" />
                    )}

                    <div className="absolute inset-x-0 bottom-0">
                      <div className="bg-black/70 backdrop-blur-[2px] px-3 py-2">
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] font-semibold text-white/80">{metaLine}</div>

                          {isActive ? (
                            <div className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_0_3px_rgba(56,189,248,0.18)]" />
                              <span className="text-[10px] font-bold tracking-wide text-sky-300">
                                CURRENT
                              </span>
                            </div>
                          ) : null}
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
