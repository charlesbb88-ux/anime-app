"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useEpisodeThumbs } from "@/components/completions/useEpisodeThumbs";

type Props = {
  total: number;
  current: number;
  reviewed?: number;
  rated?: number;
  accent?: string;
  hrefBase?: string | null;

  // (kept so your caller doesn't break; we just don't use it anymore)
  posterUrl?: string | null;

  label?: string;
  rightHint?: string;

  initialBatch?: number;
  batchSize?: number;
  endlessScroll?: boolean;

  colorProgress?: string;
  colorReviewed?: string;
  colorRated?: string;
};

const CONNECTOR_W = 2;
const CONNECTOR_EMPTY = "rgba(15,23,42,0.14)";
const CONNECTOR_OPACITY = 0.9;

const FULLY_DONE_COLOR = "#000000";

function parseAnimeSlugFromHrefBase(hrefBase: string | null) {
  if (!hrefBase) return null;
  const m = hrefBase.match(/\/anime\/([^/]+)\/episode\/?$/);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

export default function UnitStepper({
  total,
  current,
  reviewed = 0,
  rated = 0,

  accent = "#0EA5E9",
  hrefBase = null,

  // kept but intentionally unused now
  posterUrl: _posterUrl = null,

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

  const focus = clampInt(current < 1 ? 1 : current, 1, safeTotal);

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

  // ----------------- ANIME: episode thumbs -----------------
  const animeSlug = useMemo(() => parseAnimeSlugFromHrefBase(hrefBase), [hrefBase]);
  const isAnime = !!animeSlug;

  // NOTE: this expects your hook to expose `loadedByNumber` (true once fetch resolves for that episode)
  const { metaByNumber, loadedByNumber } = useEpisodeThumbs({
    slug: animeSlug,
    numbers: units,
    enabled: isAnime,
  });

  const cols = isAnime ? 3 : 5;

  const wrapRef = useRef<HTMLDivElement | null>(null);
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

      const fullyDone = (n: number) => n <= safeCurrent && n <= safeReviewed && n <= safeRated;

      for (let i = 1; i < shown; i++) {
        const a = itemRefs.current[i - 1] as HTMLDivElement | null;
        const b = itemRefs.current[i] as HTMLDivElement | null;
        if (!a || !b) continue;

        const A = getRel(a);
        const B = getRel(b);

        const sameRow = Math.abs(A.cy - B.cy) < EPS_SAME_ROW;
        const isRowBreak = i % cols === 0;

        if (!sameRow && !isRowBreak) continue;

        const stroke = fullyDone(i) ? FULLY_DONE_COLOR : CONNECTOR_EMPTY;

        if (sameRow) {
          next.push({ stroke, d: [`M ${A.right} ${A.cy}`, `L ${B.left} ${B.cy}`].join(" ") });
          continue;
        }

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
  }, [shown, safeCurrent, safeReviewed, safeRated, cols]);

  return (
    <div className="w-full">
      {(label || rightHint) && (
        <div className="flex items-center justify-between">
          {label ? <div className="text-xs font-semibold text-slate-900">{label}</div> : <div />}
          {rightHint ? <div className="text-[11px] text-slate-500">{rightHint}</div> : null}
        </div>
      )}

      <div className={label || rightHint ? "mt-2" : ""}>
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
          <div className={["relative z-[1] grid gap-4", isAnime ? "grid-cols-3" : "grid-cols-5"].join(" ")}>
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
                isAnime={isAnime}
                thumbUrl={isAnime ? metaByNumber[n]?.imageUrl ?? null : null}
                thumbLoaded={isAnime ? !!loadedByNumber?.[n] : true}
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

    isAnime,
    thumbUrl,
    thumbLoaded,
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

    isAnime: boolean;
    thumbUrl: string | null;
    thumbLoaded: boolean;
  },
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const isCurrent = n === focus;

  const anyFilled = didProgress || didReview || didRate;
  const isFullyDone = didProgress && didReview && didRate;

  // ✅ NEW: number color logic
  const numberWhite = isFullyDone || didReview;

  const aria = `Go to ${n} of ${total}`;

  // ✅ MANGA
  const renderMangaLike = () => {
    const boxClass = "w-full h-10 rounded-lg border-2 overflow-hidden relative select-none";

    const boxStyle: React.CSSProperties = {
      borderColor: isFullyDone ? FULLY_DONE_COLOR : "#000000",
      backgroundColor: "white",
    };

    return (
      <div className={boxClass} style={boxStyle}>
        {isFullyDone ? (
          <div className="absolute inset-0" style={{ backgroundColor: FULLY_DONE_COLOR }} />
        ) : (
          <div className="absolute inset-0 grid grid-cols-3">
            <div style={{ backgroundColor: didProgress ? colorProgress : "transparent" }} />
            <div style={{ backgroundColor: didReview ? colorReviewed : "transparent" }} />
            <div style={{ backgroundColor: didRate ? colorRated : "transparent" }} />
          </div>
        )}

        <div
          className="absolute inset-0 grid place-items-center text-[14px] font-bold"
          style={
            numberWhite
              ? { color: "white", textShadow: "0 1px 1px rgba(0,0,0,0.25)" }
              : { color: "#000000" }
          }
        >
          {isFullyDone ? "✓" : n}
        </div>

        {!anyFilled && !isFullyDone ? <div className="absolute inset-0 hover:bg-slate-50/70" /> : null}
      </div>
    );
  };

  /**
   * ✅ ANIME:
   * - If episode image exists: show image (and your bottom status bar rules)
   * - If episode image does NOT exist (after thumbLoaded): use "manga-style" fallback
   *   BUT keep the anime episode box shape (16:9).
   *
   * No poster. No fallback image. Ever.
   */
  const renderAnime = () => {
    const boxClass = ["w-full rounded-lg border-2 overflow-hidden relative select-none", "aspect-[16/9]", "min-h-[74px]"].join(" ");

    const boxStyle: React.CSSProperties = {
      borderColor: isFullyDone ? FULLY_DONE_COLOR : "#000000",
      backgroundColor: "white",
    };

    const BAR_H = 16;
    const showBar = anyFilled || isFullyDone;
    const EMPTY_SEG = "rgba(255,255,255,0.18)";

    // while fetching: neutral placeholder so we don't "decide" wrongly
    if (!thumbLoaded) {
      return <div className={[boxClass, "bg-slate-100 animate-pulse"].join(" ")} style={boxStyle} />;
    }

    const hasEpisodeImage = !!thumbUrl;

    // --- (A) NO EPISODE IMAGE -> manga-style fill across the whole tile ---
    if (!hasEpisodeImage) {
      return (
        <div className={boxClass} style={boxStyle}>
          {isFullyDone ? (
            <div className="absolute inset-0" style={{ backgroundColor: FULLY_DONE_COLOR }} />
          ) : (
            <div className="absolute inset-0 grid grid-cols-3">
              <div style={{ backgroundColor: didProgress ? colorProgress : "transparent" }} />
              <div style={{ backgroundColor: didReview ? colorReviewed : "transparent" }} />
              <div style={{ backgroundColor: didRate ? colorRated : "transparent" }} />
            </div>
          )}

          <div
            className="absolute inset-0 grid place-items-center text-[22px] font-extrabold"
            style={
              numberWhite
                ? { color: "white", textShadow: "0 2px 6px rgba(0,0,0,0.35)" }
                : { color: "#000000" }
            }
          >
            {isFullyDone ? "✓" : n}
          </div>

          {isCurrent ? <div className="pointer-events-none absolute inset-0 ring-2 ring-sky-400/95" /> : null}
          {!anyFilled && !isFullyDone ? <div className="absolute inset-0 hover:bg-slate-50/60" /> : null}
        </div>
      );
    }

    // --- (B) HAS EPISODE IMAGE -> your existing image + bottom bar behavior ---
    return (
      <div className={boxClass} style={boxStyle}>
        <img src={thumbUrl} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} loading="lazy" decoding="async" />

        {/* number */}
        <div className="absolute left-2 top-2 text-[13px] font-extrabold" style={{ color: "white", textShadow: "0 1px 2px rgba(0,0,0,0.75)" }}>
          {n}
        </div>

        {/* bottom status bar (only if at least one done OR fully done) */}
        {showBar ? (
          isFullyDone ? (
            <div className="absolute left-0 right-0 bottom-0 flex items-center justify-center" style={{ height: BAR_H, backgroundColor: FULLY_DONE_COLOR }}>
              <div className="text-[10px] font-extrabold tracking-wide text-white">COMPLETED</div>
            </div>
          ) : (
            <div className="absolute left-0 right-0 bottom-0 grid grid-cols-3" style={{ height: BAR_H }}>
              <div style={{ backgroundColor: didProgress ? colorProgress : EMPTY_SEG }} />
              <div style={{ backgroundColor: didReview ? colorReviewed : EMPTY_SEG }} />
              <div style={{ backgroundColor: didRate ? colorRated : EMPTY_SEG }} />
            </div>
          )
        ) : null}

        {isCurrent ? <div className="pointer-events-none absolute inset-0 ring-2 ring-sky-400/95" /> : null}
        {!anyFilled && !isFullyDone ? <div className="absolute inset-0 hover:bg-white/10" /> : null}
      </div>
    );
  };

  const content = isAnime ? renderAnime() : renderMangaLike();

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