"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ProgressRing from "./ProgressRing";
import UnitStepper from "@/components/completions/UnitStepper";

type CompletionKind = "anime" | "manga";

export type CompletionDetails = {
  id: string;
  slug: string | null;

  // base title + optional variants
  title: string;
  title_english?: string | null;
  title_native?: string | null;
  title_preferred?: string | null;

  kind: CompletionKind;
  image_url?: string | null;
};

type Props = {
  open: boolean;
  item: CompletionDetails | null;
  onClose: () => void;
  userId: string;
};

type ProgressState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; current: number; total: number }
  | { status: "error" };

type EngagementState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; reviewed: number; rated: number }
  | { status: "error" };

/** Ring filled segment colors */
const RING_FILLED_PROGRESS = "#0EA5E9"; // blue (watched/read)
const RING_FILLED_REVIEWED = "#22C55E"; // green (review)
const RING_FILLED_RATED = "#EF4444"; // red (rated)

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safeString(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

/** English-first, then fallbacks */
function displayTitle(it: CompletionDetails) {
  return (
    safeString(it.title_english) ||
    safeString(it.title) ||
    safeString(it.title_preferred) ||
    safeString(it.title_native) ||
    it.title
  );
}

async function fetchProgress(params: { userId: string; id: string; kind: CompletionKind }) {
  const qs = new URLSearchParams({
    userId: params.userId,
    id: params.id,
    kind: params.kind,
  });

  const r = await fetch(`/api/completions/progress?${qs.toString()}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`progress fetch failed: ${r.status}`);

  const data = (await r.json()) as { current?: unknown; total?: unknown };

  return {
    current: safeNum(data.current),
    total: safeNum(data.total),
  };
}

async function fetchEngagement(params: { userId: string; id: string; kind: CompletionKind }) {
  const qs = new URLSearchParams({
    userId: params.userId,
    id: params.id,
    kind: params.kind,
  });

  const r = await fetch(`/api/completions/engagement?${qs.toString()}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`engagement fetch failed: ${r.status}`);

  const data = (await r.json()) as { reviewed?: unknown; rated?: unknown };

  return {
    reviewed: safeNum(data.reviewed),
    rated: safeNum(data.rated),
  };
}

function useViewport() {
  const [vp, setVp] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const update = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    update();

    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("orientationchange", update, { passive: true });

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return vp;
}

export default function CompletionDetailsModal({ open, item, onClose, userId }: Props) {
  // ALL hooks at the top, always
  const vp = useViewport();

  const [progress, setProgress] = useState<ProgressState>({ status: "idle" });
  const [engagement, setEngagement] = useState<EngagementState>({ status: "idle" });
  const [infoOpen, setInfoOpen] = useState(false);

  const progressCacheRef = useRef<Map<string, { current: number; total: number }>>(new Map());
  const engagementCacheRef = useRef<Map<string, { reviewed: number; rated: number }>>(new Map());

  const cacheKey = useMemo(() => {
    if (!item) return "";
    return `${userId}:${item.kind}:${item.id}`;
  }, [userId, item?.id, item?.kind]);

  // Scroll lock — definitive iOS-safe version
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const html = document.documentElement;
    const body = document.body;

    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyPosition = body.style.position;
    const prevBodyTop = body.style.top;
    const prevBodyLeft = body.style.left;
    const prevBodyRight = body.style.right;
    const prevBodyWidth = body.style.width;

    const scrollY = window.scrollY;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    return () => {
      document.removeEventListener("keydown", onKeyDown);

      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.position = prevBodyPosition;
      body.style.top = prevBodyTop;
      body.style.left = prevBodyLeft;
      body.style.right = prevBodyRight;
      body.style.width = prevBodyWidth;

      window.scrollTo(0, scrollY);
    };
  }, [open, onClose]);

  // Reset info popover when opening or switching items
  useEffect(() => {
    if (open) setInfoOpen(false);
  }, [open, item?.id, item?.kind]);

  // Set loading state BEFORE first paint
  useLayoutEffect(() => {
    if (!open || !item) return;

    const pc = progressCacheRef.current.get(cacheKey);
    if (pc) setProgress({ status: "ready", current: pc.current, total: pc.total });
    else setProgress({ status: "loading" });

    const ec = engagementCacheRef.current.get(cacheKey);
    if (ec) setEngagement({ status: "ready", reviewed: ec.reviewed, rated: ec.rated });
    else setEngagement({ status: "loading" });
  }, [open, item?.id, item?.kind, cacheKey]);

  // Fetch progress on open / item change
  useEffect(() => {
    if (!open || !item) return;

    const cached = progressCacheRef.current.get(cacheKey);
    if (cached) return;

    let cancelled = false;

    fetchProgress({ userId, id: item.id, kind: item.kind })
      .then(({ current, total }) => {
        if (cancelled) return;
        progressCacheRef.current.set(cacheKey, { current, total });
        setProgress({ status: "ready", current, total });
      })
      .catch(() => {
        if (cancelled) return;
        setProgress({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [open, item?.id, item?.kind, userId, cacheKey]);

  // Fetch engagement on open / item change
  useEffect(() => {
    if (!open || !item) return;

    const cached = engagementCacheRef.current.get(cacheKey);
    if (cached) return;

    let cancelled = false;

    fetchEngagement({ userId, id: item.id, kind: item.kind })
      .then(({ reviewed, rated }) => {
        if (cancelled) return;
        engagementCacheRef.current.set(cacheKey, { reviewed, rated });
        setEngagement({ status: "ready", reviewed, rated });
      })
      .catch(() => {
        if (cancelled) return;
        setEngagement({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [open, item?.id, item?.kind, userId, cacheKey]);

  // Safe early return AFTER all hooks
  if (!open || !item) return null;

  const it = item;
  const title = displayTitle(it);
  const unit = it.kind === "manga" ? "chapter entries" : "episodes";

  const seriesHref = it.slug ? (it.kind === "manga" ? `/manga/${it.slug}` : `/anime/${it.slug}`) : null;
  const progressCenterLabel = it.kind === "manga" ? "Read" : "Watched";

  function retryProgress() {
    progressCacheRef.current.delete(cacheKey);
    setProgress({ status: "loading" });

    fetchProgress({ userId, id: it.id, kind: it.kind })
      .then(({ current, total }) => {
        progressCacheRef.current.set(cacheKey, { current, total });
        setProgress({ status: "ready", current, total });
      })
      .catch(() => setProgress({ status: "error" }));
  }

  function retryEngagement() {
    engagementCacheRef.current.delete(cacheKey);
    setEngagement({ status: "loading" });

    fetchEngagement({ userId, id: it.id, kind: it.kind })
      .then(({ reviewed, rated }) => {
        engagementCacheRef.current.set(cacheKey, { reviewed, rated });
        setEngagement({ status: "ready", reviewed, rated });
      })
      .catch(() => setEngagement({ status: "error" }));
  }

  const showProgress = progress.status === "ready";
  const current = showProgress ? progress.current : 0;
  const total = showProgress ? progress.total : 0;

  const showEngagement = engagement.status === "ready";
  const reviewed = showEngagement ? engagement.reviewed : 0;
  const rated = showEngagement ? engagement.rated : 0;

  // Desktop "exact iPhone screen frame" sizing
  const PHONE_W = 470;
  const PHONE_H = 844;
  const DESKTOP_MARGIN = 48;

  const availW = Math.max(0, (vp.w || PHONE_W + DESKTOP_MARGIN) - DESKTOP_MARGIN);
  const availH = Math.max(0, (vp.h || PHONE_H + DESKTOP_MARGIN) - DESKTOP_MARGIN);

  const scale = Math.min(1, availW / PHONE_W, availH / PHONE_H);

  const frameStyle: React.CSSProperties = {
    width: PHONE_W,
    height: PHONE_H,
    transform: `scale(${scale})`,
    transformOrigin: "center",
  };

  const baseBodyProps = {
    it,
    displayTitle: title,
    seriesHref,
    progress,
    engagement,
    retryProgress,
    retryEngagement,
    current,
    total,
    reviewed,
    rated,
    unit,
    infoOpen,
    setInfoOpen,
    progressCenterLabel,
  };

  return (
    <div className="fixed inset-0 z-[1000000]">
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 bg-black/60 touch-manipulation"
        onClick={onClose}
      />

      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        {/* ── MOBILE ── */}
        <div
          role="dialog"
          aria-modal="true"
          className="pointer-events-auto relative w-full h-[100dvh] bg-white overflow-hidden sm:hidden"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <Header
            onClose={onClose}
            progress={progress}
            engagement={engagement}
            retryProgress={retryProgress}
            retryEngagement={retryEngagement}
          />
          <div className="h-[calc(100%-52px)] overflow-y-auto overflow-x-hidden scrollbar-none overscroll-contain">
            <ModalBody {...baseBodyProps} layout="mobile" containerW={vp.w} />
          </div>
        </div>

        {/* ── DESKTOP: exact iPhone frame ── */}
        <div
          className="hidden sm:block pointer-events-auto"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={frameStyle}
            className="relative bg-white overflow-hidden rounded-2xl border border-black shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
            role="dialog"
            aria-modal="true"
          >
            <Header
              onClose={onClose}
              progress={progress}
              engagement={engagement}
              retryProgress={retryProgress}
              retryEngagement={retryEngagement}
            />
            <div className="h-[calc(100%-52px)] overflow-y-auto overflow-x-hidden scrollbar-none overscroll-contain">
              {/* IMPORTANT: desktop layout should be computed off the frame width (470), not full viewport */}
              <ModalBody {...baseBodyProps} layout="desktop" containerW={PHONE_W} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────

function Header({
  progress,
  engagement,
  retryProgress,
  retryEngagement,
  onClose,
}: {
  progress: ProgressState;
  engagement: EngagementState;
  retryProgress: () => void;
  retryEngagement: () => void;
  onClose: () => void;
}) {
  const anyLoading = progress.status === "loading" || engagement.status === "loading";
  const anyError = progress.status === "error" || engagement.status === "error";

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-black/10">
      <div className="text-sm font-semibold text-slate-900">Progress</div>

      <div className="flex items-center gap-2">
        {anyLoading ? (
          <div className="text-xs text-slate-500">Loading…</div>
        ) : anyError ? (
          <div className="flex items-center gap-2">
            {progress.status === "error" && (
              <button
                type="button"
                className="text-xs font-semibold text-red-600 hover:underline touch-manipulation"
                onClick={retryProgress}
              >
                Retry progress
              </button>
            )}
            {engagement.status === "error" && (
              <button
                type="button"
                className="text-xs font-semibold text-red-600 hover:underline touch-manipulation"
                onClick={retryEngagement}
              >
                Retry rings
              </button>
            )}
          </div>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-black bg-white px-2 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-50 active:translate-y-[1px] touch-manipulation"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ModalBody — shared between mobile + desktop
// ─────────────────────────────────────────────

function ModalBody({
  it,
  displayTitle,
  seriesHref,
  progress,
  engagement,
  retryProgress,
  retryEngagement,
  current,
  total,
  reviewed,
  rated,
  unit,
  infoOpen,
  setInfoOpen,
  progressCenterLabel,
  layout,
  containerW,
}: {
  it: CompletionDetails;
  displayTitle: string;
  seriesHref: string | null;
  progress: ProgressState;
  engagement: EngagementState;
  retryProgress: () => void;
  retryEngagement: () => void;
  current: number;
  total: number;
  reviewed: number;
  rated: number;
  unit: string;
  infoOpen: boolean;
  setInfoOpen: React.Dispatch<React.SetStateAction<boolean>>;
  progressCenterLabel: string;
  layout: "mobile" | "desktop";
  containerW: number;
}) {
  // Desktop should keep the original "designed" sizes.
  const DEFAULT_RING = 215;

  // Mobile auto-sizes to avoid clipping.
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

  const ringSize = (() => {
    if (layout === "desktop") return DEFAULT_RING;

    const MAX_RING = 215;
    const MIN_RING = 140;

    // px-4 => 16 each side
    const PAD_X = 32;
    const GAP = 16;

    // top row: poster ~min(160px,40vw) on mobile
    const posterApprox = Math.min(160, Math.floor((containerW || 0) * 0.4));
    const availTop = Math.max(0, (containerW || 0) - PAD_X - posterApprox - GAP);

    // bottom row: two rings + gap must fit
    const availBottomEach = Math.floor((Math.max(0, (containerW || 0) - PAD_X - GAP)) / 2);

    return clamp(Math.min(MAX_RING, availTop, availBottomEach), MIN_RING, MAX_RING);
  })();

  const RING_PX = ringSize;
  const RING_STROKE_PX = Math.round(RING_PX * 0.147);
  const RING_CENTER_HIT_PX = Math.round(RING_PX * 0.56);

  const ringBoxStyle: React.CSSProperties = { width: RING_PX, height: RING_PX };
  const ringColStyle: React.CSSProperties = { width: RING_PX };

  return (
    <>
      <div className="px-4 pt-4">
        {/* TOP ROW */}
        <div className="grid gap-4 grid-cols-[min(160px,40vw)_1fr] sm:grid-cols-[200px_1fr]">
          {/* Poster */}
          <div className="w-full">
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-black bg-slate-200">
              {it.image_url ? (
                seriesHref ? (
                  <Link href={seriesHref} className="absolute inset-0 block" aria-label={`Open ${displayTitle}`}>
                    <img
                      src={it.image_url}
                      alt={displayTitle}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-150 hover:scale-[1.02]"
                      draggable={false}
                    />
                    <div className="absolute inset-0 ring-0 ring-black/0 hover:ring-2 hover:ring-black/20" />
                  </Link>
                ) : (
                  <img
                    src={it.image_url}
                    alt={displayTitle}
                    className="absolute inset-0 h-full w-full object-cover"
                    draggable={false}
                  />
                )
              ) : null}
            </div>
          </div>

          {/* Right col */}
          <div className="min-w-0 flex flex-col gap-6">
            <div>
              <div className="text-base font-bold text-slate-900 leading-tight line-clamp-3">{displayTitle}</div>

              {progress.status === "loading" && <div className="mt-1 text-xs text-slate-500">Loading progress…</div>}
              {progress.status === "error" && (
                <div className="mt-1 text-xs text-red-600">
                  Couldn't load progress.{" "}
                  <button type="button" className="font-semibold hover:underline touch-manipulation" onClick={retryProgress}>
                    Retry
                  </button>
                </div>
              )}
              {engagement.status === "loading" && <div className="mt-1 text-xs text-slate-500">Loading rings…</div>}
              {engagement.status === "error" && (
                <div className="mt-1 text-xs text-red-600">
                  Couldn't load review/rating rings.{" "}
                  <button type="button" className="font-semibold hover:underline touch-manipulation" onClick={retryEngagement}>
                    Retry
                  </button>
                </div>
              )}
            </div>

            {/* Progress ring */}
            <div
              className="relative mx-auto sm:mx-0 sm:ml-2.5"
              style={ringBoxStyle}
              onMouseEnter={() => setInfoOpen(true)}
              onMouseLeave={() => setInfoOpen(false)}
            >
              {progress.status === "loading" ? (
                <div className="rounded-full border border-black/20 bg-slate-100 animate-pulse" style={ringBoxStyle} />
              ) : progress.status === "error" ? (
                <div className="text-sm text-slate-600">—</div>
              ) : (
                <>
                  <ProgressRing
                    current={current}
                    total={total}
                    size={RING_PX}
                    stroke={RING_STROKE_PX}
                    segmentCap={120}
                    kind={it.kind}
                    slug={it.slug}
                    filledColor={RING_FILLED_PROGRESS}
                    centerLabel={progressCenterLabel}
                  />

                  <button
                    type="button"
                    aria-label="Progress details"
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent touch-manipulation"
                    style={{ width: RING_CENTER_HIT_PX, height: RING_CENTER_HIT_PX }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setInfoOpen((v) => !v);
                    }}
                  />

                  {infoOpen && (
                    <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-2 z-10">
                      <div className="rounded-lg border border-black/20 bg-white px-3 py-2 text-[11px] text-slate-700 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
                        <div className="font-semibold text-slate-900">
                          {current} / {total} {unit}
                        </div>
                        {it.kind === "manga" && (
                          <div className="mt-0.5 text-slate-500">
                            Includes bonus/fractional chapters (e.g., 4.1, 4.2).
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* SECOND ROW */}
        <div className="mt-5 flex justify-center gap-4 flex-wrap sm:flex-nowrap">
          {/* Review ring */}
          <div className="flex flex-col items-center" style={ringColStyle}>
            <div className="relative" style={ringBoxStyle}>
              {engagement.status === "loading" ? (
                <div className="rounded-full border border-black/20 bg-slate-100 animate-pulse" style={ringBoxStyle} />
              ) : engagement.status === "error" ? (
                <div className="text-xs text-slate-600">—</div>
              ) : (
                <ProgressRing
                  current={reviewed}
                  total={total}
                  size={RING_PX}
                  stroke={RING_STROKE_PX}
                  segmentCap={120}
                  kind={it.kind}
                  slug={it.slug}
                  filledColor={RING_FILLED_REVIEWED}
                  centerLabel="Review"
                />
              )}
            </div>
          </div>

          {/* Rated ring */}
          <div className="flex flex-col items-center" style={ringColStyle}>
            <div className="relative" style={ringBoxStyle}>
              {engagement.status === "loading" ? (
                <div className="rounded-full border border-black/20 bg-slate-100 animate-pulse" style={ringBoxStyle} />
              ) : engagement.status === "error" ? (
                <div className="text-xs text-slate-600">—</div>
              ) : (
                <ProgressRing
                  current={rated}
                  total={total}
                  size={RING_PX}
                  stroke={RING_STROKE_PX}
                  segmentCap={120}
                  kind={it.kind}
                  slug={it.slug}
                  filledColor={RING_FILLED_RATED}
                  centerLabel="Rated"
                />
              )}
            </div>
          </div>
        </div>

        {/* Unit stepper */}
        <div className="mt-6">
          <div className="bg-transparent p-0">
            {progress.status === "loading" ? (
              <div className="h-[44px] w-full rounded-lg bg-slate-100 animate-pulse" />
            ) : progress.status === "error" ? (
              <div className="text-xs text-slate-600">—</div>
            ) : (
              <UnitStepper
                total={Math.max(0, total)}
                current={Math.max(0, current)}
                reviewed={Math.max(0, reviewed)}
                rated={Math.max(0, rated)}
                hrefBase={seriesHref ? (it.kind === "manga" ? `${seriesHref}/chapter/` : `${seriesHref}/episode/`) : null}
                posterUrl={it.image_url ?? null}
                label={it.kind === "manga" ? "Chapters" : "Episodes"}
                initialBatch={30}
                batchSize={30}
                endlessScroll
                colorProgress={RING_FILLED_PROGRESS}
                colorReviewed={RING_FILLED_REVIEWED}
                colorRated={RING_FILLED_RATED}
              />
            )}
          </div>
        </div>

        {progress.status !== "ready" && (
          <div className="mt-3 text-[11px] text-slate-500 w-[240px]">
            These rings use the series total from progress. Once progress loads, the denominators will be correct.
          </div>
        )}
      </div>

      <div className="h-6" />
    </>
  );
}