"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  open: boolean;
  onClose: () => void;

  userId: string;

  username: string;
  avatarUrl: string | null;

  onSaved?: (args: {
    backdrop_url: string;
    backdrop_pos_x: number; // 0..100
    backdrop_pos_y: number; // 0..100
    backdrop_zoom: number; // 1..3
  }) => void;
};

type Applied = {
  url: string;
  x: number; // 0..100
  y: number; // 0..100
  zoom: number; // 1..3
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

const DEFAULT_X = 50;
const DEFAULT_Y = 50;
const DEFAULT_ZOOM = 1;

const EDITOR_H = 500;

// must match preview JSX height
const PREVIEW_BACKDROP_H = 150;

/**
 * ✅ How much of the BACKDROP is effectively "hidden" by your overlay at the bottom.
 * This does NOT change the real backdrop window — it only affects:
 * 1) how far UP we allow dragging (extra space at bottom)
 * 2) the INNER visible guidance box
 *
 * Tune this until the INNER box matches what the user can really see on the actual page.
 */
const PREVIEW_HIDDEN_BOTTOM_PX = 40;

export default function ProfileBackdropModal({
  open,
  onClose,
  userId,
  username,
  avatarUrl,
  onSaved,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const previewBackdropRef = useRef<HTMLDivElement | null>(null);

  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [pickedUrl, setPickedUrl] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  // measured container sizes
  const [editorBox, setEditorBox] = useState<{ w: number; h: number }>({ w: 1, h: 1 });
  const [previewBackdropBox, setPreviewBackdropBox] = useState<{ w: number; h: number }>({ w: 1, h: 1 });

  // pan in editor pixels (image translation)
  const [panPx, setPanPx] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  const [applied, setApplied] = useState<Applied | null>(null);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  // object URL
  useEffect(() => {
    if (!pickedFile) {
      setPickedUrl(null);
      return;
    }
    const url = URL.createObjectURL(pickedFile);
    setPickedUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pickedFile]);

  // natural size
  useEffect(() => {
    if (!pickedUrl) {
      setImgSize(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const w = (img as any).naturalWidth || img.width;
      const h = (img as any).naturalHeight || img.height;
      if (w && h) setImgSize({ w, h });
    };
    img.src = pickedUrl;
  }, [pickedUrl]);

  // ResizeObserver for editor + preview backdrop
  useLayoutEffect(() => {
    if (!open) return;

    const editorEl = editorRef.current;
    const pvEl = previewBackdropRef.current;

    const ro = new ResizeObserver(() => {
      if (editorEl) {
        const r = editorEl.getBoundingClientRect();
        setEditorBox({ w: Math.max(1, r.width), h: Math.max(1, r.height) });
      }
      if (pvEl) {
        const r = pvEl.getBoundingClientRect();
        setPreviewBackdropBox({ w: Math.max(1, r.width), h: Math.max(1, r.height) });
      }
    });

    if (editorEl) ro.observe(editorEl);
    if (pvEl) ro.observe(pvEl);

    // initial measure
    if (editorEl) {
      const r = editorEl.getBoundingClientRect();
      setEditorBox({ w: Math.max(1, r.width), h: Math.max(1, r.height) });
    }
    if (pvEl) {
      const r = pvEl.getBoundingClientRect();
      setPreviewBackdropBox({ w: Math.max(1, r.width), h: Math.max(1, r.height) });
    }

    return () => ro.disconnect();
  }, [open]);

  // reset on close
  useEffect(() => {
    if (!open) {
      setPickedFile(null);
      setPickedUrl(null);
      setImgSize(null);
      setPanPx({ x: 0, y: 0 });
      setZoom(DEFAULT_ZOOM);
      setApplied(null);
      setSaving(false);
      setErr(null);
      dragRef.current = null;
    }
  }, [open]);

  // escape closes
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const avatarInitial = useMemo(() => {
    const u = username?.trim();
    return u && u.length > 0 ? u.charAt(0).toUpperCase() : "?";
  }, [username]);

  /**
   * OUTER reference box (real backdrop window):
   * - matches preview backdrop size (150px tall) scaled into the editor
   * - this is the "hidden / reference" box you wanted
   */
  const outer = useMemo(() => {
    const pvW = Math.max(1, previewBackdropBox.w);
    const pvH = PREVIEW_BACKDROP_H;

    const ew = Math.max(1, editorBox.w);
    const eh = Math.max(1, editorBox.h);

    const s = Math.min(ew / pvW, eh / pvH);

    const w = Math.round(pvW * s);
    const h = Math.round(pvH * s);

    const left = Math.round((ew - w) / 2);
    const top = Math.round((eh - h) / 2);

    return { pvW, pvH, s, w, h, left, top };
  }, [editorBox.w, editorBox.h, previewBackdropBox.w]);

  /**
   * INNER visible guidance box:
   * - same left/right/top as OUTER
   * - bottom raised by overlay-hidden amount
   */
  const inner = useMemo(() => {
    const hiddenPreviewPx = clamp(PREVIEW_HIDDEN_BOTTOM_PX, 0, PREVIEW_BACKDROP_H - 1);
    const hiddenEditorPx = Math.round(hiddenPreviewPx * (outer.s || 1));
    return {
      left: outer.left,
      top: outer.top,
      w: outer.w,
      h: Math.max(1, outer.h - hiddenEditorPx),
      hiddenPreviewPx,
      hiddenEditorPx,
    };
  }, [outer]);

  function computeCoverBase(args: { cw: number; ch: number; iw: number; ih: number }) {
    const { cw, ch, iw, ih } = args;
    const coverScale = Math.max(cw / iw, ch / ih);
    return { baseW: iw * coverScale, baseH: ih * coverScale };
  }

  function computePanLimits(args: { cw: number; ch: number; iw: number; ih: number; z: number }) {
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
   * ✅ Clamp using OUTER for left/right/top, but extend ONLY the BOTTOM limit:
   * allow extra upward movement so you can "pull the image up"
   * and reveal blank space at the bottom (which the overlay hides on the real page).
   */
  function clampPan(next: { x: number; y: number }, zOverride?: number) {
    if (!imgSize) return next;

    const z = zOverride ?? zoom;

    const { maxPanX, maxPanY, rangeX, rangeY } = computePanLimits({
      cw: outer.w,
      ch: outer.h,
      iw: imgSize.w,
      ih: imgSize.h,
      z,
    });

    const extraUp = inner.hiddenEditorPx;

    const minY = rangeY <= 0 ? 0 : -maxPanY - extraUp; // ✅ extend upward only
    const maxY = rangeY <= 0 ? 0 : +maxPanY; // ✅ unchanged

    return {
      x: rangeX <= 0 ? 0 : clamp(next.x, -maxPanX, maxPanX),
      y: rangeY <= 0 ? 0 : clamp(next.y, minY, maxY),
    };
  }

  // keep pan valid when things change
  useEffect(() => {
    if (!open) return;
    setPanPx((p) => clampPan(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, outer.w, outer.h, inner.hiddenEditorPx, imgSize?.w, imgSize?.h, zoom]);

  function beginDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!pickedUrl || !imgSize) return;
    setErr(null);

    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPanX: panPx.x,
      startPanY: panPx.y,
    };

    (e.currentTarget as any).setPointerCapture?.(e.pointerId);
  }

  function moveDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    if (dragRef.current.pointerId !== e.pointerId) return;

    const dx = e.clientX - dragRef.current.startClientX;
    const dy = e.clientY - dragRef.current.startClientY;

    setPanPx(
      clampPan({
        x: dragRef.current.startPanX + dx,
        y: dragRef.current.startPanY + dy,
      })
    );
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    if (dragRef.current.pointerId !== e.pointerId) return;
    dragRef.current = null;
  }

  /**
   * ✅ PREVIEW MUST MIMIC THE EDITOR EXACTLY.
   * We do that by rendering the preview using the SAME transform math
   * (an <img> with translate + scale),
   * NOT CSS background-position.
   *
   * Convert editor pan (in editor pixels) -> preview pan (in preview pixels).
   */
  const previewPanPx = useMemo(() => {
    const s = outer.s || 1;
    return { x: panPx.x / s, y: panPx.y / s };
  }, [panPx.x, panPx.y, outer.s]);

  /**
   * Preview image base size (cover @ zoom=1) for the real preview window (150px tall)
   */
  const previewBase = useMemo(() => {
    if (!imgSize) return null;
    const { baseW, baseH } = computePanLimits({
      cw: outer.pvW,
      ch: PREVIEW_BACKDROP_H,
      iw: imgSize.w,
      ih: imgSize.h,
      z: 1,
    });
    return { baseW, baseH };
  }, [imgSize?.w, imgSize?.h, outer.pvW]);

  /**
   * Editor image base size (cover @ zoom=1) for OUTER reference window
   */
  const editorBase = useMemo(() => {
    if (!imgSize) return null;
    const { baseW, baseH } = computePanLimits({
      cw: outer.w,
      ch: outer.h,
      iw: imgSize.w,
      ih: imgSize.h,
      z: 1,
    });
    return { baseW, baseH };
  }, [imgSize?.w, imgSize?.h, outer.w, outer.h]);

  /**
   * ✅ DB % computed from the REAL preview window behavior (full 150px window).
   * Overlay does not change backdrop_pos_y — it only hides part of the result.
   * Since we allow extra upward pan, yPct will naturally increase and show more lower content.
   */
  function panToPctForDbFullWindow() {
    if (!imgSize) return { xPct: DEFAULT_X, yPct: DEFAULT_Y };

    const { maxPanX, maxPanY, rangeX, rangeY } = computePanLimits({
      cw: outer.pvW,
      ch: PREVIEW_BACKDROP_H,
      iw: imgSize.w,
      ih: imgSize.h,
      z: zoom,
    });

    const xPct =
      rangeX <= 0 ? DEFAULT_X : clamp(((-previewPanPx.x + maxPanX) / (2 * maxPanX)) * 100, 0, 100);

    const yPct =
      rangeY <= 0 ? DEFAULT_Y : clamp(((-previewPanPx.y + maxPanY) / (2 * maxPanY)) * 100, 0, 100);

    return { xPct, yPct };
  }

  async function saveBackdropToDb() {
    setErr(null);

    if (!pickedFile) return setErr("Upload an image first.");
    if (!userId) return setErr("Missing user id.");

    setSaving(true);

    try {
      const rawExt = (pickedFile.name.split(".").pop() || "jpg").toLowerCase();
      const ext = ["jpg", "jpeg", "png", "webp"].includes(rawExt) ? rawExt : "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;
      const BUCKET = "backdrops";

      const { data: uploadData, error: uploadError } = await supabase.storage.from(BUCKET).upload(path, pickedFile, {
        upsert: true,
        contentType: pickedFile.type || undefined,
      });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(uploadData.path);
      const publicUrl = publicData.publicUrl;

      const { xPct, yPct } = panToPctForDbFullWindow();

      const updates = {
        backdrop_url: publicUrl,
        backdrop_pos_x: xPct,
        backdrop_pos_y: yPct,
        backdrop_zoom: clamp(zoom, 1, 3),
      };

      const { error: dbErr } = await supabase.from("profiles").update(updates).eq("id", userId);
      if (dbErr) throw dbErr;

      onSaved?.(updates);
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Failed to save backdrop.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      <button type="button" aria-label="Close modal" onClick={onClose} className="absolute inset-0 bg-black/60" />

      <div className="absolute left-1/2 top-1/2 w-[min(980px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Edit backdrop</div>
            <div className="text-[11px] text-slate-500">
              Outer box = full backdrop window (reference). Inner box = what’s visible after your overlay.
            </div>
          </div>

          <button type="button" onClick={onClose} className="text-xs text-slate-500 hover:text-slate-800">
            Close
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {err ? <div className="mb-3 text-xs text-red-600">{err}</div> : null}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* LEFT: editor */}
            <div className="md:col-span-2">
              <div className="text-xs font-semibold text-slate-900 mb-2">Position image</div>

              <div
                ref={editorRef}
                className="relative w-full rounded-xl overflow-hidden border border-slate-200 bg-black touch-none select-none"
                style={{ height: EDITOR_H }}
                onPointerDown={beginDrag}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={() => (dragRef.current = null)}
                onPointerLeave={() => (dragRef.current = null)}
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
                        cursor: dragRef.current ? "grabbing" : "grab",
                      }}
                    />

                    {/* Dimming outside OUTER + boxes */}
                    <div className="absolute inset-0 pointer-events-none">
                      {/* dim outside OUTER */}
                      <div className="absolute left-0 right-0 bg-black/55" style={{ top: 0, height: outer.top }} />
                      <div className="absolute left-0 right-0 bg-black/55" style={{ top: outer.top + outer.h, bottom: 0 }} />
                      <div className="absolute bg-black/55" style={{ left: 0, top: outer.top, width: outer.left, height: outer.h }} />
                      <div
                        className="absolute bg-black/55"
                        style={{ left: outer.left + outer.w, top: outer.top, right: 0, height: outer.h }}
                      />

                      {/* OUTER reference box */}
                      <div
                        className="absolute border-2 border-blue-500/70"
                        style={{ left: outer.left, top: outer.top, width: outer.w, height: outer.h }}
                      />

                      {/* INNER visible box */}
                      <div
                        className="absolute border-2 border-blue-500"
                        style={{ left: inner.left, top: inner.top, width: inner.w, height: inner.h }}
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

              <div className="mt-3 flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setPickedFile(f);
                    setApplied(null);
                    setPanPx({ x: 0, y: 0 });
                    setZoom(DEFAULT_ZOOM);
                    setErr(null);
                  }}
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-full bg-slate-900 text-white hover:bg-slate-800"
                >
                  Upload image
                </button>

                <button
                  type="button"
                  disabled={!pickedUrl || !imgSize}
                  onClick={() => {
                    if (!pickedUrl || !imgSize) return;
                    const { xPct, yPct } = panToPctForDbFullWindow();
                    setApplied({ url: pickedUrl, x: xPct, y: yPct, zoom: clamp(zoom, 1, 3) });
                    setErr(null);
                  }}
                  className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-full border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
                >
                  Apply
                </button>

                <button
                  type="button"
                  disabled={!pickedUrl || saving || !imgSize}
                  onClick={saveBackdropToDb}
                  className="ml-auto inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-full bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save backdrop"}
                </button>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <div className="text-xs text-slate-500">Zoom</div>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => {
                    const nextZoom = parseFloat(e.target.value);
                    setZoom(nextZoom);
                    setPanPx((p) => clampPan(p, nextZoom));
                  }}
                  className="w-56"
                  disabled={!pickedUrl}
                />
                <div className="text-xs text-slate-500 tabular-nums">{zoom.toFixed(2)}x</div>
              </div>

              <div className="mt-2 text-[11px] text-slate-500">
                If the inner box doesn’t match what your overlay hides, change{" "}
                <span className="font-semibold">PREVIEW_HIDDEN_BOTTOM_PX</span>.
              </div>
            </div>

            {/* RIGHT: preview */}
            <div className="md:col-span-1">
              <div className="text-xs font-semibold text-slate-900 mb-2">Preview</div>

              <div className="rounded-xl overflow-hidden border border-slate-200 bg-white">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="relative">
                    {/* Backdrop area (measured) */}
                    <div
                      ref={previewBackdropRef}
                      className="relative w-full overflow-hidden bg-black"
                      style={{ height: PREVIEW_BACKDROP_H }}
                    >
                      {pickedUrl && imgSize && previewBase ? (
                        <>
                          {/* ✅ EXACT SAME BEHAVIOR AS EDITOR: img + transform */}
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

                      {/* Overlay (match real page) */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/overlays/my-overlay4.png"
                        alt=""
                        className="pointer-events-none absolute -top-6 left-0 h-[calc(100%+1.5rem)] w-full object-cover"
                      />
                    </div>

                    {/* Foreground overlap row */}
                    <div className="relative px-4 pb-3">
                      <div className="-mt-8 flex items-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-slate-200 overflow-hidden shrink-0 ring-2 ring-black">
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

                  <div className="p-3">
                    <div className="text-[11px] text-slate-500">
                      {applied ? (
                        <>This is what your header will look like.</>
                      ) : (
                        <>
                          Click <span className="font-semibold">Apply</span> to lock the preview.
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-3">
                  <div className="text-[11px] text-slate-500">
                    {applied ? (
                      <>This is what your header will look like.</>
                    ) : (
                      <>
                        Click <span className="font-semibold">Apply</span> to lock the preview.
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 text-[11px] text-slate-500">
                If Save fails, it’s usually the storage bucket name or permissions.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-full border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
