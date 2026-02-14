// lib/settings/backdropMath.ts
"use client";

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function computeCoverBase(args: { cw: number; ch: number; iw: number; ih: number }) {
  const { cw, ch, iw, ih } = args;
  const coverScale = Math.max(cw / iw, ch / ih);
  return { baseW: iw * coverScale, baseH: ih * coverScale };
}

export function computePanLimits(args: { cw: number; ch: number; iw: number; ih: number; z: number }) {
  const z = clamp(args.z, 1, 3);
  const { baseW, baseH } = computeCoverBase({
    cw: args.cw,
    ch: args.ch,
    iw: args.iw,
    ih: args.ih,
  });

  const rw = baseW * z;
  const rh = baseH * z;

  const rangeX = Math.max(0, rw - args.cw);
  const rangeY = Math.max(0, rh - args.ch);

  return {
    baseW,
    baseH,
    rw,
    rh,
    rangeX,
    rangeY,
    maxPanX: rangeX / 2,
    maxPanY: rangeY / 2,
  };
}

/**
 * Clamp pan given an "outer" viewport and an additional hidden-bottom allowance.
 * This matches your editor behavior: you can pan UP extra to keep content behind the overlay fade.
 */
export function clampPan(args: {
  next: { x: number; y: number };
  imgSize: { w: number; h: number };
  zoom: number;
  outer: { w: number; h: number };
  innerHiddenEditorPx: number;
}) {
  const { next, imgSize, zoom, outer, innerHiddenEditorPx } = args;

  const { maxPanX, maxPanY, rangeX, rangeY } = computePanLimits({
    cw: outer.w,
    ch: outer.h,
    iw: imgSize.w,
    ih: imgSize.h,
    z: zoom,
  });

  const extraUp = innerHiddenEditorPx;

  const minY = rangeY <= 0 ? 0 : -maxPanY - extraUp;
  const maxY = rangeY <= 0 ? 0 : +maxPanY;

  return {
    x: rangeX <= 0 ? 0 : clamp(next.x, -maxPanX, maxPanX),
    y: rangeY <= 0 ? 0 : clamp(next.y, minY, maxY),
  };
}

/**
 * ✅ NEW: Convert pan(px) -> percent(0..100) INCLUDING the hidden-bottom extra-pan range.
 * This prevents the "top chunk" from collapsing into y=100.
 *
 * - For X, it's the normal [-maxPanX .. +maxPanX] range.
 * - For Y, it's [-maxPanY - hiddenBottomPx .. +maxPanY]
 *
 * Convention stays the same:
 * - pct 0   => pan at max (image pushed down: shows more TOP)
 * - pct 100 => pan at min (image pushed up: shows more BOTTOM)
 */
export function panToPctForDbFullWindow(args: {
  imgSize: { w: number; h: number };
  pvW: number;
  pvH: number;
  zoom: number;
  previewPanPx: { x: number; y: number };
  hiddenBottomPx: number;
  defaultX: number;
  defaultY: number;
}) {
  const { imgSize, pvW, pvH, zoom, previewPanPx, hiddenBottomPx, defaultX, defaultY } = args;

  const { maxPanX, maxPanY, rangeX, rangeY } = computePanLimits({
    cw: pvW,
    ch: pvH,
    iw: imgSize.w,
    ih: imgSize.h,
    z: zoom,
  });

  // X range (no extra)
  const minX = rangeX <= 0 ? 0 : -maxPanX;
  const maxX = rangeX <= 0 ? 0 : +maxPanX;

  // Y range (includes extra up)
  const extraUp = Math.max(0, hiddenBottomPx || 0);
  const minY = rangeY <= 0 ? 0 : -maxPanY - extraUp;
  const maxY = rangeY <= 0 ? 0 : +maxPanY;

  const xPct =
    rangeX <= 0
      ? defaultX
      : clamp(((maxX - previewPanPx.x) / (maxX - minX)) * 100, 0, 100);

  const yPct =
    rangeY <= 0
      ? defaultY
      : clamp(((maxY - previewPanPx.y) / (maxY - minY)) * 100, 0, 100);

  return { xPct, yPct };
}

/**
 * ✅ NEW: Convert percent(0..100) -> pan(px) using the SAME ranges as panToPctForDbFullWindow.
 * Use this on the real page so the saved values reproduce 1:1.
 */
export function pctToPanPxForRender(args: {
  imgSize: { w: number; h: number };
  cw: number;
  ch: number;
  zoom: number;
  xPct: number;
  yPct: number;
  hiddenBottomPx: number;
}) {
  const { imgSize, cw, ch, zoom, xPct, yPct, hiddenBottomPx } = args;

  const { maxPanX, maxPanY, rangeX, rangeY } = computePanLimits({
    cw,
    ch,
    iw: imgSize.w,
    ih: imgSize.h,
    z: zoom,
  });

  const minX = rangeX <= 0 ? 0 : -maxPanX;
  const maxX = rangeX <= 0 ? 0 : +maxPanX;

  const extraUp = Math.max(0, hiddenBottomPx || 0);
  const minY = rangeY <= 0 ? 0 : -maxPanY - extraUp;
  const maxY = rangeY <= 0 ? 0 : +maxPanY;

  const xp = clamp(xPct, 0, 100);
  const yp = clamp(yPct, 0, 100);

  const x = rangeX <= 0 ? 0 : maxX - (xp / 100) * (maxX - minX);
  const y = rangeY <= 0 ? 0 : maxY - (yp / 100) * (maxY - minY);

  return { x, y };
}