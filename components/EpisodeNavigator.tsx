// components/EpisodeNavigator.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getAnimeBySlug } from "@/lib/anime";

type Props = {
  slug: string;
  totalEpisodes?: number | null;
  currentEpisodeNumber?: number | null;
  className?: string;
};

type EpisodeRow = {
  id: string;
  episode_number: number;
  title: string | null;
};

type ArtworkRow = {
  anime_episode_id: string;
  url: string | null;
  source: string | null;
  vote: number | null;
  is_primary: boolean | null;
  width: number | null;
};

type EpisodeMeta = {
  title: string | null;
  imageUrl: string | null;
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

export default function EpisodeNavigator({
  slug,
  totalEpisodes,
  currentEpisodeNumber,
  className,
}: Props) {
  // ---------------- totals ----------------
  const total =
    typeof totalEpisodes === "number" && Number.isFinite(totalEpisodes)
      ? totalEpisodes
      : null;

  const totalCount = total && total > 0 ? Math.min(total, 2000) : 0;

  const current =
    typeof currentEpisodeNumber === "number" &&
    Number.isFinite(currentEpisodeNumber)
      ? currentEpisodeNumber
      : null;

  const currentSafe = current && current > 0 ? current : null;

  const animeHref = `/anime/${encodeURIComponent(slug)}`;
  const episodeBase = `${animeHref}/episode`;

  const allNumbers = useMemo(() => {
    if (!totalCount) return [];
    const nums: number[] = [];
    for (let i = 1; i <= totalCount; i++) nums.push(i);
    return nums;
  }, [totalCount]);

  // ---------------- animeId cache ----------------
  const [animeId, setAnimeId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setAnimeId(null);
      if (!slug) return;

      const { data: anime, error } = await getAnimeBySlug(slug);
      if (cancelled) return;
      if (error || !anime?.id) return;

      setAnimeId(anime.id);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // ---------------- meta cache (lazy, in-view only) ----------------
  const [metaByNumber, setMetaByNumber] = useState<Record<number, EpisodeMeta>>(
    {}
  );

  const inflightRef = useRef<Set<number>>(new Set());
  const pendingRef = useRef<Set<number>>(new Set());
  const fetchTimerRef = useRef<number | null>(null);

  function scheduleFetch() {
    if (fetchTimerRef.current) window.clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = window.setTimeout(() => {
      fetchTimerRef.current = null;
      void flushFetch();
    }, 50);
  }

  async function flushFetch() {
    if (!animeId) return;
    if (pendingRef.current.size === 0) return;

    const batch = Array.from(pendingRef.current).slice(0, 60);
    batch.forEach((n) => pendingRef.current.delete(n));

    const wanted = batch.filter(
      (n) => !metaByNumber[n] && !inflightRef.current.has(n)
    );
    if (wanted.length === 0) return;

    wanted.forEach((n) => inflightRef.current.add(n));

    const { data: eps, error: epsErr } = await supabase
      .from("anime_episodes")
      .select("id, episode_number, title")
      .eq("anime_id", animeId)
      .in("episode_number", wanted);

    if (epsErr || !eps) {
      wanted.forEach((n) => inflightRef.current.delete(n));
      return;
    }

    const episodeRows = eps as EpisodeRow[];

    const idByNumber: Record<number, string> = {};
    const titleByNumber: Record<number, string | null> = {};

    for (const e of episodeRows) {
      if (typeof e.episode_number !== "number") continue;
      idByNumber[e.episode_number] = e.id;
      titleByNumber[e.episode_number] = e.title ?? null;
    }

    const episodeIds = Object.values(idByNumber);
    const byEpisodeId: Record<string, ArtworkRow[]> = {};

    if (episodeIds.length > 0) {
      const { data: arts, error: artsErr } = await supabase
        .from("anime_episode_artwork")
        .select("anime_episode_id, url, source, vote, is_primary, width")
        .in("anime_episode_id", episodeIds);

      if (!artsErr && arts) {
        for (const r of arts as ArtworkRow[]) {
          if (!r?.anime_episode_id) continue;
          if (!byEpisodeId[r.anime_episode_id])
            byEpisodeId[r.anime_episode_id] = [];
          byEpisodeId[r.anime_episode_id].push(r);
        }
      }
    }

    const patch: Record<number, EpisodeMeta> = {};

    for (const n of wanted) {
      const epId = idByNumber[n];
      const best =
        epId && byEpisodeId[epId] ? pickBestArtwork(byEpisodeId[epId]) : null;

      patch[n] = {
        title: titleByNumber[n] ?? null,
        imageUrl: best ? normalizeThumbUrl(best) : null,
      };
    }

    wanted.forEach((n) => inflightRef.current.delete(n));

    if (Object.keys(patch).length > 0) {
      setMetaByNumber((prev) => ({ ...prev, ...patch }));
    }

    if (pendingRef.current.size > 0) scheduleFetch();
  }

  // ---------------- scrolling + snapping (same feel you liked) ----------------
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const animRef = useRef<number | null>(null);
  const snappingRef = useRef(false);
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
  const SNAP_DURATION_MS = 260;

  const TINY_FLICK_MAX_MS = 90;
  const TINY_FLICK_MAX_PX = 30;

  function stopAnim() {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = null;
    snappingRef.current = false;
  }

  function getNearestCardIndex(): number {
    const el = scrollerRef.current;
    if (!el) return 0;

    const centerX = el.getBoundingClientRect().left + el.clientWidth / 2;

    let bestIdx = 0;
    let bestDist = Number.POSITIVE_INFINITY;

    cardRefs.current.forEach((node, idx) => {
      if (!node) return;
      const r = node.getBoundingClientRect();
      const cardCenter = r.left + r.width / 2;
      const dist = Math.abs(cardCenter - centerX);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });

    return bestIdx;
  }

  function getCardStepPx(): number {
    const firstIdx = cardRefs.current.findIndex(Boolean);
    const first = firstIdx >= 0 ? cardRefs.current[firstIdx] : null;
    if (!first) return 332;

    const second = cardRefs.current.slice(firstIdx + 1).find(Boolean);
    if (!second) return 332;

    const r1 = first.getBoundingClientRect();
    const r2 = second.getBoundingClientRect();
    return Math.max(1, r2.left - r1.left);
  }

  function scrollToCardIndex(idx: number, ms = SNAP_DURATION_MS) {
    stopAnim();

    const el0 = scrollerRef.current;
    const card0 = cardRefs.current[idx];
    if (!el0 || !card0) return;

    snappingRef.current = true;

    const start0 = el0.scrollLeft;

    const elRect0 = el0.getBoundingClientRect();
    const cardRect0 = card0.getBoundingClientRect();

    const elCenter0 = elRect0.left + el0.clientWidth / 2;
    const cardCenter0 = cardRect0.left + cardRect0.width / 2;

    const delta0 = cardCenter0 - elCenter0;
    const target0 = start0 + delta0;

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

      if (p < 1) animRef.current = requestAnimationFrame(tick);
      else {
        animRef.current = null;
        snappingRef.current = false;
      }
    };

    animRef.current = requestAnimationFrame(tick);
  }

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

    const step = getCardStepPx();
    const startIndex = dragRef.current.startIndex;

    const distThreshold = step * DISTANCE_THRESHOLD_FACTOR;

    const isFlick = Math.abs(v) >= VELOCITY_FLICK;

    const isTinyFlick =
      isFlick &&
      duration <= TINY_FLICK_MAX_MS &&
      Math.abs(dx) <= TINY_FLICK_MAX_PX;

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
      else target = getNearestCardIndex();
    }

    const count = cardRefs.current.filter(Boolean).length;
    target = clamp(target, 0, Math.max(0, count - 1));

    scrollToCardIndex(target);
    window.setTimeout(() => setDragging(false), 0);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = scrollerRef.current;
    if (!el) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    stopAnim();

    dragRef.current.isDown = true;
    dragRef.current.didDrag = false;

    dragRef.current.startX = e.clientX;
    dragRef.current.startScrollLeft = el.scrollLeft;
    dragRef.current.lastX = e.clientX;

    dragRef.current.blockNextClick = false;
    dragRef.current.maxMovePx = 0;

    dragRef.current.samples = [];
    recordSample(e.clientX);

    dragRef.current.startIndex = getNearestCardIndex();
    setDragging(false);

    const onWinMove = (ev: PointerEvent) => {
      const sc = scrollerRef.current;
      if (!sc) return;
      if (!dragRef.current.isDown) return;

      if (snappingRef.current) stopAnim();

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

  // Map vertical wheel to horizontal (unless user is holding shift)
  const mostlyVertical = Math.abs(e.deltaY) > Math.abs(e.deltaX);

  // --- detect "max speed" wheel blasts ---
  // Trackpads / tilt wheels can throw huge deltas; treat those as "fast".
  const dx = mostlyVertical && !e.shiftKey ? e.deltaY : e.deltaX;
  const fast = Math.abs(dx) >= 80; // knob: raise/lower if needed

  // If we are in a snap animation:
  // - do NOT preventDefault (let inertia happen)
  // - but stop the animation if user is actively scrolling fast
  if (snappingRef.current && fast) {
    stopAnim();
  }

  // Convert vertical to horizontal scroll
  if (mostlyVertical && !e.shiftKey) {
    e.preventDefault();
    el.scrollLeft += e.deltaY;
  }

  // If the wheel is going fast, DO NOT snap.
  // Just clear any pending snap timer and return.
  if (fast) {
    if ((onWheel as any)._t) window.clearTimeout((onWheel as any)._t);
    return;
  }

  // If the wheel is slow, schedule a snap after it settles.
  if ((onWheel as any)._t) window.clearTimeout((onWheel as any)._t);
  (onWheel as any)._t = window.setTimeout(() => {
    if (dragRef.current.isDown) return;
    if (snappingRef.current) return;

    const idx = getNearestCardIndex();
    scrollToCardIndex(idx, 220);
  }, 160); // slightly longer = less likely to fight inertia
}

  // ---------------- IntersectionObserver (observe REAL <a> nodes) ----------------
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;

    observerRef.current?.disconnect();

    const obs = new IntersectionObserver(
      (entries) => {
        for (const ent of entries) {
          if (!ent.isIntersecting) continue;
          const el = ent.target as HTMLElement;
          const raw = el.getAttribute("data-ep");
          const n = raw ? Number(raw) : NaN;
          if (!Number.isFinite(n) || n <= 0) continue;

          if (!metaByNumber[n] && !inflightRef.current.has(n)) {
            pendingRef.current.add(n);
          }
        }

        if (pendingRef.current.size > 0) scheduleFetch();
      },
      { root, threshold: 0.15, rootMargin: "500px" }
    );

    observerRef.current = obs;

    // observe whatever anchors exist right now
    for (const a of cardRefs.current) {
      if (a) obs.observe(a);
    }

    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, totalCount, animeId]);

  // ---------------- scroll to current on mount ----------------
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (!totalCount) return;
    if (!currentSafe) return;

    const idx = clamp(currentSafe, 1, totalCount) - 1;
    const node = cardRefs.current[idx];
    if (!node) return;

    const elRect = el.getBoundingClientRect();
    const cardRect = node.getBoundingClientRect();
    const elCenter = elRect.left + el.clientWidth / 2;
    const cardCenter = cardRect.left + cardRect.width / 2;

    el.scrollLeft = el.scrollLeft + (cardCenter - elCenter);
  }, [slug, totalCount, currentSafe]);

  // ---------------- styles ----------------
  const cardBase =
    "group relative shrink-0 rounded-xs bg-[var(--card-bg)] ring-1 ring-[var(--ring)] shadow-sm transition";
  const cardHover =
    "hover:bg-[var(--card-bg-hover)] hover:shadow-md hover:ring-black/10";
  const cardSize = "h-[120px] w-[240px]";
  const thumbSize = "h-full w-[120px] shrink-0";

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
            "scrollbar-none relative flex gap-3 overflow-x-auto overflow-y-hidden",
            "select-none touch-pan-y",
            "px-0 py-2",
            dragging ? "cursor-grabbing" : "cursor-grab",
          ].join(" ")}
          onPointerDown={onPointerDown}
          onWheel={onWheel}
        >
          {allNumbers.map((n, idx) => {
            const meta = metaByNumber[n];
            const title = meta?.title ?? `Episode ${n}`;
            const imageUrl = meta?.imageUrl ?? null;

            const metaLine = `S${pad2(1)} · E${pad2(n)}`;
            const isActive = currentSafe === n;

            return (
              <Link key={n} href={`${episodeBase}/${n}`} legacyBehavior>
                <a
                  ref={(node) => {
                    cardRefs.current[idx] = node;

                    const obs = observerRef.current;
                    if (node && obs) obs.observe(node);
                  }}
                  data-ep={String(n)}
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
                  style={{
                    contentVisibility: "auto",
                    containIntrinsicSize: "120px 240px",
                  }}
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
                </a>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
