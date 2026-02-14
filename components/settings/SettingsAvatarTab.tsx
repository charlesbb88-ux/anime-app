"use client";

import React from "react";
import type { ProfileRow } from "@/lib/hooks/useMyProfile";

import { checkerboardStyle } from "@/components/settings/avatar/avatarStyles";
import { useAvatarEditor } from "@/components/settings/avatar/useAvatarEditor";
import AvatarCropWorkspace from "@/components/settings/avatar/AvatarCropWorkspace";
import AvatarEmptyState from "@/components/settings/avatar/AvatarEmptyState";
import AvatarToolbar from "@/components/settings/avatar/AvatarToolbar";

type Props = {
  profile: ProfileRow;
  onUpdated: (next: ProfileRow) => void;
};

export default function SettingsAvatarTab({ profile, onUpdated }: Props) {
  const inputId = "avatar-upload";

  const {
    error,
    saving,

    avatarInitial,
    baseAvatarImage,

    crop,
    setCrop,
    zoom,
    setZoom,
    onCropComplete,

    croppedPreview,

    onFileSelected,
    onRemove,
    saveAvatar,
  } = useAvatarEditor({ profile, onUpdated });

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      <h2 className="text-base font-semibold">Avatar</h2>

      <div className="rounded-md overflow-hidden border border-slate-200 bg-white">
        {baseAvatarImage ? (
          <AvatarCropWorkspace
            checkerboardStyle={checkerboardStyle}
            image={baseAvatarImage}
            crop={crop}
            zoom={zoom}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            croppedPreview={croppedPreview}
            avatarInitial={avatarInitial}
            username={profile.username}
          />
        ) : (
          <AvatarEmptyState
            checkerboardStyle={checkerboardStyle}
            inputId={inputId}
            avatarInitial={avatarInitial}
          />
        )}

        {/* Toolbar bottom */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              onFileSelected(file);
            }}
          />

          <AvatarToolbar
            inputId={inputId}
            hasImage={!!baseAvatarImage}
            zoom={zoom}
            onZoomChange={setZoom}
            saving={saving}
            onSave={saveAvatar}
            onRemove={onRemove}
          />
        </div>
      </div>

      <p className="mt-3 text-[11px] text-slate-500 text-center max-w-3xl">
        Avatars should be JPEG or PNG. Larger images will be resized. The
        checkerboard area shows the whole image; the circle shows what will be
        kept as your avatar.
      </p>
    </div>
  );
}