"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ProgressRing from "./ProgressRing";

type CompletionKind = "anime" | "manga";

export type CompletionDetails = {
  id: string;
  slug: string | null;
  title: string;
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

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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
  // ✅ ALL hooks at the top, always
  const vp = useViewport();

  const [progress, setProgress] = useState<ProgressState>({ status: "idle" });
  const [infoOpen, setInfoOpen] = useState(false);

  const cacheRef = useRef<Map<string, { current: number; total: number }>>(new Map());

  const cacheKey = useMemo(() => {
    if (!item) return "";
    return `${userId}:${item.kind}:${item.id}`;
  }, [userId, item?.id, item?.kind]);

  // escape + scroll lock
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // reset info popover when opening/changing item
  useEffect(() => {
    if (open) setInfoOpen(false);
  }, [open, item?.id, item?.kind]);

  /**
   * Prevent placeholder flash:
   * set loading BEFORE first paint unless cached.
   */
  useLayoutEffect(() => {
    if (!open || !item) return;

    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setProgress({ status: "ready", current: cached.current, total: cached.total });
      return;
    }

    setProgress({ status: "loading" });
  }, [open, item?.id, item?.kind, cacheKey]);

  // fetch progress on open / item change
  useEffect(() => {
    if (!open || !item) return;

    const cached = cacheRef.current.get(cacheKey);
    if (cached) return;

    let cancelled = false;

    fetchProgress({ userId, id: item.id, kind: item.kind })
      .then(({ current, total }) => {
        if (cancelled) return;
        cacheRef.current.set(cacheKey, { current, total });
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

  // ✅ Safe early return AFTER hooks
  if (!open || !item) return null;

  const it = item;
  const unit = it.kind === "manga" ? "chapter entries" : "episodes";

  const seriesHref =
    it.slug ? (it.kind === "manga" ? `/manga/${it.slug}` : `/anime/${it.slug}`) : null;

  function retry() {
    cacheRef.current.delete(cacheKey);
    setProgress({ status: "loading" });

    fetchProgress({ userId, id: it.id, kind: it.kind })
      .then(({ current, total }) => {
        cacheRef.current.set(cacheKey, { current, total });
        setProgress({ status: "ready", current, total });
      })
      .catch(() => setProgress({ status: "error" }));
  }

  const showReal = progress.status === "ready";
  const current = showReal ? progress.current : 0;
  const total = showReal ? progress.total : 0;

  // ===== Desktop “exact iPhone screen frame” sizing (no hooks) =====
  const PHONE_W = 390;
  const PHONE_H = 844;

  // breathing room around the device on desktop
  const DESKTOP_MARGIN = 48;

  // scale down to fit viewport
  const availW = Math.max(0, (vp.w || PHONE_W + DESKTOP_MARGIN) - DESKTOP_MARGIN);
  const availH = Math.max(0, (vp.h || PHONE_H + DESKTOP_MARGIN) - DESKTOP_MARGIN);

  const sW = availW / PHONE_W;
  const sH = availH / PHONE_H;

  const scale = Math.min(1, sW, sH);

  const frameStyle: React.CSSProperties = {
    width: PHONE_W,
    height: PHONE_H,
    transform: `scale(${scale})`,
    transformOrigin: "center",
  };

  return (
    <div className="fixed inset-0 z-[1000000]">
      {/* backdrop */}
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* CENTER */}
      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        {/* MOBILE: true fullscreen */}
        <div className="pointer-events-auto relative w-full h-[100dvh] bg-white overflow-hidden sm:hidden">
          <Header progress={progress} retry={retry} onClose={onClose} />
          <div className="h-[calc(100%-52px)] overflow-y-auto">
            <ModalBody
              it={it}
              seriesHref={seriesHref}
              progress={progress}
              retry={retry}
              current={current}
              total={total}
              unit={unit}
              infoOpen={infoOpen}
              setInfoOpen={setInfoOpen}
            />
          </div>
        </div>

        {/* DESKTOP: exact iPhone frame; modal is fullscreen INSIDE the frame */}
        <div className="hidden sm:block pointer-events-auto">
          <div
            style={frameStyle}
            className="relative bg-white overflow-hidden rounded-2xl border border-black shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
            role="dialog"
            aria-modal="true"
          >
            <Header progress={progress} retry={retry} onClose={onClose} />
            <div className="h-[calc(100%-52px)] overflow-y-auto">
              <ModalBody
                it={it}
                seriesHref={seriesHref}
                progress={progress}
                retry={retry}
                current={current}
                total={total}
                unit={unit}
                infoOpen={infoOpen}
                setInfoOpen={setInfoOpen}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Header({
  progress,
  retry,
  onClose,
}: {
  progress: ProgressState;
  retry: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-black/10">
      <div className="text-sm font-semibold text-slate-900">Progress</div>

      <div className="flex items-center gap-2">
        {progress.status === "loading" ? (
          <div className="text-xs text-slate-500">Loading…</div>
        ) : progress.status === "error" ? (
          <button
            type="button"
            className="text-xs font-semibold text-red-600 hover:underline"
            onClick={retry}
          >
            Retry
          </button>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-black bg-white px-2 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-50 active:translate-y-[1px]"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/** Shared body so mobile + desktop are literally identical inside */
function ModalBody({
  it,
  seriesHref,
  progress,
  retry,
  current,
  total,
  unit,
  infoOpen,
  setInfoOpen,
}: {
  it: CompletionDetails;
  seriesHref: string | null;
  progress: ProgressState;
  retry: () => void;
  current: number;
  total: number;
  unit: string;
  infoOpen: boolean;
  setInfoOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  return (
    <>
      <div className="px-4 pt-4">
        <div className="grid grid-cols-[140px_1fr] gap-4">
          {/* poster */}
          <div className="w-full">
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-black bg-slate-200">
              {it.image_url ? (
                seriesHref ? (
                  <Link href={seriesHref} className="absolute inset-0 block" aria-label={`Open ${it.title}`}>
                    <img
                      src={it.image_url}
                      alt={it.title}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-150 hover:scale-[1.02]"
                      draggable={false}
                    />
                    <div className="absolute inset-0 ring-0 ring-black/0 hover:ring-2 hover:ring-black/20" />
                  </Link>
                ) : (
                  <img
                    src={it.image_url}
                    alt={it.title}
                    className="absolute inset-0 h-full w-full object-cover"
                    draggable={false}
                  />
                )
              ) : null}
            </div>
          </div>

          {/* right */}
          <div className="min-w-0 flex flex-col justify-between gap-3">
            <div>
              <div className="text-base font-bold text-slate-900 leading-tight line-clamp-3">
                {it.title}
              </div>

              {progress.status === "loading" ? (
                <div className="mt-1 text-xs text-slate-500">Loading progress…</div>
              ) : progress.status === "error" ? (
                <div className="mt-1 text-xs text-red-600">
                  Couldn’t load progress.{" "}
                  <button type="button" className="font-semibold hover:underline" onClick={retry}>
                    Retry
                  </button>
                </div>
              ) : null}
            </div>

            <div
              className="relative w-[150px] h-[150px]"
              onMouseEnter={() => setInfoOpen(true)}
              onMouseLeave={() => setInfoOpen(false)}
            >
              {progress.status === "loading" ? (
                <div className="h-[150px] w-[150px] rounded-full border border-black/20 bg-slate-100 animate-pulse" />
              ) : progress.status === "error" ? (
                <div className="text-sm text-slate-600">—</div>
              ) : (
                <>
                  <ProgressRing
                    current={current}
                    total={total}
                    size={150}
                    stroke={22}
                    segmentCap={120}
                    kind={it.kind}
                    slug={it.slug}
                  />

                  <button
                    type="button"
                    aria-label="Progress details"
                    className="absolute left-1/2 top-1/2 h-[84px] w-[84px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent"
                    onClick={(e) => {
                      e.stopPropagation();
                      setInfoOpen((v) => !v);
                    }}
                  />

                  {infoOpen ? (
                    <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-2 z-10">
                      <div className="rounded-lg border border-black/20 bg-white px-3 py-2 text-[11px] text-slate-700 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
                        <div className="font-semibold text-slate-900">
                          {current} / {total} {unit}
                        </div>
                        {it.kind === "manga" ? (
                          <div className="mt-0.5 text-slate-500">
                            Includes bonus/fractional chapters (e.g., 4.1, 4.2).
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="h-6" />
    </>
  );
}
