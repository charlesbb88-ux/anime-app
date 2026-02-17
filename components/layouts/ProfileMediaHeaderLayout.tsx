// components/layouts/ProfileMediaHeaderLayout.tsx
"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { computePanLimits, pctToPanPxForRender } from "@/lib/settings/backdropMath";

type Tab = "posts" | "watchlist" | "activity" | "journal" | "library" | "completions";

type Props = {
  backdropUrl: string | null;

  /** positioning values from DB (0..100, zoom 1..3) */
  backdropPosX?: number | null;
  backdropPosY?: number | null;
  backdropZoom?: number | null;

  /** optional so you can hide it (prevents the stray @username in top-left) */
  title?: string;

  username: string;
  avatarUrl: string | null;

  /** optional; if not provided, we infer from router.asPath */
  activeTab?: Tab;

  overlaySrc?: string | null;
  backdropHeightClassName?: string;

  rightPinned?: React.ReactNode;
  reserveRightClassName?: string;

  /** how many pixels at the bottom are “visually hidden” by your overlay fade */
  overlayHiddenBottomPx?: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export default function ProfileMediaHeaderLayout({
  backdropUrl,
  backdropPosX = 50,
  backdropPosY = 20,
  backdropZoom = 1,
  title,

  username,
  avatarUrl,
  activeTab,

  overlaySrc = "/overlays/my-overlay4.png",
  backdropHeightClassName = "h-[620px]",
  rightPinned,
  reserveRightClassName = "pr-[260px]",

  overlayHiddenBottomPx = 150,
}: Props) {
  const router = useRouter();

  const showBackdropImage = typeof backdropUrl === "string" && backdropUrl.length > 0;
  const showOverlay = typeof overlaySrc === "string" && overlaySrc.length > 0;

  const avatarInitial = useMemo(() => {
    const u = username?.trim();
    return u && u.length > 0 ? u.charAt(0).toUpperCase() : "?";
  }, [username]);

  const baseProfilePath = `/${username}`;

  function isPathActive(path: string) {
    return router.asPath === path || router.asPath.startsWith(`${path}/`);
  }

  function tabClass(isActiveTab: boolean) {
    return `pb-2 ${
      isActiveTab
        ? "border-b-2 border-slate-900 text-slate-900"
        : "text-slate-500 hover:text-slate-800"
    }`;
  }

  const computedActive: Tab = useMemo(() => {
    if (activeTab) return activeTab;
    if (isPathActive(`${baseProfilePath}/completions`)) return "completions";
    if (isPathActive(`${baseProfilePath}/watchlist`)) return "watchlist";
    if (isPathActive(`${baseProfilePath}/activity`)) return "activity";
    if (isPathActive(`${baseProfilePath}/journal`)) return "journal";
    if (isPathActive(`${baseProfilePath}/library`)) return "library";
    return "posts";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, router.asPath, baseProfilePath]);

  // sanitize DB values
  const posX = Number.isFinite(backdropPosX as number) ? (backdropPosX as number) : 50;
  const posY = Number.isFinite(backdropPosY as number) ? (backdropPosY as number) : 20;
  const zoomRaw = Number.isFinite(backdropZoom as number) ? (backdropZoom as number) : 1;
  const zoom = clamp(zoomRaw, 1, 3);

  const hideBottom = Math.max(0, Math.round(overlayHiddenBottomPx ?? 0));

  // ------------------------------------------------------------
  // ✅ Measure the ACTUAL full backdrop window (not the cropped “visible” inner)
  // and use pct<->pan math that includes hidden-bottom extra range.
  // ------------------------------------------------------------
  const backdropBoxRef = useRef<HTMLDivElement | null>(null);
  const [backdropBox, setBackdropBox] = useState<{ w: number; h: number }>({ w: 1, h: 1 });
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = backdropBoxRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setBackdropBox({ w: Math.max(1, r.width), h: Math.max(1, r.height) });
    });

    ro.observe(el);

    const r = el.getBoundingClientRect();
    setBackdropBox({ w: Math.max(1, r.width), h: Math.max(1, r.height) });

    return () => ro.disconnect();
  }, []);

  // natural image size
  useEffect(() => {
    if (!showBackdropImage || !backdropUrl) {
      setImgSize(null);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const w = (img as any).naturalWidth || img.width;
      const h = (img as any).naturalHeight || img.height;
      if (w && h) setImgSize({ w, h });
    };
    img.onerror = () => {
      if (!cancelled) setImgSize(null);
    };
    img.src = backdropUrl;

    return () => {
      cancelled = true;
    };
  }, [showBackdropImage, backdropUrl]);

  // base size at z=1 (cover)
  const base = useMemo(() => {
    if (!imgSize) return null;
    const { baseW, baseH } = computePanLimits({
      cw: backdropBox.w,
      ch: backdropBox.h,
      iw: imgSize.w,
      ih: imgSize.h,
      z: 1,
    });
    return { baseW, baseH };
  }, [imgSize, backdropBox.w, backdropBox.h]);

  // ✅ percent -> pan px (includes hidden-bottom range to prevent "stuck" region)
  const panPx = useMemo(() => {
    if (!imgSize) return { x: 0, y: 0 };

    return pctToPanPxForRender({
      imgSize,
      cw: backdropBox.w,
      ch: backdropBox.h,
      zoom,
      xPct: posX,
      yPct: posY,
      hiddenBottomPx: hideBottom,
    });
  }, [imgSize, backdropBox.w, backdropBox.h, zoom, posX, posY, hideBottom]);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-0 pb-0">
      {/* Backdrop */}
      <div
        ref={backdropBoxRef}
        className={`relative w-full overflow-hidden ${backdropHeightClassName} -mt-10`}
      >
        {showBackdropImage && imgSize && base ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backdropUrl as string}
            alt=""
            draggable={false}
            className="absolute left-1/2 top-1/2"
            style={{
              width: `${base.baseW}px`,
              height: `${base.baseH}px`,
              transform: `translate(-50%, -50%) translate(${panPx.x}px, ${panPx.y}px) scale(${zoom})`,
              transformOrigin: "center",
              objectFit: "cover",
              willChange: "transform",
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-black" />
        )}

        {/* Optional: you can keep this black strip if you want the faded area to never show empty.
            It's not part of the "math" anymore; it's purely visual. */}
        {hideBottom > 0 ? (
          <div className="absolute inset-x-0 bottom-0 bg-black" style={{ height: hideBottom }} />
        ) : null}

        {showOverlay ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={overlaySrc as string}
            alt=""
            className="pointer-events-none absolute -top-12 left-0 h-[calc(100%+3rem)] w-full object-cover"
          />
        ) : null}
      </div>

      {/* Foreground overlap */}
      <div className="-mt-35 relative z-10 px-3">
        {title ? (
          <h1 className="mb-3 text-4xl font-bold leading-tight text-white drop-shadow">{title}</h1>
        ) : null}

        <div className="relative w-full">
          {rightPinned ? <div className="absolute right-0 top-1">{rightPinned}</div> : null}

          <div className={`min-w-0 ${rightPinned ? reserveRightClassName : ""}`}>
            {/* Avatar + username */}
            <div className="-mt-50 flex items-center gap-3 pl-2">
              <div className="w-38 h-38 rounded-full bg-slate-200 overflow-hidden shrink-0 ring-3 ring-black">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-slate-700">{avatarInitial}</span>
                  </div>
                )}
              </div>

              <div className="-mt-5 text-4xl font-bold text-slate-900">{username}</div>
            </div>
          </div>

          {/* Tabs row */}
          <div className="mt-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-end">
              <div />

              <nav
                className="
                  border-b border-slate-200
                  min-w-0
                  overflow-x-auto whitespace-nowrap [-webkit-overflow-scrolling:touch]
                  md:overflow-visible
                "
              >
                <div className="flex gap-8 text-sm font-medium w-max md:w-auto">
                  <Link href={baseProfilePath} className={tabClass(computedActive === "posts")}>
                    Posts
                  </Link>

                  <Link
                    href={`${baseProfilePath}/completions`}
                    className={tabClass(computedActive === "completions")}
                  >
                    Completions
                  </Link>

                  <Link
                    href={`${baseProfilePath}/watchlist`}
                    className={tabClass(computedActive === "watchlist")}
                  >
                    Watchlist
                  </Link>

                  <Link
                    href={`${baseProfilePath}/activity`}
                    className={tabClass(computedActive === "activity")}
                  >
                    Activity
                  </Link>

                  <Link
                    href={`${baseProfilePath}/journal`}
                    className={tabClass(computedActive === "journal")}
                  >
                    Journal
                  </Link>

                  <Link
                    href={`${baseProfilePath}/library`}
                    className={tabClass(computedActive === "library")}
                  >
                    My Library
                  </Link>
                </div>
              </nav>

              <div />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}