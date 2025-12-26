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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function normalizeThumbUrl(url: string) {
  if (!url) return url;

  if (url.includes("https://image.tmdb.org/t/p/")) {
    // Always use a reasonable size for thumbs
    // (w500 is plenty for a ~70px wide thumbnail)
    return url.replace(/\/t\/p\/(original|w1280|w780|w500|w342|w300|w185)\//, "/t/p/w500/");
  }

  return url;
}


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

export default function EpisodeNavigator({
  slug,
  totalEpisodes,
  currentEpisodeNumber,
  className,
}: Props) {
  const total = typeof totalEpisodes === "number" ? totalEpisodes : null;
  const hasTotal =
    typeof total === "number" && Number.isFinite(total) && total > 0;

  const current =
    typeof currentEpisodeNumber === "number" ? currentEpisodeNumber : null;

  const currentSafe =
    typeof current === "number" && Number.isFinite(current) && current > 0
      ? current
      : null;

  const animeHref = `/anime/${encodeURIComponent(slug)}`;
  const episodeBase = `${animeHref}/episode`;

  const episodeNumbers = useMemo(() => {
    if (!hasTotal) return [];
    const capped = Math.min(total as number, 500);

    const windowSize = 18;
    const half = Math.floor(windowSize / 2);

    const center = currentSafe ?? 1;
    let start = clamp(center - half, 1, capped);
    let end = clamp(center + half, 1, capped);

    const actual = end - start + 1;
    if (actual < windowSize) {
      const missing = windowSize - actual;
      start = clamp(start - missing, 1, capped);
      end = clamp(start + windowSize - 1, 1, capped);
    }

    const nums: number[] = [];
    for (let i = start; i <= end; i++) nums.push(i);

    const result: (number | "…")[] = [];
    if (nums[0] !== 1) {
      result.push(1);
      if (nums[0] > 2) result.push("…");
    }
    result.push(...nums);
    if (nums[nums.length - 1] !== capped) {
      if (nums[nums.length - 1] < capped - 1) result.push("…");
      result.push(capped);
    }
    return result;
  }, [hasTotal, total, currentSafe]);

  const numericEpisodeNumbers = useMemo(
    () => episodeNumbers.filter((x): x is number => typeof x === "number"),
    [episodeNumbers]
  );

  // ---- fetch titles + images ----
  const [metaByNumber, setMetaByNumber] = useState<Record<number, EpisodeMeta>>(
    {}
  );

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setMetaByNumber({});
      if (!slug) return;
      if (!hasTotal) return;

      const { data: anime, error: animeErr } = await getAnimeBySlug(slug);
      if (cancelled) return;
      if (animeErr || !anime?.id) return;

      const wantedNums = numericEpisodeNumbers;
      if (wantedNums.length === 0) return;

      const { data: eps, error: epsErr } = await supabase
        .from("anime_episodes")
        .select("id, episode_number, title")
        .eq("anime_id", anime.id)
        .in("episode_number", wantedNums);

      if (cancelled) return;
      if (epsErr || !eps) return;

      const episodeRows = eps as EpisodeRow[];

      const idByNumber: Record<number, string> = {};
      const titleByNumber: Record<number, string | null> = {};
      for (const e of episodeRows) {
        if (typeof e.episode_number !== "number") continue;
        idByNumber[e.episode_number] = e.id;
        titleByNumber[e.episode_number] = e.title ?? null;
      }

      const episodeIds = Object.values(idByNumber);
      if (episodeIds.length === 0) return;

      const { data: arts, error: artsErr } = await supabase
        .from("anime_episode_artwork")
        .select("anime_episode_id, url, source, vote, is_primary, width")
        .in("anime_episode_id", episodeIds)
        .neq("source", "tvdb");

      if (cancelled) return;
      if (artsErr) return;

      const byEpisodeId: Record<string, ArtworkRow[]> = {};
      for (const r of (arts as ArtworkRow[]) ?? []) {
        if (!r?.anime_episode_id) continue;
        if (!byEpisodeId[r.anime_episode_id]) byEpisodeId[r.anime_episode_id] =
          [];
        byEpisodeId[r.anime_episode_id].push(r);
      }

      const next: Record<number, EpisodeMeta> = {};
      for (const n of wantedNums) {
        const epId = idByNumber[n];
        const best =
          epId && byEpisodeId[epId] ? pickBestArtwork(byEpisodeId[epId]) : null;

        next[n] = {
          title: titleByNumber[n] ?? null,
          imageUrl: best ? normalizeThumbUrl(best) : null,
        };
      }

      setMetaByNumber(next);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [slug, hasTotal, numericEpisodeNumbers]);

  // ---- snapping physics ----
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  cardRefs.current = [];

  const animRef = useRef<number | null>(null);
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

  // Feel knobs (flicks are perfect — do not change)
  const VELOCITY_FLICK = 0.6; // px/ms
  const DISTANCE_THRESHOLD_FACTOR = 0.22;
  const SNAP_DURATION_MS = 260;

  // “tiny flick” limiter
  const TINY_FLICK_MAX_MS = 90;
  const TINY_FLICK_MAX_PX = 30;

  function stopAnim() {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = null;
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
    const first = cardRefs.current.find(Boolean);
    if (!first) return 332;

    const firstIdx = cardRefs.current.findIndex(Boolean);
    const second = cardRefs.current.slice(firstIdx + 1).find(Boolean);

    if (!second) return 332;

    const r1 = first.getBoundingClientRect();
    const r2 = second.getBoundingClientRect();
    return Math.max(1, r2.left - r1.left);
  }

  function scrollToCardIndex(idx: number, ms = SNAP_DURATION_MS) {
    const el = scrollerRef.current;
    const card = cardRefs.current[idx];
    if (!el || !card) return;

    stopAnim();

    const start = el.scrollLeft;

    const elRect = el.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();

    const elCenter = elRect.left + el.clientWidth / 2;
    const cardCenter = cardRect.left + cardRect.width / 2;

    const delta = cardCenter - elCenter;
    const target = start + delta;

    const t0 = performance.now();

    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const eased = easeOutCubic(p);
      el.scrollLeft = start + (target - start) * eased;
      if (p < 1) animRef.current = requestAnimationFrame(tick);
      else animRef.current = null;
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

    // click block only after real drag
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

    const draggedScroll = Math.abs(
      el.scrollLeft - dragRef.current.startScrollLeft
    );
    const farDrag = draggedScroll > step * 1.1;
    const isFlickAllowed = isFlick && !farDrag;

    let target = startIndex;

    if (isFlickAllowed) {
      // ✅ FLICKS (unchanged)
      const dir = v > 0 ? -1 : 1;
      target = startIndex + dir;

      if (isTinyFlick) {
        target = clamp(target, startIndex - 1, startIndex + 1);
      }
    } else {
      // ✅ long/slow drags
      if (draggedScroll < distThreshold) target = startIndex;
      else target = getNearestCardIndex();
    }

    const count = cardRefs.current.filter(Boolean).length;
    target = clamp(target, 0, Math.max(0, count - 1));

    scrollToCardIndex(target);
    window.setTimeout(() => setDragging(false), 0);
  }

  // ✅ window listeners ONLY while dragging (this restores endless drag)
  useEffect(() => {
    function onWinMove(e: PointerEvent) {
      const el = scrollerRef.current;
      if (!el) return;
      if (!dragRef.current.isDown) return;

      // ignore second pointers
      // (we don't store pointerId; this is "good enough" for mouse + single touch)
      const clientX = e.clientX;

      recordSample(clientX);

      const dxFromStart = clientX - dragRef.current.startX;
      dragRef.current.maxMovePx = Math.max(
        dragRef.current.maxMovePx,
        Math.abs(dxFromStart)
      );

      if (
        !dragRef.current.didDrag &&
        Math.abs(dxFromStart) >= DRAG_THRESHOLD_PX
      ) {
        dragRef.current.didDrag = true;
        setDragging(true);
      }

      if (dragRef.current.didDrag) {
        const prevX = dragRef.current.lastX;
        const delta = prevX - clientX;
        el.scrollLeft = el.scrollLeft + delta;
        dragRef.current.lastX = clientX;
      }
    }

    function onWinUp() {
      if (!dragRef.current.isDown) return;
      finishDrag();
      window.removeEventListener("pointermove", onWinMove);
      window.removeEventListener("pointerup", onWinUp);
      window.removeEventListener("pointercancel", onWinUp);
    }

    // attach when isDown becomes true (we toggle inside onPointerDown)
    if (dragRef.current.isDown) {
      window.addEventListener("pointermove", onWinMove, { passive: true });
      window.addEventListener("pointerup", onWinUp, { passive: true });
      window.addEventListener("pointercancel", onWinUp, { passive: true });
    }

    return () => {
      window.removeEventListener("pointermove", onWinMove);
      window.removeEventListener("pointerup", onWinUp);
      window.removeEventListener("pointercancel", onWinUp);
    };
  }, [dragging]); // re-run when we flip dragging on (first time we cross threshold)

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

    // ✅ attach endless-drag listeners immediately
    // (we attach here, not via pointer capture)
    // NOTE: we must attach synchronously so you can leave the row instantly.
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

      if (
        !dragRef.current.didDrag &&
        Math.abs(dxFromStart) >= DRAG_THRESHOLD_PX
      ) {
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
      const idx = getNearestCardIndex();
      scrollToCardIndex(idx, 220);
    }, 110);
  }

  // ---- styles ----
  const cardBase =
    "group relative shrink-0 rounded-xs bg-[var(--card-bg)] ring-1 ring-[var(--ring)] shadow-sm transition";
  const cardHover = "hover:bg-[var(--card-bg-hover)] hover:shadow-md hover:ring-black/10";
  const cardSize = "h-[120px] w-[240px]";
  const thumbSize = "h-full w-[120px] shrink-0";

  return (
    <div
      className={["min-w-0", className ?? ""].join(" ")}
      style={{
        "--card-bg": "rgba(245, 250, 255, 1)",
        "--card-bg-hover": "white",
        "--ring": "rgba(245, 250, 255, 1)",
      } as React.CSSProperties}
    >
      <div className="w-full overflow-hidden rounded-sm border border-black bg-black">
        <div
          ref={scrollerRef}
          className={[
            "scrollbar-none relative flex gap-3 overflow-x-auto",
            "select-none touch-pan-y",
            "px-0 py-2", // breathing room from the border
            dragging ? "cursor-grabbing" : "cursor-grab",
          ].join(" ")}
          onPointerDown={onPointerDown}
          onWheel={onWheel}
        >
          {numericEpisodeNumbers.map((n, idx) => {
            const meta = metaByNumber[n];
            const title = meta?.title ?? `Episode ${n}`;
            const imageUrl = meta?.imageUrl ?? null;

            const metaLine = `S${pad2(1)} · E${pad2(n)}`;
            const isActive = currentSafe === n;

            return (
              <Link
                key={n}
                href={`${episodeBase}/${n}`}
                ref={(node) => {
                  cardRefs.current[idx] = node;
                }}
                onClick={(e) => {
                  if (dragRef.current.blockNextClick) {
                    e.preventDefault();
                    dragRef.current.blockNextClick = false;
                  }
                }}
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                className={[
                  // 🔒 cards unchanged
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
      </div>
    </div>
  );
}
