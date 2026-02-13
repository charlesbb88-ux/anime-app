// components/settings/ProfileBackdropModal.tsx
"use client";

import React, { useMemo } from "react";
import { useBackdropEditor } from "@/components/settings/useBackdropEditor";
import BackdropPositionEditor from "@/components/settings/BackdropPositionEditor";
import ProfileBackdropPreviewHeader from "@/components/settings/ProfileBackdropPreviewHeader";

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

const EDITOR_H = 500;
const PREVIEW_BACKDROP_H = 150;
const PREVIEW_HIDDEN_BOTTOM_PX = 40;

export default function ProfileBackdropModal({
  open,
  onClose,
  userId,
  username,
  avatarUrl,
  onSaved,
}: Props) {
  const avatarInitial = useMemo(() => {
    const u = username?.trim();
    return u && u.length > 0 ? u.charAt(0).toUpperCase() : "?";
  }, [username]);

  const {
    fileInputRef,
    editorRef,
    previewBackdropRef,

    pickedUrl,
    imgSize,
    panPx,
    zoom,
    applied,
    saving,
    err,

    outer,
    inner,
    previewPanPx,
    previewBase,
    editorBase,

    onFileInputChange,
    openFileDialog,
    setZoomClamped,
    beginDrag,
    moveDrag,
    endDrag,
    applyNow,
    saveBackdropToDb,
  } = useBackdropEditor({
    isActive: open,
    onClose,
    closeOnSave: true, // ✅ modal closes on save
    userId,
    previewBackdropH: PREVIEW_BACKDROP_H,
    previewHiddenBottomPx: PREVIEW_HIDDEN_BOTTOM_PX,
    defaultZoom: 1,
    bucket: "backdrops",
    onSaved,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />

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

              <BackdropPositionEditor
                editorRef={editorRef}
                pickedUrl={pickedUrl}
                imgSize={imgSize}
                editorBase={editorBase}
                panPx={panPx}
                zoom={zoom}
                outer={{ left: outer.left, top: outer.top, w: outer.w, h: outer.h }}
                inner={{ left: inner.left, top: inner.top, w: inner.w, h: inner.h }}
                beginDrag={beginDrag}
                moveDrag={moveDrag}
                endDrag={endDrag}
                editorH={EDITOR_H}
              />

              <div className="mt-3 flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  onChange={onFileInputChange}
                />

                <button
                  type="button"
                  onClick={openFileDialog}
                  className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-full bg-slate-900 text-white hover:bg-slate-800"
                >
                  Upload image
                </button>

                <button
                  type="button"
                  disabled={!pickedUrl || !imgSize}
                  onClick={applyNow}
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
                  onChange={(e) => setZoomClamped(parseFloat(e.target.value))}
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

              <ProfileBackdropPreviewHeader
                previewBackdropRef={previewBackdropRef}
                pickedUrl={pickedUrl}
                imgSize={imgSize}
                previewBase={previewBase}
                previewPanPx={previewPanPx}
                zoom={zoom}
                avatarUrl={avatarUrl}
                username={username}
                avatarInitial={avatarInitial}
                previewBackdropH={PREVIEW_BACKDROP_H}
                overlaySrc="/overlays/my-overlay4.png"
                applied={applied}
              />

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