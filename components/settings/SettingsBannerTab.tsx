// components/settings/SettingsBannerTab.tsx
"use client";

import React, { useMemo } from "react";
import { useBackdropEditor } from "@/components/settings/useBackdropEditor";
import BackdropPositionEditor from "@/components/settings/BackdropPositionEditor";
import ProfileBackdropPreviewHeader from "@/components/settings/ProfileBackdropPreviewHeader";

type Props = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  isActive: boolean;
};

const EDITOR_H = 500;
const PREVIEW_BACKDROP_H = 150;
const PREVIEW_HIDDEN_BOTTOM_PX = 40;

export default function SettingsBannerTab({ userId, username, avatarUrl, isActive }: Props) {
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
    saving,
    err,
    saveOk,

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
    saveBackdropToDb,
  } = useBackdropEditor({
    isActive,
    userId,
    previewBackdropH: PREVIEW_BACKDROP_H,
    previewHiddenBottomPx: PREVIEW_HIDDEN_BOTTOM_PX,
    defaultZoom: 1,
    bucket: "backdrops",
    closeOnSave: false,
  });

  return (
    <div className="max-w-5xl space-y-4">
      <div className="bg-white rounded-xs border-2 border-black p-5">
        {err ? <div className="mb-3 text-xs text-red-600">{err}</div> : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* LEFT */}
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

            {/* buttons row */}
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
                className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold
             rounded-sm bg-blue-500 text-white hover:bg-blue-600"
              >
                Upload image
              </button>

              {/* push the right-side group to the far right */}
              <div className="ml-auto flex items-center gap-2">
                {/* ✅ Saved indicator placed right next to Save */}
                {saveOk ? (
                  <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-sm px-3 py-1">
                    Saved
                  </div>
                ) : null}

                <button
                  type="button"
                  disabled={!pickedUrl || saving || !imgSize}
                  onClick={saveBackdropToDb}
                  className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-sm bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save banner"}
                </button>
              </div>
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
          </div>

          {/* RIGHT */}
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
            />
          </div>
        </div>
      </div>
    </div>
  );
}