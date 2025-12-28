// components/ChapterNavigator.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  slug: string;
  totalChapters?: number | null;
  currentChapterNumber?: number | null; // null on main manga page
  className?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function normalizeThumbUrl(url: string) {
  if (!url) return url;

  if (url.includes("https://image.tmdb.org/t/p/")) {
    return url.replace(
      /\/t\/p\/(original|w1280|w780|w500|w342|w300|w185)\//,
      "/t/p/w500/"
    );
  }

  return url;
}

type ChapterRow = {
  id: string;
  chapter_number: number;
  title: string | null;
};

type ArtworkRow = {
  manga_chapter_id: string;
  url: string | null;
  source: string | null;
  vote: number | null;
  is_primary: boolean | null;
  width: number | null;
};

type ChapterMeta = {
  title: string | null;
  imageUrl: string | null;
};

function pickBestArtwork(rows: ArtworkRow[]): string | null {
  const usable = rows.filter((r) => r.url);
  if (usable.length === 0) return null;

  usable.sort((a, b) => {
    const ap = a.is_primary ? 1 : 0;
    const bp = b.is_primary ? 1 : 0;
    if (bp !== ap) return bp - ap;

    const av = a.vote ?? -9999;
    const bv = b.vote ?? -9999;
    if (bv !== av) return bv - av;

    const aw = a.width ?? -9999;
    const bw = b.width ?? -9999;
    return bw - aw;
  });

  return usable[0].url ?? null;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export default function ChapterNavigator({
  slug,
  totalChapters,
  currentChapterNumber,
  className,
}: Props) {
  // ---------------------------------------
  // totals / routing
  // ---------------------------------------
  const total = typeof totalChapters === "number" ? totalChapters : null;
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
  // "TV Time" virtualization layout constants
  // ---------------------------------------
  const CARD_W = 240;
  const CARD_H = 120;
  const GAP = 12; // gap-3
  const STEP = CARD_W + GAP;
  const THUMB_W = 120;

  // ---------------------------------------
  // scroller tracking
  // ---------------------------------------
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const rafScrollRef = useRef<number | null>(null);
  const snappingRef = useRef(false);

  const [viewportW, setViewportW] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  useEffect(() => {
    function update() {
      const node = scrollerRef.current;
      if (!node) return;
      setViewportW(node.clientWidth || 0);
    }

    // run once immediately
    update();

    const node = scrollerRef.current;
    if (!node) return;

    const ro = new ResizeObserver(() => update());
    ro.observe(node);

    return () => ro.disconnect();
  }, []);

  function onScroll() {
  const el = scrollerRef.current;
  if (!el) return;

  // ✅ during snap animation, ignore scroll events completely
  if (snappingRef.current) return;

  if (rafScrollRef.current) cancelAnimationFrame(rafScrollRef.current);
  rafScrollRef.current = requestAnimationFrame(() => {
    rafScrollRef.current = null;
    const sc = scrollerRef.current;
    if (!sc) return;
    setScrollLeft(sc.scrollLeft);
  });

  if ((onScroll as any)._t) window.clearTimeout((onScroll as any)._t);
  (onScroll as any)._t = window.setTimeout(() => {
    if (dragRef.current.isDown) return;
    if (snappingRef.current) return;

    const idx = getNearestIndex();
    scrollToIndex(idx, 220);
  }, 130);
}

  // ---------------------------------------
  // compute nearest index and scroll targets
  // ---------------------------------------
  function getMaxIndex() {
    const t = cappedTotal ?? 0;
    return Math.max(0, t - 1);
  }

  function getNearestIndex(): number {
    const el = scrollerRef.current;
    if (!el) return 0;

    const vw = el.clientWidth || viewportW || 0;
    const center = el.scrollLeft + vw / 2;

    const raw = Math.round((center - CARD_W / 2) / STEP);
    return clamp(raw, 0, getMaxIndex());
  }

  const animRef = useRef<number | null>(null);
  function stopAnim() {
  if (animRef.current) cancelAnimationFrame(animRef.current);
  animRef.current = null;
  snappingRef.current = false;
}

  // ✅ TS-safe: always re-read scrollerRef.current inside RAF
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

      // ✅ one final state sync (prevents re-render every frame)
      snappingRef.current = false;
      setScrollLeft(el.scrollLeft);
    }
  };

  animRef.current = requestAnimationFrame(tick);
}

  // initial centering (no animation)
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (!hasTotal) return;
    if (!viewportW) return;

    const idx = currentSafe ? clamp(currentSafe - 1, 0, getMaxIndex()) : 0;

    const target = idx * STEP + CARD_W / 2 - viewportW / 2;
    el.scrollLeft = Math.max(0, target);
    setScrollLeft(el.scrollLeft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTotal, viewportW, slug]);

  // ---------------------------------------
  // virtualization window
  // ---------------------------------------
  const VBUF = 14;

  const { leftPx, rightPx, visibleChapterNumbers } = useMemo(() => {
    if (!hasTotal || !cappedTotal) {
      return {
        leftPx: 0,
        rightPx: 0,
        visibleChapterNumbers: [] as number[],
      };
    }

    const t = cappedTotal;
    const maxIdx = t - 1;

    const vw = viewportW || 0;
    const left = scrollLeft || 0;

    const approxStart = Math.floor(left / STEP) - VBUF;
    const approxEnd = Math.ceil((left + vw) / STEP) + VBUF;

    const s = clamp(approxStart, 0, maxIdx);
    const e = clamp(approxEnd, 0, maxIdx);

    const nums: number[] = [];
    for (let i = s; i <= e; i++) nums.push(i + 1);

    return {
      leftPx: s * STEP,
      rightPx: (maxIdx - e) * STEP,
      visibleChapterNumbers: nums,
    };
  }, [hasTotal, cappedTotal, viewportW, scrollLeft]);

  // ---------------------------------------
  // manga id (cached) + meta fetch for visible window
  // ---------------------------------------
  const [mangaId, setMangaId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setMangaId(null);
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

  const [metaByNumber, setMetaByNumber] = useState<Record<number, ChapterMeta>>(
    {}
  );

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!slug) return;
      if (!hasTotal) return;
      if (!mangaId) return;
      if (!visibleChapterNumbers.length) return;

      // Only fetch missing ones (and don't refetch constantly)
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
        // populate placeholders to avoid hammering
        setMetaByNumber((prev) => {
          const next = { ...prev };
          for (const n of wantedNums) {
            if (!next[n]) next[n] = { title: null, imageUrl: null };
          }
          return next;
        });
        return;
      }

      const chapterRows = chs as ChapterRow[];

      const idByNumber: Record<number, string> = {};
      const titleByNumber: Record<number, string | null> = {};
      for (const c of chapterRows) {
        if (typeof c.chapter_number !== "number") continue;
        idByNumber[c.chapter_number] = c.id;
        titleByNumber[c.chapter_number] = c.title ?? null;
      }

      const chapterIds = Object.values(idByNumber);

      // Soft-fail artwork (table may not exist yet)
      let byChapterId: Record<string, ArtworkRow[]> = {};
      if (chapterIds.length > 0) {
        const { data: arts, error: artsErr } = await supabase
          .from("manga_chapter_artwork")
          .select("manga_chapter_id, url, source, vote, is_primary, width")
          .in("manga_chapter_id", chapterIds);

        if (!cancelled && !artsErr && Array.isArray(arts)) {
          byChapterId = {};
          for (const r of (arts as ArtworkRow[]) ?? []) {
            if (!r?.manga_chapter_id) continue;
            if (!byChapterId[r.manga_chapter_id]) byChapterId[r.manga_chapter_id] = [];
            byChapterId[r.manga_chapter_id].push(r);
          }
        }
      }

      if (cancelled) return;

      setMetaByNumber((prev) => {
        const next = { ...prev };
        for (const n of wantedNums) {
          const chId = idByNumber[n];
          const best =
            chId && byChapterId[chId] ? pickBestArtwork(byChapterId[chId]) : null;

          next[n] = {
            title: titleByNumber[n] ?? null,
            imageUrl: best ? normalizeThumbUrl(best) : null,
          };
        }
        return next;
      });
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, hasTotal, mangaId, visibleChapterNumbers.join("|")]);

  // ---------------------------------------
  // drag physics
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
  }>({
    isDown: false,
    didDrag: false,
    startX: 0,
    startScrollLeft: 0,
    startIndex: 0,
    lastX: 0,
    blockNextClick: false,
    maxMovePx: 0,
    samples: [],
  });

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
      else target = getNearestIndex();
    }

    target = clamp(target, 0, getMaxIndex());

    scrollToIndex(target, 260);
    window.setTimeout(() => setDragging(false), 0);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = scrollerRef.current;
    if (!el) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    stopAnim();

    snappingRef.current = false;

    dragRef.current.isDown = true;
    dragRef.current.didDrag = false;

    dragRef.current.startX = e.clientX;
    dragRef.current.startScrollLeft = el.scrollLeft;
    dragRef.current.lastX = e.clientX;

    dragRef.current.blockNextClick = false;
    dragRef.current.maxMovePx = 0;

    dragRef.current.samples = [];
    recordSample(e.clientX);

    dragRef.current.startIndex = getNearestIndex();
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

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    const el = scrollerRef.current;
    if (!el) return;

    stopAnim();

    const mostlyVertical = Math.abs(e.deltaY) > Math.abs(e.deltaX);
    if (mostlyVertical && !e.shiftKey) {
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }

    if ((onWheel as any)._t) window.clearTimeout((onWheel as any)._t);
    (onWheel as any)._t = window.setTimeout(() => {
      if (dragRef.current.isDown) return;
      const idx = getNearestIndex();
      scrollToIndex(idx, 220);
    }, 110);
  }

  // ---------------------------------------
  // UI styles
  // ---------------------------------------
  const cardBase =
    "group relative shrink-0 rounded-xs bg-[var(--card-bg)] ring-1 ring-[var(--ring)] shadow-sm transition";
  const cardHover =
    "hover:bg-[var(--card-bg-hover)] hover:shadow-md hover:ring-black/10";
  const cardSize = `h-[${CARD_H}px] w-[${CARD_W}px]`;
  const thumbSize = `h-full w-[${THUMB_W}px] shrink-0`;

  if (!hasTotal || !cappedTotal) return null;

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
      <div className="w-full overflow-hidden rounded-sm border border-black bg-black">
        <div
          ref={scrollerRef}
          className={[
            "scrollbar-none relative flex overflow-x-auto",
            "select-none touch-pan-y",
            "px-0 py-2",
            dragging ? "cursor-grabbing" : "cursor-grab",
          ].join(" ")}
          onPointerDown={onPointerDown}
          onWheel={onWheel}
          onScroll={onScroll}
        >
          <div style={{ width: leftPx }} className="shrink-0" />

          <div className="flex gap-3">
            {visibleChapterNumbers.map((n) => {
              const meta = metaByNumber[n];
              const title = meta?.title ?? `Chapter ${n}`;
              const imageUrl = meta?.imageUrl ?? null;

              const metaLine = `CH${pad2(n)}`;
              const isActive = currentSafe === n;

              return (
                <Link
                  key={n}
                  href={`${chapterBase}/${n}`}
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
                    isActive ? "ring-black/15 bg-white" : "",
                  ].join(" ")}
                >
                  <div className="flex h-full overflow-hidden rounded-xs">
                    <div className={[thumbSize, "bg-black/5"].join(" ")}>
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                          draggable={false}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : null}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col justify-start px-3 py-3">
                      <div className="text-xs font-medium text-black/50">
                        {metaLine}
                      </div>

                      <div
                        className="mt-1 text-sm font-semibold text-black/90 break-words leading-snug flex-1 min-h-0"
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 4,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {title}
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
