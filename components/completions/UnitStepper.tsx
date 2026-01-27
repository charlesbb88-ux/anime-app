"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Props = {
  total: number;
  current: number;
  accent?: string;
  hrefBase?: string | null;

  label?: string;
  rightHint?: string;

  initialBatch?: number;
  batchSize?: number;
  endlessScroll?: boolean;
};

const COLS = 5;

// ✅ Better style: subtle connectors (thin + light) + sit behind tiles
const CONNECTOR_W = 2;
const CONNECTOR_EMPTY = "rgba(15,23,42,0.14)";
const CONNECTOR_OPACITY = 0.9;

export default function UnitStepper({
  total,
  current,
  accent = "#7C3AED",
  hrefBase = null,
  label,
  rightHint,
  initialBatch = 25,
  batchSize = 25,
  endlessScroll = false,
}: Props) {
  if (!Number.isFinite(total) || total < 1) {
    return <div className="text-xs text-slate-500">No units found.</div>;
  }

  const focus = clampInt(current < 1 ? 1 : current, 1, total);

  const [shown, setShown] = useState(() => Math.min(total, Math.max(1, initialBatch)));
  useEffect(() => {
    setShown(Math.min(total, Math.max(1, initialBatch)));
  }, [total, initialBatch]);

  const canLoadMore = shown < total;
  const loadMore = () => setShown((prev) => Math.min(total, prev + batchSize));

  const units = useMemo(() => {
    const arr: number[] = [];
    for (let i = 1; i <= shown; i++) arr.push(i);
    return arr;
  }, [shown]);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [paths, setPaths] = useState<Array<{ d: string; filled: boolean }>>([]);
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
  }, [endlessScroll, canLoadMore, shown, total]);

  // Compute connector paths
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const compute = () => {
      const rect = wrap.getBoundingClientRect();
      setSvgSize({ w: rect.width, h: rect.height });

      const next: Array<{ d: string; filled: boolean }> = [];
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

      for (let i = 1; i < shown; i++) {
        const a = itemRefs.current[i - 1] as HTMLDivElement | null;
        const b = itemRefs.current[i] as HTMLDivElement | null;
        if (!a || !b) continue;

        const A = getRel(a);
        const B = getRel(b);

        const sameRow = Math.abs(A.cy - B.cy) < EPS_SAME_ROW;
        const isRowBreak = i % COLS === 0;

        if (!sameRow && !isRowBreak) continue;

        const filled = i + 1 <= focus;

        if (sameRow) {
          next.push({
            filled,
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
          filled,
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
  }, [shown, focus]);

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
          {/* Connector overlay (subtle + behind tiles) */}
          <svg
            width={svgSize.w}
            height={svgSize.h}
            className="pointer-events-none absolute inset-0"
            style={{ zIndex: 0 }}
          >
            {paths.map((p, idx) => (
              <path
                key={idx}
                d={p.d}
                fill="none"
                opacity={CONNECTOR_OPACITY}
                stroke={p.filled ? accent : CONNECTOR_EMPTY}
                strokeWidth={CONNECTOR_W}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>

          {/* Tiles above connectors */}
          <div className="relative z-[1] grid grid-cols-5 gap-4">
            {units.map((n, idx) => (
              <div
                key={n}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                className="w-full"
              >
                <StepperItem n={n} total={total} focus={focus} accent={accent} hrefBase={hrefBase} />
              </div>
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

function StepperItem({
  n,
  total,
  focus,
  accent,
  hrefBase,
}: {
  n: number;
  total: number;
  focus: number;
  accent: string;
  hrefBase: string | null;
}) {
  const isCompleted = n < focus;
  const isCurrent = n === focus;

  // keep borders “hairline” so the whole thing stays light
  const base =
    "grid place-items-center w-full h-10 rounded-lg select-none transition-transform active:translate-y-[1px] border";
  const textClass = "text-[12px] font-semibold";

  const styleCompleted: React.CSSProperties = {
    backgroundColor: accent,
    color: "white",
    borderColor: "transparent",
  };

  const styleCurrent: React.CSSProperties = {
    borderColor: accent,
    color: accent,
    backgroundColor: "white",
  };

  const styleFuture: React.CSSProperties = {
    borderColor: "rgba(15,23,42,0.22)",
    color: "rgba(15,23,42,0.65)",
    backgroundColor: "white",
  };

  const style = isCompleted ? styleCompleted : isCurrent ? styleCurrent : styleFuture;

  const className = [base, !isCompleted ? "hover:bg-slate-50" : ""].filter(Boolean).join(" ");
  const aria = `Go to ${n} of ${total}`;

  const inner = (
    <div className={textClass} style={{ lineHeight: 1 }}>
      {n}
    </div>
  );

  if (hrefBase) {
    return (
      <Link href={`${hrefBase}${n}`} aria-label={aria} className={className} style={style}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" aria-label={aria} className={className} style={style}>
      {inner}
    </button>
  );
}

function clampInt(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.floor(n)));
}
