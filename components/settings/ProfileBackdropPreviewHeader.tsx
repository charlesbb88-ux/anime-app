"use client";

import React from "react";

type Base = {
  baseW: number;
  baseH: number;
};

type Applied = {
  url: string;
  x: number; // 0..100
  y: number; // 0..100
  zoom: number; // 1..3
};

type Props = {
  previewBackdropRef: React.RefObject<HTMLDivElement | null>;

  pickedUrl: string | null;
  imgSize: { w: number; h: number } | null;
  previewBase: Base | null;
  previewPanPx: { x: number; y: number };
  zoom: number;

  avatarUrl: string | null;
  username: string;
  avatarInitial: string;

  previewBackdropH: number;
  overlaySrc: string;

  applied: Applied | null; // (kept for compatibility, unused now)
};

export default function ProfileBackdropPreviewHeader({
  previewBackdropRef,
  pickedUrl,
  imgSize,
  previewBase,
  previewPanPx,
  zoom,
  avatarUrl,
  username,
  avatarInitial,
  previewBackdropH,
  overlaySrc,
}: Props) {
  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 bg-[#dfe4e9]">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-[#dfe4e9]">
        <div className="relative">
          <div
            ref={previewBackdropRef}
            className="relative w-full overflow-hidden bg-black"
            style={{ height: previewBackdropH }}
          >
            {pickedUrl && imgSize && previewBase ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pickedUrl}
                  alt=""
                  draggable={false}
                  className="absolute left-1/2 top-1/2"
                  style={{
                    width: `${previewBase.baseW}px`,
                    height: `${previewBase.baseH}px`,
                    transform: `translate(-50%, -50%) translate(${previewPanPx.x}px, ${previewPanPx.y}px) scale(${zoom})`,
                    transformOrigin: "center",
                    objectFit: "cover",
                    willChange: "transform",
                  }}
                />
              </>
            ) : (
              <div className="absolute inset-0 bg-black" />
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={overlaySrc}
              alt=""
              className="pointer-events-none absolute -top-6 left-0 h-[calc(100%+1.5rem)] w-full object-cover"
            />
          </div>

          <div className="relative px-3 pb-3">
            <div className="-mt-15 flex items-center gap-2">
              <div className="w-13 h-13 rounded-full bg-slate-200 overflow-hidden shrink-0 ring-2 ring-black">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-slate-700">{avatarInitial}</span>
                  </div>
                )}
              </div>

              <div className="text-base font-bold text-slate-900">@{username}</div>
            </div>

            <div className="mt-3 border-b border-slate-200 text-[11px] font-medium text-slate-500">
              <div className="flex gap-5">
                <span className="pb-2 border-b-2 border-slate-900 text-slate-900">Posts</span>
                <span className="pb-2">Bookmarks</span>
                <span className="pb-2">Watchlist</span>
              </div>
            </div>
          </div>
        </div>

        {/* ✅ removed the “Click Apply…” / “This is what…” message block */}
      </div>

      {/* ✅ removed the duplicate message block too */}
    </div>
  );
}