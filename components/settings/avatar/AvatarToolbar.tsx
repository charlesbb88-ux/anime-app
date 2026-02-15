"use client";

import React from "react";

type Props = {
  inputId: string;
  hasImage: boolean;

  // when false, hide/disable edit controls (post-save view-only)
  canEdit: boolean;

  zoom: number;
  onZoomChange: (n: number) => void;

  saving: boolean;
  onSave: () => void;
  onRemove: () => void;
};

export default function AvatarToolbar({
  inputId,
  hasImage,
  canEdit,
  zoom,
  onZoomChange,
  saving,
  onSave,
  onRemove,
}: Props) {
  if (hasImage) {
    return (
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            disabled={!canEdit || saving}
            onChange={(e) => {
              if (!canEdit || saving) return;
              onZoomChange(parseFloat(e.target.value));
            }}
            className="w-40 md:w-64 disabled:opacity-50"
          />
        </div>

        <div className="flex items-center gap-3 md:ml-auto">
          {/* Save */}
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !canEdit}
            className="inline-flex items-center justify-center px-5 py-2 text-xs font-semibold rounded-sm bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save avatar"}
          </button>

          {/* Change image — styled like a button */}
          <label
            htmlFor={inputId}
            className="inline-flex items-center justify-center px-5 py-2 text-xs font-semibold rounded-sm bg-blue-500 text-white hover:bg-blue-600 cursor-pointer"
          >
            Change image
          </label>

          {/* Remove */}
          <button
            type="button"
            onClick={onRemove}
            disabled={saving}
            className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-full text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 items-center">
      <div />

      <label
        htmlFor={inputId}
        className="justify-self-center inline-flex items-center justify-center px-5 py-2 text-xs font-semibold rounded-sm bg-blue-500 text-white hover:bg-blue-600 cursor-pointer"
      >
        Select new avatar
      </label>

      <button
        type="button"
        onClick={onRemove}
        className="justify-self-end inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-full text-red-600 hover:bg-red-50 cursor-pointer"
      >
        Remove
      </button>
    </div>
  );
}