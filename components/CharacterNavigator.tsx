"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getAnimeBySlug } from "@/lib/anime";

type Props = {
  slug: string;
  className?: string;
  limit?: number; // optional (show first N only)
};

type CharacterJoinRow = {
  role: string | null;
  order_index: number | null;
  characters: {
    id: string;
    anilist_id: number;
    name_full: string | null;
    name_native: string | null;
    image_medium: string | null;
  } | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export default function CharacterNavigator({ slug, className, limit }: Props) {
  // ---- data ----
  const [rows, setRows] = useState<CharacterJoinRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!slug) return;
      setLoading(true);

      const { data: anime, error: animeErr } = await getAnimeBySlug(slug);
      if (cancelled) return;
      if (animeErr || !anime?.id) {
        setRows([]);
        setLoading(false);
        return;
      }

      const q = supabase
        .from("anime_characters")
        .select(
          `
          role,
          order_index,
          characters:character_id (
            id,
            anilist_id,
            name_full,
            name_native,
            image_medium
          )
        `
        )
        .eq("anime_id", anime.id)
        .order("order_index", { ascending: true });

      const { data, error } = await q;
      if (cancelled) return;

      if (error || !data) {
        setRows([]);
        setLoading(false);
        return;
      }

      const cleaned = (data as any as CharacterJoinRow[]).filter(
        (r) => r?.characters?.id
      );

      setRows(cleaned);
      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const visibleRows = useMemo(() => {
    const base = rows;
    const lim = typeof limit === "number" && limit > 0 ? limit : null;
    return lim ? base.slice(0, lim) : base;
  }, [rows, limit]);

  // ---- snapping physics (copied from EpisodeNavigator, trimmed) ----
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

  const VELOCITY_FLICK = 0.6; // px/ms
  const DISTANCE_THRESHOLD_FACTOR = 0.22;
  const SNAP_DURATION_MS = 260;

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
    if (!first) return 240;

    const firstIdx = cardRefs.current.findIndex(Boolean);
    const second = cardRefs.current.slice(firstIdx + 1).find(Boolean);

    if (!second) return 240;

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
      isFlick && duration <= TINY_FLICK_MAX_MS && Math.abs(dx) <= TINY_FLICK_MAX_PX;

    const draggedScroll = Math.abs(el.scrollLeft - dragRef.current.startScrollLeft);
    const farDrag = draggedScroll > step * 1.1;
    const isFlickAllowed = isFlick && !farDrag;

    let target = startIndex;

    if (isFlickAllowed) {
      const dir = v > 0 ? -1 : 1;
      target = startIndex + dir;
      if (isTinyFlick) target = clamp(target, startIndex - 1, startIndex + 1);
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

      const clientX = ev.clientX;

      recordSample(clientX);

      const dxFromStart = clientX - dragRef.current.startX;
      dragRef.current.maxMovePx = Math.max(dragRef.current.maxMovePx, Math.abs(dxFromStart));

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
      const idx = getNearestCardIndex();
      scrollToCardIndex(idx, 220);
    }, 110);
  }

  // ---- styles (match EpisodeNavigator container) ----
  const cardBase =
    "group relative shrink-0 rounded-xs bg-[var(--card-bg)] ring-1 ring-[var(--ring)] shadow-sm transition";
  const cardHover = "hover:bg-[var(--card-bg-hover)] hover:shadow-md hover:ring-black/10";

  // Character card sizing: slightly narrower than episodes
  const cardSize = "h-[120px] w-[200px]";
  const thumbSize = "h-full w-[80px] shrink-0";

  const totalCount = rows.length;

  return (
    <div
      className={["min-w-0", className ?? ""].join(" ")}
      style={{
        "--card-bg": "rgba(245, 250, 255, 1)",
        "--card-bg-hover": "white",
        "--ring": "rgba(245, 250, 255, 1)",
      } as React.CSSProperties}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="text-sm font-semibold text-black/90">Characters</div>
      </div>

      <div className="w-full overflow-hidden rounded-sm border border-black bg-black">
        <div
          ref={scrollerRef}
          className={[
            "scrollbar-none relative flex gap-3 overflow-x-auto",
            "select-none touch-pan-y",
            "px-0 py-2",
            dragging ? "cursor-grabbing" : "cursor-grab",
          ].join(" ")}
          onPointerDown={onPointerDown}
          onWheel={onWheel}
        >
          {visibleRows.map((row, idx) => {
            const c = row.characters;
            if (!c) return null;

            // Placeholder URL for future character page.
            // If you don't have it yet, keep "#" so it’s not broken.
            const href = "#";

            const displayName = c.name_full ?? c.name_native ?? "Unknown";
            const role = row.role ?? "—";

            return (
              <Link
                key={c.id}
                href={href}
                ref={(node) => {
                  cardRefs.current[idx] = node;
                }}
                onClick={(e) => {
                  if (dragRef.current.blockNextClick) {
                    e.preventDefault();
                    dragRef.current.blockNextClick = false;
                  }
                  if (href === "#") e.preventDefault();
                }}
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                className={[cardBase, cardHover, cardSize].join(" ")}
              >
                <div className="flex h-full overflow-hidden rounded-xs">
                  <div className={[thumbSize, "bg-black/5"].join(" ")}>
                    {c.image_medium ? (
                      <img
                        src={c.image_medium}
                        alt=""
                        className="h-full w-full object-cover"
                        draggable={false}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : null}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-start px-3 py-3">
                    <div className="text-xs font-medium text-black/50">{role}</div>

                    <div
                      className="mt-1 text-sm font-semibold text-black/90 break-words leading-snug flex-1 min-h-0"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {displayName}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}

          {!loading && visibleRows.length === 0 ? (
            <div className="px-4 py-3 text-sm text-white/80">
              No characters found.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
