"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Props = {
  total: number;

  /** watched/read count */
  current: number;

  /** reviewed count */
  reviewed?: number;

  /** rated count */
  rated?: number;

  /** used for: current border (only) */
  accent?: string;

  hrefBase?: string | null;

  label?: string;
  rightHint?: string;

  initialBatch?: number;
  batchSize?: number;
  endlessScroll?: boolean;

  /** optional override colors (defaults match your rings) */
  colorProgress?: string; // blue
  colorReviewed?: string; // green
  colorRated?: string; // red
};

const COLS = 5;

// ✅ Subtle connectors that sit behind tiles
const CONNECTOR_W = 2;
const CONNECTOR_EMPTY = "rgba(15,23,42,0.14)";
const CONNECTOR_OPACITY = 0.9;

// ✅ ONE KNOB: change this and ALL “fully done” black updates everywhere
const FULLY_DONE_COLOR = "#000000";

export default function UnitStepper({
  total,
  current,
  reviewed = 0,
  rated = 0,

  accent = "#0EA5E9",
  hrefBase = null,

  label,
  rightHint,

  initialBatch = 25,
  batchSize = 25,
  endlessScroll = false,

  colorProgress = "#0EA5E9",
  colorReviewed = "#22C55E",
  colorRated = "#EF4444",
}: Props) {
  if (!Number.isFinite(total) || total < 1) {
    return <div className="text-xs text-slate-500">No units found.</div>;
  }

  const safeTotal = clampInt(total, 1, Number.MAX_SAFE_INTEGER);

  // ✅ focus = "current unit" (1-based), used for current border
  const focus = clampInt(current < 1 ? 1 : current, 1, safeTotal);

  // ✅ completion states (0..total)
  const safeCurrent = clampInt(current, 0, safeTotal);
  const safeReviewed = clampInt(reviewed, 0, safeTotal);
  const safeRated = clampInt(rated, 0, safeTotal);

  const [shown, setShown] = useState(() => Math.min(safeTotal, Math.max(1, initialBatch)));
  useEffect(() => {
    setShown(Math.min(safeTotal, Math.max(1, initialBatch)));
  }, [safeTotal, initialBatch]);

  const canLoadMore = shown < safeTotal;
  const loadMore = () => setShown((prev) => Math.min(safeTotal, prev + batchSize));

  const units = useMemo(() => {
    const arr: number[] = [];
    for (let i = 1; i <= shown; i++) arr.push(i);
    return arr;
  }, [shown]);

  const wrapRef = useRef<HTMLDivElement | null>(null);

  // ✅ IMPORTANT: we measure a stable, non-inline box (the tile container div)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [paths, setPaths] = useState<Array<{ d: string; stroke: string }>>([]);
  const [svgSize, setSvgSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Endless scroll
  useEffect(() => {
    if (!endlessScroll) return;
    if (!canLoadMore) return;

    const el = sentinelRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root: null, rootMargin: "300px", threshold: 0 }
    );

    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endlessScroll, canLoadMore, shown, safeTotal, batchSize]);

  // Compute connector paths (based on the stable tile boxes)
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const compute = () => {
      const rect = wrap.getBoundingClientRect();
      setSvgSize({ w: rect.width, h: rect.height });

      const next: Array<{ d: string; stroke: string }> = [];
      const EPS_SAME_ROW = 6;

      const getRel = (el: HTMLDivElement) => {
        const r = el.getBoundingClientRect();
        const left = r.left - rect.left;
        const right = r.right - rect.left;
        const top = r.top - rect.top;
        const bottom = r.bottom - rect.top;
        const cx = left + r.width / 2;
        const cy = top + r.height / 2;
        return { left, right, top, bottom, cx, cy };
      };

      // ✅ fully done: progress + review + rate
      const fullyDone = (n: number) => n <= safeCurrent && n <= safeReviewed && n <= safeRated;

      for (let i = 1; i < shown; i++) {
        const a = itemRefs.current[i - 1] as HTMLDivElement | null;
        const b = itemRefs.current[i] as HTMLDivElement | null;
        if (!a || !b) continue;

        const A = getRel(a);
        const B = getRel(b);

        const sameRow = Math.abs(A.cy - B.cy) < EPS_SAME_ROW;
        const isRowBreak = i % COLS === 0;

        if (!sameRow && !isRowBreak) continue;

        // ✅ connector “coming out of” tile i:
        // fully done -> FULLY_DONE_COLOR, else -> empty gray
        const stroke = fullyDone(i) ? FULLY_DONE_COLOR : CONNECTOR_EMPTY;

        if (sameRow) {
          next.push({
            stroke,
            d: [`M ${A.right} ${A.cy}`, `L ${B.left} ${B.cy}`].join(" "),
          });
          continue;
        }

        // Row break: route inside the vertical gap between rows
        const startX = A.cx;
        const startY = A.bottom;
        const endX = B.cx;
        const endY = B.top;

        const gapTop = A.bottom;
        const gapBottom = B.top;

        let trackY = gapTop + (gapBottom - gapTop) / 2;
        trackY = Math.max(gapTop + 6, Math.min(gapBottom - 6, trackY));

        next.push({
          stroke,
          d: [`M ${startX} ${startY}`, `L ${startX} ${trackY}`, `L ${endX} ${trackY}`, `L ${endX} ${endY}`].join(" "),
        });
      }

      setPaths(next);
    };

    compute();

    const ro = new ResizeObserver(() => compute());
    ro.observe(wrap);

    const t = window.setTimeout(compute, 0);

    const onScroll = () => compute();
    window.addEventListener("scroll", onScroll, true);

    return () => {
      window.clearTimeout(t);
      ro.disconnect();
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [shown, safeCurrent, safeReviewed, safeRated]);

  return (
    <div className="w-full">
      {(label || rightHint) && (
        <div className="flex items-center justify-between">
          {label ? <div className="text-xs font-semibold text-slate-900">{label}</div> : <div />}
          {rightHint ? <div className="text-[11px] text-slate-500">{rightHint}</div> : null}
        </div>
      )}

      <div className={(label || rightHint) ? "mt-2" : ""}>
        <div ref={wrapRef} className="relative w-full overflow-hidden">
          {/* Connector overlay (behind tiles) */}
          <svg width={svgSize.w} height={svgSize.h} className="pointer-events-none absolute inset-0" style={{ zIndex: 0 }}>
            {paths.map((p, idx) => (
              <path
                key={idx}
                d={p.d}
                fill="none"
                opacity={CONNECTOR_OPACITY}
                stroke={p.stroke}
                strokeWidth={CONNECTOR_W}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>

          {/* Tiles above connectors */}
          <div className="relative z-[1] grid grid-cols-5 gap-4">
            {units.map((n, idx) => (
              <StepperCell
                key={n}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                n={n}
                total={safeTotal}
                focus={focus}
                hrefBase={hrefBase}
                accent={accent}
                didProgress={n <= safeCurrent}
                didReview={n <= safeReviewed}
                didRate={n <= safeRated}
                colorProgress={colorProgress}
                colorReviewed={colorReviewed}
                colorRated={colorRated}
              />
            ))}
          </div>
        </div>

        <div className="mt-3">
          {endlessScroll ? (
            <div ref={sentinelRef} className="h-1 w-full" />
          ) : canLoadMore ? (
            <button
              type="button"
              onClick={loadMore}
              className="w-full rounded-lg border border-black/10 bg-white py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Load more
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const StepperCell = React.forwardRef(function StepperCell(
  {
    n,
    total,
    focus,
    hrefBase,
    accent,

    didProgress,
    didReview,
    didRate,

    colorProgress,
    colorReviewed,
    colorRated,
  }: {
    n: number;
    total: number;
    focus: number;
    hrefBase: string | null;
    accent: string;

    didProgress: boolean;
    didReview: boolean;
    didRate: boolean;

    colorProgress: string;
    colorReviewed: string;
    colorRated: string;
  },
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const isCurrent = n === focus;

  const anyFilled = didProgress || didReview || didRate;
  const isFullyDone = didProgress && didReview && didRate;

  const aria = `Go to ${n} of ${total}`;

  // measured box
  const boxClass = "w-full h-10 rounded-lg border-2 overflow-hidden relative select-none";

  const boxStyle: React.CSSProperties = {
    // ✅ fully done = FULLY_DONE_COLOR
    // ✅ otherwise = black border
    borderColor: isFullyDone ? FULLY_DONE_COLOR : "#000000",
    backgroundColor: "white",
  };

  const content = (
    <div className={boxClass} style={boxStyle}>
      {/* background */}
      {isFullyDone ? (
        <div className="absolute inset-0" style={{ backgroundColor: FULLY_DONE_COLOR }} />
      ) : (
        <>
          <div className="absolute inset-0 grid grid-cols-3">
            <div style={{ backgroundColor: didProgress ? colorProgress : "transparent" }} />
            <div style={{ backgroundColor: didReview ? colorReviewed : "transparent" }} />
            <div style={{ backgroundColor: didRate ? colorRated : "transparent" }} />
          </div>
        </>
      )}

      {/* number OR checkmark */}
      <div
        className="absolute inset-0 grid place-items-center text-[14px] font-bold"
        style={
          anyFilled || isFullyDone
            ? { color: "white", textShadow: "0 1px 1px rgba(0,0,0,0.25)" }
            : { color: "#000000" }
        }
      >
        {isFullyDone ? "✓" : n}
      </div>

      {/* hover hint */}
      {!anyFilled && !isFullyDone ? <div className="absolute inset-0 hover:bg-slate-50/70" /> : null}
    </div>
  );

  return (
    <div ref={ref} className="w-full">
      {hrefBase ? (
        <Link href={`${hrefBase}${n}`} aria-label={aria} className="block w-full">
          {content}
        </Link>
      ) : (
        <button type="button" aria-label={aria} className="block w-full">
          {content}
        </button>
      )}
    </div>
  );
});


function clampInt(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.floor(Number.isFinite(n) ? n : 0)));
}
