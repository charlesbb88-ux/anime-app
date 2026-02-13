// components/settings/useBackdropEditor.ts
"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { clampPan, computePanLimits, panToPctForDbFullWindow, clamp } from "@/lib/settings/backdropMath";

type Applied = {
  url: string;
  x: number; // 0..100
  y: number; // 0..100
  zoom: number; // 1..3
};

type UseBackdropEditorArgs = {
  open: boolean;
  onClose: () => void;

  userId: string;

  // preview sizes + overlay behavior
  previewBackdropH: number; // e.g. 150
  previewHiddenBottomPx: number; // e.g. 40 (in preview px, not editor px)

  // defaults
  defaultX?: number; // default 50
  defaultY?: number; // default 50
  defaultZoom?: number; // default 1

  // storage
  bucket?: string; // default "backdrops"

  onSaved?: (args: {
    backdrop_url: string;
    backdrop_pos_x: number;
    backdrop_pos_y: number;
    backdrop_zoom: number;
  }) => void;
};

export function useBackdropEditor({
  open,
  onClose,
  userId,
  previewBackdropH,
  previewHiddenBottomPx,
  defaultX = 50,
  defaultY = 50,
  defaultZoom = 1,
  bucket = "backdrops",
  onSaved,
}: UseBackdropEditorArgs) {
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
  const [zoom, setZoom] = useState(defaultZoom);

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

  // ---------------------------
  // FILE -> OBJECT URL
  // ---------------------------
  useEffect(() => {
    if (!pickedFile) {
      setPickedUrl(null);
      return;
    }
    const url = URL.createObjectURL(pickedFile);
    setPickedUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pickedFile]);

  // ---------------------------
  // NATURAL IMAGE SIZE
  // ---------------------------
  useEffect(() => {
    if (!pickedUrl) {
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
    img.src = pickedUrl;

    return () => {
      cancelled = true;
    };
  }, [pickedUrl]);

  // ---------------------------
  // RESIZE OBSERVER
  // ---------------------------
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

  // ---------------------------
  // RESET ON CLOSE
  // ---------------------------
  useEffect(() => {
    if (!open) {
      setPickedFile(null);
      setPickedUrl(null);
      setImgSize(null);
      setPanPx({ x: 0, y: 0 });
      setZoom(defaultZoom);
      setApplied(null);
      setSaving(false);
      setErr(null);
      dragRef.current = null;
    }
  }, [open, defaultZoom]);

  // ---------------------------
  // ESC CLOSE
  // ---------------------------
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // ---------------------------
  // OUTER + INNER BOXES
  // ---------------------------
  const outer = useMemo(() => {
    // preview window is previewBackdropBox.w x previewBackdropH
    const pvW = Math.max(1, previewBackdropBox.w);
    const pvH = previewBackdropH;

    const ew = Math.max(1, editorBox.w);
    const eh = Math.max(1, editorBox.h);

    const s = Math.min(ew / pvW, eh / pvH);

    const w = Math.round(pvW * s);
    const h = Math.round(pvH * s);

    const left = Math.round((ew - w) / 2);
    const top = Math.round((eh - h) / 2);

    return { pvW, pvH, s, w, h, left, top };
  }, [editorBox.w, editorBox.h, previewBackdropBox.w, previewBackdropH]);

  const inner = useMemo(() => {
    // bottom hidden in preview px -> convert to editor px using outer.s
    const hiddenPreviewPx = clamp(previewHiddenBottomPx, 0, Math.max(0, previewBackdropH - 1));
    const hiddenEditorPx = Math.round(hiddenPreviewPx * (outer.s || 1));

    return {
      left: outer.left,
      top: outer.top,
      w: outer.w,
      h: Math.max(1, outer.h - hiddenEditorPx),
      hiddenPreviewPx,
      hiddenEditorPx,
    };
  }, [outer, previewHiddenBottomPx, previewBackdropH]);

  // ---------------------------
  // CLAMP PAN (uses your backdropMath signature)
  // ---------------------------
  function clampPanLocal(next: { x: number; y: number }, zOverride?: number) {
    if (!imgSize) return next;

    const z = zOverride ?? zoom;

    return clampPan({
      next,
      imgSize,
      zoom: z,
      outer: { w: outer.w, h: outer.h },
      innerHiddenEditorPx: inner.hiddenEditorPx,
    });
  }

  // keep pan valid when things change
  useEffect(() => {
    if (!open) return;
    setPanPx((p) => clampPanLocal(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, outer.w, outer.h, inner.hiddenEditorPx, imgSize?.w, imgSize?.h, zoom]);

  // ---------------------------
  // DRAG HANDLERS
  // ---------------------------
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
      clampPanLocal({
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

  // ---------------------------
  // PREVIEW PAN (editor px -> preview px)
  // ---------------------------
  const previewPanPx = useMemo(() => {
    const s = outer.s || 1;
    return { x: panPx.x / s, y: panPx.y / s };
  }, [panPx.x, panPx.y, outer.s]);

  // ---------------------------
  // IMAGE BASE SIZES (cover @ zoom=1)
  // ---------------------------
  const previewBase = useMemo(() => {
    if (!imgSize) return null;
    const { baseW, baseH } = computePanLimits({
      cw: outer.pvW,
      ch: previewBackdropH,
      iw: imgSize.w,
      ih: imgSize.h,
      z: 1,
    });
    return { baseW, baseH };
  }, [imgSize?.w, imgSize?.h, outer.pvW, previewBackdropH]);

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

  // ---------------------------
  // APPLY (compute DB % and lock preview state)
  // ---------------------------
  function applyNow() {
    if (!imgSize || !pickedUrl) return;

    const { xPct, yPct } = panToPctForDbFullWindow({
      imgSize,
      pvW: outer.pvW,
      pvH: previewBackdropH,
      zoom,
      previewPanPx,
      defaultX,
      defaultY,
    });

    setApplied({
      url: pickedUrl,
      x: xPct,
      y: yPct,
      zoom: clamp(zoom, 1, 3),
    });
    setErr(null);
  }

  // ---------------------------
  // SAVE (upload + update profiles)
  // ---------------------------
  async function saveBackdropToDb() {
    setErr(null);

    if (!pickedFile) return setErr("Upload an image first.");
    if (!userId) return setErr("Missing user id.");
    if (!imgSize) return setErr("Image not ready yet.");

    setSaving(true);

    try {
      const rawExt = (pickedFile.name.split(".").pop() || "jpg").toLowerCase();
      const ext = ["jpg", "jpeg", "png", "webp"].includes(rawExt) ? rawExt : "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage.from(bucket).upload(path, pickedFile, {
        upsert: true,
        contentType: pickedFile.type || undefined,
      });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(uploadData.path);
      const publicUrl = publicData.publicUrl;

      const { xPct, yPct } = panToPctForDbFullWindow({
        imgSize,
        pvW: outer.pvW,
        pvH: previewBackdropH,
        zoom,
        previewPanPx,
        defaultX,
        defaultY,
      });

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

  // ---------------------------
  // FILE PICKER HELPERS
  // ---------------------------
  function pickFile(f: File | null) {
    setPickedFile(f);
    setApplied(null);
    setPanPx({ x: 0, y: 0 });
    setZoom(defaultZoom);
    setErr(null);
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    pickFile(f);
  }

  function openFileDialog() {
    fileInputRef.current?.click();
  }

  // ---------------------------
  // ZOOM CHANGE (keeps pan clamped)
  // ---------------------------
  function setZoomClamped(nextZoom: number) {
    const z = clamp(nextZoom, 1, 3);
    setZoom(z);
    setPanPx((p) => clampPanLocal(p, z));
  }

  return {
    // refs
    fileInputRef,
    editorRef,
    previewBackdropRef,

    // raw state
    pickedFile,
    pickedUrl,
    imgSize,

    editorBox,
    previewBackdropBox,

    panPx,
    zoom,

    applied,
    saving,
    err,

    // computed geometry
    outer,
    inner,
    previewPanPx,
    previewBase,
    editorBase,

    // actions/handlers
    setErr,
    setEditorBox,
    setPreviewBackdropBox,

    pickFile,
    onFileInputChange,
    openFileDialog,

    setZoomClamped,

    beginDrag,
    moveDrag,
    endDrag,

    applyNow,
    saveBackdropToDb,
  };
}