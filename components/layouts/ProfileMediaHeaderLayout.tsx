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

  /** content rendered directly under the username (e.g. Follow button) */
  belowUsername?: React.ReactNode;

  /** how many pixels at the bottom are “visually hidden” by your overlay fade */
  overlayHiddenBottomPx?: number;

  /** allow tabs to be hidden so the page can render them in the center column */
  hideTabs?: boolean;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

// phone-only breakpoint (iPads/tablets keep desktop behavior)
const PHONE_MAX_WIDTH_PX = 767;

function useIsPhone() {
  const [isPhone, setIsPhone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH_PX}px)`);
    const update = () => setIsPhone(mq.matches);
    update();

    if (typeof (mq as any).addEventListener === "function") {
      (mq as any).addEventListener("change", update);
      return () => (mq as any).removeEventListener("change", update);
    } else {
      mq.addListener(update);
      return () => mq.removeListener(update);
    }
  }, []);

  return isPhone;
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

  belowUsername,

  overlayHiddenBottomPx = 150,

  hideTabs = false,
}: Props) {
  const router = useRouter();
  const isPhone = useIsPhone();

  // phone tuning
  const phoneSidePadPx = 2; // left/right padding for the foreground content

  // ✅ PHONE: avatar + username tuning
  const phoneAvatarPx = 100;        // avatar size (try 56, 64, 72, 80)
  const phoneRowTopPx = 100;       // moves the whole avatar+name block up/down (more negative = higher)
  const phoneRowLeftPx = -100;        // extra left shift (in addition to phoneSidePadPx)

  const phoneNameSizeClass = "text-[30px]"; // username font size on phone
  const phoneNameTopPx = 40;       // move username up/down relative to avatar

  const phoneGapPx = 12;           // space between avatar and username

  const phoneBackdropHeightClassName = "h-[300px]";

  const phoneAvatarRowTopPx = 65;      // ✅ moves ONLY avatar+username (down = bigger number)
  const phoneRightPinnedTopPx = -40;     // ✅ moves ONLY stats/edit block (down = bigger number)

  const phonePanYAdjustPx = -45; // try 20, 30, 40, 60 (positive = show more bottom)

  const phoneLeftInsetPx = 6; // try 0, 4, 6, 8, 10

  const phoneBelowUsernameGapPx = 30; // try 4, 6, 8, 10
  const phoneBelowUsernameReservePx = 44;

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
    return `pb-2 ${isActiveTab
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

  // IMPORTANT:
  // - Desktop: keep existing behavior (uses overlayHiddenBottomPx)
  // - Phone: do NOT hide the bottom with a black mask
  const hideBottomDesktop = Math.max(0, Math.round(overlayHiddenBottomPx ?? 0));
  const hideBottom = isPhone ? 0 : hideBottomDesktop;

  // ------------------------------------------------------------
  // Measure the ACTUAL full backdrop window
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

  // base size at z=1 (cover) - desktop/tablet behavior
  const baseCover = useMemo(() => {
    if (!imgSize) return null;
    const { baseW, baseH } = computePanLimits({
      cw: backdropBox.w,
      ch: backdropBox.h,
      iw: imgSize.w,
      ih: imgSize.h,
      z: 1,
    });
    return { w: baseW, h: baseH };
  }, [imgSize, backdropBox.w, backdropBox.h]);

  // phone-only base size (contain) -> shows maximum left/right with NO side crop
  const baseContain = useMemo(() => {
    if (!imgSize) return null;

    const cw = backdropBox.w;
    const ch = backdropBox.h;

    const s = Math.min(cw / imgSize.w, ch / imgSize.h);

    return {
      w: Math.max(1, Math.round(imgSize.w * s)),
      h: Math.max(1, Math.round(imgSize.h * s)),
    };
  }, [imgSize, backdropBox.w, backdropBox.h]);

  const phoneShouldForceFillWidth = useMemo(() => {
    if (!imgSize) return false;
    const cw = backdropBox.w;
    const ch = backdropBox.h;

    const sx = cw / imgSize.w;
    const sy = ch / imgSize.h;

    // If contain would be width-limited, the image is "too tall/narrow" and will show side gaps.
    // In that case, force cover so it fills the phone width.
    return sx > sy;
  }, [imgSize, backdropBox.w, backdropBox.h]);

  // percent -> pan px (desktop/tablet behavior)
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
    <div
      className={isPhone ? "pt-0 pb-0" : "mx-auto max-w-6xl px-4 pt-0 pb-0"}
      style={
        isPhone
          ? {
            width: "100vw",
            marginLeft: "calc(50% - 50vw)",
            marginRight: "calc(50% - 50vw)",
          }
          : undefined
      }
    >
      {/* Backdrop */}
      <div
        ref={backdropBoxRef}
        className={`relative w-full overflow-hidden ${isPhone ? phoneBackdropHeightClassName : backdropHeightClassName
          } -mt-10`}
      >
        {showBackdropImage && imgSize && baseCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backdropUrl as string}
            alt=""
            draggable={false}
            className="absolute left-1/2 top-1/2"
            style={
              isPhone
                ? {
                  // ✅ Phone: APPLY saved zoom + position (same behavior as PC)
                  width: `${baseCover.w}px`,
                  height: `${baseCover.h}px`,
                  transform: `translate(-50%, -50%) translate(${panPx.x}px, ${panPx.y + phonePanYAdjustPx}px) scale(${zoom})`,
                  transformOrigin: "center",
                  objectFit: "cover",
                  willChange: "transform",
                }
                : {
                  // ✅ Desktop/tablet: COVER + PAN + ZOOM (original behavior)
                  width: `${baseCover.w}px`,
                  height: `${baseCover.h}px`,
                  transform: `translate(-50%, -50%) translate(${panPx.x}px, ${panPx.y}px) scale(${zoom})`,
                  transformOrigin: "center",
                  objectFit: "cover",
                  willChange: "transform",
                }
            }
          />
        ) : (
          <div className="absolute inset-0 bg-black" />
        )}

        {hideBottom > 0 ? (
          <div className="absolute inset-x-0 bottom-0 bg-black" style={{ height: hideBottom }} />
        ) : null}

        {showOverlay ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={overlaySrc as string}
            alt=""
            className={
              isPhone
                ? "pointer-events-none absolute -top-8 left-0 h-[calc(100%+2rem)] w-full object-cover"
                : "pointer-events-none absolute -top-12 left-0 h-[calc(100%+3rem)] w-full object-cover"
            }
          />
        ) : null}
      </div>

      {/* Foreground overlap */}
      <div
        className={`-mt-35 relative z-10 ${isPhone ? "" : "px-3"}`} // ✅ KEEP desktop padding exactly like the original
        style={isPhone ? { paddingLeft: phoneSidePadPx, paddingRight: phoneSidePadPx } : undefined}
      >
        {title ? (
          <h1 className="mb-3 text-4xl font-bold leading-tight text-white drop-shadow">{title}</h1>
        ) : null}

        <div className="relative w-full">
          {rightPinned ? (
            <div
              className={`absolute ${isPhone ? "" : "right-0 top-1"}`}
              style={isPhone ? { right: phoneSidePadPx, top: phoneRightPinnedTopPx } : undefined}
            >
              {rightPinned}
            </div>
          ) : null}

          <div className={`min-w-0 ${rightPinned ? reserveRightClassName : ""}`}>
            {/* Avatar + username */}
            <div
              className={
                isPhone
                  ? "flex items-center"
                  : "flex items-center -mt-50 gap-5 pl-2"
              }
              style={
                isPhone
                  ? {
                    paddingLeft: phoneLeftInsetPx,
                    paddingRight: phoneSidePadPx,
                    marginTop: phoneAvatarRowTopPx, // ✅ phone-only overall vertical position
                    columnGap: phoneGapPx,          // ✅ phone-only spacing between avatar + username
                  }
                  : undefined
              }
            >
              <div
                className={`rounded-full bg-slate-200 overflow-hidden shrink-0 ring-3 ring-black ${isPhone ? "" : "w-34 h-34"
                  }`}
                style={isPhone ? { width: phoneAvatarPx, height: phoneAvatarPx } : undefined}
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-slate-700">{avatarInitial}</span>
                  </div>
                )}
              </div>

              {/* Username + under-username slot */}
              <div className="min-w-0">
                <div
                  className={`${isPhone ? phoneNameSizeClass : "text-4xl"} font-bold text-black`}
                  style={
                    isPhone
                      ? { transform: `translateY(${phoneNameTopPx}px)` } // ✅ phone-only vertical nudge
                      : { marginTop: -12 }
                  }
                >
                  {username}
                </div>
                {/* ✅ PHONE: reserve identical space whether FollowButton exists or not */}
                {isPhone ? (
                  <div
                    style={{
                      marginTop: phoneBelowUsernameGapPx,
                      height: phoneBelowUsernameReservePx,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {belowUsername ?? null}
                  </div>
                ) : belowUsername ? (
                  <div style={{ marginTop: 8 }}>{belowUsername}</div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Tabs row (optional now) */}
          {!hideTabs ? (
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
          ) : null}
        </div>
      </div>
    </div>
  );
}