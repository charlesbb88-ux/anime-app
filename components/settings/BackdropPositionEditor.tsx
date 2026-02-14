"use client";

import React from "react";

type Rect = { left: number; top: number; w: number; h: number };

type Base = {
  baseW: number;
  baseH: number;
};

type Props = {
  editorRef: React.RefObject<HTMLDivElement | null>;

  pickedUrl: string | null;
  imgSize: { w: number; h: number } | null;
  editorBase: Base | null;

  panPx: { x: number; y: number };
  zoom: number;

  outer: Rect;
  inner: Rect;

  beginDrag: React.PointerEventHandler<HTMLDivElement>;
  moveDrag: React.PointerEventHandler<HTMLDivElement>;
  endDrag: React.PointerEventHandler<HTMLDivElement>;

  editorH: number;
};

export default function BackdropPositionEditor({
  editorRef,
  pickedUrl,
  imgSize,
  editorBase,
  panPx,
  zoom,
  outer,
  inner,
  beginDrag,
  moveDrag,
  endDrag,
  editorH,
}: Props) {
  return (
    <div
      ref={editorRef}
      className="relative w-full rounded-xl overflow-hidden border border-slate-200 bg-black touch-none select-none"
      style={{ height: editorH }}
      onPointerDown={beginDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={() => endDrag({} as any)}
      onPointerLeave={() => endDrag({} as any)}
    >
      {pickedUrl && imgSize && editorBase ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pickedUrl}
            alt="Backdrop editor"
            draggable={false}
            className="absolute left-1/2 top-1/2"
            style={{
              width: `${editorBase.baseW}px`,
              height: `${editorBase.baseH}px`,
              transform: `translate(-50%, -50%) translate(${panPx.x}px, ${panPx.y}px) scale(${zoom})`,
              transformOrigin: "center",
              objectFit: "cover",
              willChange: "transform",
              cursor: "grab",
            }}
          />

          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-0 right-0 bg-black/55" style={{ top: 0, height: outer.top }} />
            {/* bottom shade (aligned to INNER box) */}
            <div
              className="absolute left-0 right-0 bg-black/55"
              style={{ top: inner.top + inner.h, bottom: 0 }}
            />
            <div className="absolute bg-black/55" style={{ left: 0, top: outer.top, width: outer.left, height: outer.h }} />
            <div
              className="absolute bg-black/55"
              style={{ left: outer.left + outer.w, top: outer.top, right: 0, height: outer.h }}
            />

            {/* OUTER BORDER (top + right only) */}
            <div
              className="absolute border-t-2 border-r-2 border-blue-500/70"
              style={{
                left: outer.left,
                top: outer.top,
                width: outer.w,
                height: outer.h,
              }}
            />

            {/* INNER BORDER (top + right + bottom, no left) */}
            <div
              className="absolute border-t-2 border-r-2 border-b-2 border-blue-500"
              style={{
                left: inner.left,
                top: inner.top,
                width: inner.w,
                height: inner.h,
              }}
            />
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-sm font-semibold text-white">No image selected</div>
            <div className="mt-1 text-xs text-white/70">Upload an image to start.</div>
          </div>
        </div>
      )}
    </div>
  );
}