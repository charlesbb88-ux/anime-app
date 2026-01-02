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

const EDITOR_H = 320;
const PREVIEW_H = 200;

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
  const previewRef = useRef<HTMLDivElement | null>(null);

  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [pickedUrl, setPickedUrl] = useState<string | null>(null);

  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  // ✅ measured container sizes (do NOT read getBoundingClientRect during render)
  const [editorBox, setEditorBox] = useState<{ w: number; h: number }>({ w: 1, h: 1 });
  const [previewBox, setPreviewBox] = useState<{ w: number; h: number }>({ w: 1, h: 1 });

  // ✅ pan in pixels (centered coordinate system)
  const [panPx, setPanPx] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // zoom
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  // applied
  const [applied, setApplied] = useState<Applied | null>(null);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // drag
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

  // ✅ ResizeObserver for editor + preview
  useLayoutEffect(() => {
    if (!open) return;

    const editorEl = editorRef.current;
    const previewEl = previewRef.current;

    const ro = new ResizeObserver(() => {
      if (editorEl) {
        const r = editorEl.getBoundingClientRect();
        setEditorBox({ w: Math.max(1, r.width), h: Math.max(1, r.height) });
      }
      if (previewEl) {
        const r = previewEl.getBoundingClientRect();
        setPreviewBox({ w: Math.max(1, r.width), h: Math.max(1, r.height) });
      }
    });

    if (editorEl) ro.observe(editorEl);
    if (previewEl) ro.observe(previewEl);

    // initial measure
    if (editorEl) {
      const r = editorEl.getBoundingClientRect();
      setEditorBox({ w: Math.max(1, r.width), h: Math.max(1, r.height) });
    }
    if (previewEl) {
      const r = previewEl.getBoundingClientRect();
      setPreviewBox({ w: Math.max(1, r.width), h: Math.max(1, r.height) });
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
   * ✅ CONTAIN base size (at zoom=1), then zoom is applied via CSS transform scale(z).
   * This removes the "zoom feels like cropping" vibe that comes from constantly rewriting width/height/left/top.
   */
  function computeContainBase(args: { cw: number; ch: number; iw: number; ih: number }) {
    const { cw, ch, iw, ih } = args;
    const containScale = Math.min(cw / iw, ch / ih);
    const baseW = iw * containScale;
    const baseH = ih * containScale;
    return { baseW, baseH };
  }

  function computePanLimits(args: {
    cw: number;
    ch: number;
    iw: number;
    ih: number;
    z: number;
  }) {
    const z = clamp(args.z, 1, 3);
    const { baseW, baseH } = computeContainBase({
      cw: args.cw,
      ch: args.ch,
      iw: args.iw,
      ih: args.ih,
    });

    // scaled render size
    const rw = baseW * z;
    const rh = baseH * z;

    const rangeX = Math.max(0, rw - args.cw);
    const rangeY = Math.max(0, rh - args.ch);

    const maxPanX = rangeX / 2;
    const maxPanY = rangeY / 2;

    return { baseW, baseH, rw, rh, rangeX, rangeY, maxPanX, maxPanY };
  }

  function clampPan(next: { x: number; y: number }, zOverride?: number) {
    if (!imgSize) return next;

    const cw = editorBox.w;
    const ch = editorBox.h;
    const z = zOverride ?? zoom;

    const { maxPanX, maxPanY, rangeX, rangeY } = computePanLimits({
      cw,
      ch,
      iw: imgSize.w,
      ih: imgSize.h,
      z,
    });

    return {
      x: rangeX <= 0 ? 0 : clamp(next.x, -maxPanX, maxPanX),
      y: rangeY <= 0 ? 0 : clamp(next.y, -maxPanY, maxPanY),
    };
  }

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

    const next = {
      x: dragRef.current.startPanX + dx,
      y: dragRef.current.startPanY + dy,
    };

    setPanPx(clampPan(next));
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    if (dragRef.current.pointerId !== e.pointerId) return;
    dragRef.current = null;
  }

  /**
   * Convert current pan (px) into DB-friendly % (0..100)
   * xPct=0 => far left (pan at -maxPanX)
   * xPct=100 => far right (pan at +maxPanX)
   */
  function panToPctForDb() {
    if (!imgSize) return { xPct: DEFAULT_X, yPct: DEFAULT_Y };

    const cw = editorBox.w;
    const ch = editorBox.h;

    const { maxPanX, maxPanY, rangeX, rangeY } = computePanLimits({
      cw,
      ch,
      iw: imgSize.w,
      ih: imgSize.h,
      z: zoom,
    });

    const xPct =
      rangeX <= 0 ? DEFAULT_X : clamp(((panPx.x + maxPanX) / (2 * maxPanX)) * 100, 0, 100);
    const yPct =
      rangeY <= 0 ? DEFAULT_Y : clamp(((panPx.y + maxPanY) / (2 * maxPanY)) * 100, 0, 100);

    return { xPct, yPct };
  }

  async function saveBackdropToDb() {
    setErr(null);

    if (!applied) return setErr("Click Apply first.");
    if (!pickedFile) return setErr("Upload an image first.");
    if (!userId) return setErr("Missing user id.");

    setSaving(true);

    try {
      const rawExt = (pickedFile.name.split(".").pop() || "jpg").toLowerCase();
      const ext = ["jpg", "jpeg", "png", "webp"].includes(rawExt) ? rawExt : "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;
      const BUCKET = "backdrops";

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, pickedFile, {
          upsert: true,
          contentType: pickedFile.type || undefined,
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(uploadData.path);
      const publicUrl = publicData.publicUrl;

      const updates = {
        backdrop_url: publicUrl,
        backdrop_pos_x: applied.x,
        backdrop_pos_y: applied.y,
        backdrop_zoom: applied.zoom,
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

  // editor base sizing
  const editorBase = (() => {
    if (!imgSize) return null;
    const { baseW, baseH, rangeX, rangeY } = computePanLimits({
      cw: editorBox.w,
      ch: editorBox.h,
      iw: imgSize.w,
      ih: imgSize.h,
      z: zoom,
    });
    return { baseW, baseH, rangeX, rangeY };
  })();

  // preview base sizing
  const previewBase = (() => {
    if (!imgSize || !applied?.url) return null;
    const { baseW, baseH, rangeX, rangeY, maxPanX, maxPanY } = computePanLimits({
      cw: previewBox.w,
      ch: previewBox.h,
      iw: imgSize.w,
      ih: imgSize.h,
      z: applied.zoom,
    });
    return { baseW, baseH, rangeX, rangeY, maxPanX, maxPanY };
  })();

  // derived preview pan from stored %
  const previewPan = (() => {
    if (!previewBase || !applied) return { x: 0, y: 0 };

    const panX =
      previewBase.rangeX <= 0 ? 0 : ((applied.x / 100) * 2 - 1) * previewBase.maxPanX;
    const panY =
      previewBase.rangeY <= 0 ? 0 : ((applied.y / 100) * 2 - 1) * previewBase.maxPanY;

    return { x: panX, y: panY };
  })();

  return (
    <div className="fixed inset-0 z-[9999]">
      <button type="button" aria-label="Close modal" onClick={onClose} className="absolute inset-0 bg-black/60" />

      <div className="absolute left-1/2 top-1/2 w-[min(980px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Edit backdrop</div>
            <div className="text-[11px] text-slate-500">
              Drag until an edge hits the container edge. Zoom adds room; it never recenters.
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
                    {/* ✅ image: fixed base size (contain @ zoom=1) + transform scale(zoom) + translate(pan) */}
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
                        objectFit: "contain",
                        willChange: "transform",
                        cursor: dragRef.current ? "grabbing" : "grab",
                      }}
                    />

                    {/* Dim outside selection (blue box full width) */}
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[46%]">
                        <div className="absolute left-0 right-0 top-[-9999px] bottom-full bg-black/55" />
                        <div className="absolute left-0 right-0 top-full bottom-[-9999px] bg-black/55" />
                        <div className="absolute inset-0 border-2 border-blue-500" />
                      </div>
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

                    // reset on new file
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
                  disabled={!pickedUrl}
                  onClick={() => {
                    if (!pickedUrl) return;

                    const { xPct, yPct } = panToPctForDb();
                    setApplied({
                      url: pickedUrl,
                      x: xPct,
                      y: yPct,
                      zoom: clamp(zoom, 1, 3),
                    });
                    setErr(null);
                  }}
                  className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-full border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
                >
                  Apply
                </button>

                <button
                  type="button"
                  disabled={!applied || saving}
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

                    // ✅ CRITICAL FIX:
                    // clamp using nextZoom (NOT the old zoom state), so it never "jumps" or feels like cropping
                    setZoom(nextZoom);
                    setPanPx((p) => clampPan(p, nextZoom));
                  }}
                  className="w-56"
                  disabled={!pickedUrl}
                />
                <div className="text-xs text-slate-500 tabular-nums">{zoom.toFixed(2)}x</div>
              </div>
            </div>

            {/* RIGHT: preview */}
            <div className="md:col-span-1">
              <div className="text-xs font-semibold text-slate-900 mb-2">Preview</div>

              <div className="rounded-xl overflow-hidden border border-slate-200 bg-white">
                <div ref={previewRef} className="relative bg-black overflow-hidden" style={{ height: PREVIEW_H }}>
                  {applied?.url && imgSize && previewBase ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={applied.url}
                      alt="Backdrop preview"
                      draggable={false}
                      className="absolute left-1/2 top-1/2"
                      style={{
                        width: `${previewBase.baseW}px`,
                        height: `${previewBase.baseH}px`,
                        transform: `translate(-50%, -50%) translate(${previewPan.x}px, ${previewPan.y}px) scale(${applied.zoom})`,
                        transformOrigin: "center",
                        objectFit: "contain",
                        willChange: "transform",
                      }}
                    />
                  ) : null}

                  <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black/55" />

                  <div className="absolute left-4 bottom-4 flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-slate-200 overflow-hidden ring-2 ring-black">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-sm font-semibold text-slate-700">{avatarInitial}</span>
                        </div>
                      )}
                    </div>

                    <div className="text-white font-semibold text-sm drop-shadow">@{username}</div>
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
