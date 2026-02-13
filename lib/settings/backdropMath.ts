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

export function panToPctForDbFullWindow(args: {
  imgSize: { w: number; h: number };
  pvW: number;
  pvH: number;
  zoom: number;
  previewPanPx: { x: number; y: number };
  defaultX: number;
  defaultY: number;
}) {
  const { imgSize, pvW, pvH, zoom, previewPanPx, defaultX, defaultY } = args;

  const { maxPanX, maxPanY, rangeX, rangeY } = computePanLimits({
    cw: pvW,
    ch: pvH,
    iw: imgSize.w,
    ih: imgSize.h,
    z: zoom,
  });

  const xPct =
    rangeX <= 0 ? defaultX : clamp(((-previewPanPx.x + maxPanX) / (2 * maxPanX)) * 100, 0, 100);

  const yPct =
    rangeY <= 0 ? defaultY : clamp(((-previewPanPx.y + maxPanY) / (2 * maxPanY)) * 100, 0, 100);

  return { xPct, yPct };
}