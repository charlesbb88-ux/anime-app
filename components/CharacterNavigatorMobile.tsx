// components/CharacterNavigatorMobile.tsx
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

export default function CharacterNavigatorMobile({ slug, className, limit }: Props) {
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

      const { data, error } = await supabase
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

      if (cancelled) return;

      if (error || !data) {
        setRows([]);
        setLoading(false);
        return;
      }

      const cleaned = (data as any as CharacterJoinRow[]).filter((r) => r?.characters?.id);
      setRows(cleaned);
      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const visibleRowsAll = useMemo(() => {
    const base = rows;
    const lim = typeof limit === "number" && limit > 0 ? limit : null;
    return lim ? base.slice(0, lim) : base;
  }, [rows, limit]);

  // ---- virtualization (same idea as EpisodeNavigatorMobile) ----
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const [viewportW, setViewportW] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const rafRef = useRef<number | null>(null);
  const lastEmitMsRef = useRef(0);
  const liveScrollLeftRef = useRef(0);

  // card layout (match your current styling)
  const CARD_W = 200;
  const GAP = 12; // gap-3
  const STEP = CARD_W + GAP;

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

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;

    liveScrollLeftRef.current = el.scrollLeft;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;

      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (now - lastEmitMsRef.current < 48) return; // ~20fps
      lastEmitMsRef.current = now;

      setScrollLeft(liveScrollLeftRef.current);
    });
  }

  const VBUF = 10;

  const { leftPx, rightPx, windowRows } = useMemo(() => {
    const count = visibleRowsAll.length;
    if (count <= 0) {
      return { leftPx: 0, rightPx: 0, windowRows: [] as CharacterJoinRow[] };
    }

    const maxIdx = count - 1;

    const vw = viewportW || 0;
    const left = scrollLeft || 0;

    const approxStart = Math.floor(left / STEP) - VBUF;
    const approxEnd = Math.ceil((left + vw) / STEP) + VBUF;

    const s = clamp(approxStart, 0, maxIdx);
    const e = clamp(approxEnd, 0, maxIdx);

    return {
      leftPx: s * STEP,
      rightPx: (maxIdx - e) * STEP,
      windowRows: visibleRowsAll.slice(s, e + 1),
    };
  }, [visibleRowsAll, viewportW, scrollLeft]);

  // ---- styles (same tokens as your Episode nav container) ----
  const cardBase =
    "group relative shrink-0 rounded-xs bg-[var(--card-bg)] ring-1 ring-[var(--ring)] shadow-sm transition";
  const cardHover = "hover:bg-white hover:shadow-md hover:ring-black/10";
  const cardSize = "h-[120px] w-[200px]";
  const thumbSize = "h-full w-[80px] shrink-0";

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
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="text-sm font-semibold text-black/90">Characters</div>
      </div>

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
            {windowRows.map((row) => {
              const c = row.characters;
              if (!c) return null;

              // you can swap this later when character pages exist
              const href = "#";

              const displayName = c.name_full ?? c.name_native ?? "Unknown";
              const role = row.role ?? "—";

              return (
                <Link
                  key={c.id}
                  href={href}
                  scroll={false}
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  onClick={(e) => {
                    if (href === "#") e.preventDefault();
                  }}
                  className={[cardBase, cardHover, cardSize].join(" ")}
                  style={{
                    contentVisibility: "auto",
                    containIntrinsicSize: "120px 200px",
                  }}
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
          </div>

          <div style={{ width: rightPx }} className="shrink-0" />

          {!loading && visibleRowsAll.length === 0 ? (
            <div className="px-4 py-3 text-sm text-white/80">No characters found.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
