// components/EpisodeContinueRow.tsx
"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";

export type ContinueEpisodeItem = {
  key: string; // unique
  href: string;

  seasonLabel: string; // "S01"
  episodeLabel: string; // "E31" or "E31 (E31)" etc
  titleTop: string; // "S01 | E31 (E31)" or whatever you want
  titleBottom: string; // episode title line 1
  titleBottom2?: string | null; // optional line 2

  imageUrl?: string | null;
  checked?: boolean;
};

type Props = {
  title?: string;
  items: ContinueEpisodeItem[];
  className?: string;
};

export default function EpisodeContinueRow({
  title = "Start tracking",
  items,
  className,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // drag state
  const [dragging, setDragging] = useState(false);
  const dragState = useRef<{
    isDown: boolean;
    startX: number;
    startScrollLeft: number;
    pointerId: number | null;
  }>({ isDown: false, startX: 0, startScrollLeft: 0, pointerId: null });

  const canScroll = items.length > 0;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = scrollerRef.current;
    if (!el) return;

    // Only left click / primary touch
    if (e.pointerType === "mouse" && e.button !== 0) return;

    dragState.current.isDown = true;
    dragState.current.startX = e.clientX;
    dragState.current.startScrollLeft = el.scrollLeft;
    dragState.current.pointerId = e.pointerId;

    setDragging(true);

    // capture pointer so you can drag outside the row
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = scrollerRef.current;
    if (!el) return;
    if (!dragState.current.isDown) return;

    const dx = e.clientX - dragState.current.startX;
    el.scrollLeft = dragState.current.startScrollLeft - dx;
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragState.current.isDown) return;

    dragState.current.isDown = false;
    dragState.current.pointerId = null;
    setDragging(false);

    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }

  // Optional: make vertical wheel scroll move horizontally (feels like their row)
  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    const el = scrollerRef.current;
    if (!el) return;

    // If user is already doing horizontal scroll, let it happen
    const isMostlyVertical = Math.abs(e.deltaY) > Math.abs(e.deltaX);

    if (isMostlyVertical && !e.shiftKey) {
      // convert vertical wheel to horizontal scroll
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }
  }

  const cursorClass = dragging ? "cursor-grabbing" : "cursor-grab";

  return (
    <section className={className}>
      <div className="mb-2 text-sm font-semibold text-black/80">{title}</div>

      <div className="relative">
        {/* edge fades like the Flutter app */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white to-white/0" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-white/0" />

        <div
          className={[
            "scrollbar-none",
            "relative flex gap-3 overflow-x-auto py-1",
            "select-none",
            cursorClass,
          ].join(" ")}
          ref={scrollerRef}
          onPointerDown={canScroll ? onPointerDown : undefined}
          onPointerMove={canScroll ? onPointerMove : undefined}
          onPointerUp={canScroll ? endDrag : undefined}
          onPointerCancel={canScroll ? endDrag : undefined}
          onPointerLeave={canScroll ? endDrag : undefined}
          onWheel={canScroll ? onWheel : undefined}
        >
          {/* left padding so first card doesn't touch edge */}
          <div className="w-2 shrink-0" />

          {items.map((it) => (
            <Link
              key={it.key}
              href={it.href}
              className={[
                "group relative",
                "shrink-0",
                "h-[74px] w-[300px]", // close to what you recorded
                "rounded-lg bg-white",
                "shadow-sm ring-1 ring-black/5",
                "hover:shadow-md hover:ring-black/10",
                "transition",
              ].join(" ")}
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
            >
              <div className="flex h-full overflow-hidden rounded-lg">
                {/* thumbnail */}
                <div className="h-full w-[74px] shrink-0 bg-black/5">
                  {it.imageUrl ? (
                    // use img to match their “raw” look (no Next image blur artifacts)
                    <img
                      src={it.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className="h-full w-full" />
                  )}
                </div>

                {/* text */}
                <div className="flex min-w-0 flex-1 flex-col justify-center px-3">
                  <div className="truncate text-base font-extrabold tracking-tight text-black/90">
                    {it.titleTop}
                  </div>
                  <div className="truncate text-sm text-black/70">
                    {it.titleBottom}
                  </div>
                  {it.titleBottom2 ? (
                    <div className="truncate text-sm text-black/70">
                      {it.titleBottom2}
                    </div>
                  ) : null}
                </div>

                {/* check bubble */}
                <div className="flex items-center pr-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/5">
                    {it.checked ? (
                      <span className="text-sm font-bold text-black/55">✓</span>
                    ) : (
                      <span className="text-sm font-bold text-black/25"> </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}

          {/* right padding so last card doesn't touch edge */}
          <div className="w-2 shrink-0" />
        </div>
      </div>
    </section>
  );
}
