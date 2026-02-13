// components/settings/SettingsAvatarTab.tsx
"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import Cropper, { type Area } from "react-easy-crop";
import type { ProfileRow } from "@/lib/hooks/useMyProfile";
import { getCroppedImageBlob, getCroppedImageDataUrl } from "@/lib/image/crop";
import { updateAvatarUrl, uploadAvatarPng } from "@/lib/settings/profileService";

const checkerboardStyle: CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%)," +
    "linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%)",
  backgroundSize: "12px 12px",
  backgroundPosition: "0 0,6px 6px",
};

type Props = {
  profile: ProfileRow;
  onUpdated: (next: ProfileRow) => void;
};

export default function SettingsAvatarTab({ profile, onUpdated }: Props) {
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);

  const [avatarRemoved, setAvatarRemoved] = useState(false);

  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // file -> object URL
  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  // live cropped preview
  useEffect(() => {
    const run = async () => {
      if (!avatarPreviewUrl || !croppedAreaPixels) {
        setCroppedPreview(null);
        return;
      }
      try {
        const preview = await getCroppedImageDataUrl(
          avatarPreviewUrl,
          croppedAreaPixels
        );
        setCroppedPreview(preview);
      } catch {
        setCroppedPreview(null);
      }
    };
    void run();
  }, [avatarPreviewUrl, croppedAreaPixels]);

  const avatarInitial = useMemo(() => {
    const u = profile.username?.trim();
    return u && u.length > 0 ? u.charAt(0).toUpperCase() : "?";
  }, [profile.username]);

  const baseAvatarImage = avatarRemoved
    ? null
    : avatarPreviewUrl || profile.avatar_url || null;

  const onCropComplete = (_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  };

  async function saveAvatar() {
    setError(null);
    setSaving(true);

    try {
      // removal wins
      if (avatarRemoved) {
        const updated = await updateAvatarUrl({
          profileId: profile.id,
          avatarUrl: null,
        });
        onUpdated(updated);

        // reset local edit state
        setAvatarFile(null);
        setAvatarPreviewUrl(null);
        setCroppedAreaPixels(null);
        setCroppedPreview(null);
        setAvatarRemoved(false);
        setSaving(false);
        return;
      }

      // must have a new file to save
      if (!avatarFile) {
        setSaving(false);
        return;
      }

      let uploadBlob: Blob = avatarFile;

      if (avatarPreviewUrl && croppedAreaPixels) {
        uploadBlob = await getCroppedImageBlob(avatarPreviewUrl, croppedAreaPixels);
      }

      const publicUrl = await uploadAvatarPng({
        profileId: profile.id,
        blob: uploadBlob,
      });

      const updated = await updateAvatarUrl({
        profileId: profile.id,
        avatarUrl: publicUrl,
      });

      onUpdated(updated);

      // reset local state after save
      setAvatarFile(null);
      setAvatarPreviewUrl(null);
      setCroppedAreaPixels(null);
      setCroppedPreview(null);
      setAvatarRemoved(false);
    } catch (e: any) {
      setError(e?.message || "Failed to save avatar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      <h2 className="text-base font-semibold">Avatar</h2>

      <div className="rounded-md overflow-hidden border border-slate-200 bg-white">
        {baseAvatarImage ? (
          <div className="flex flex-col md:flex-row">
            {/* LEFT: crop workspace */}
            <div className="md:w-2/3 border-b md:border-b-0 md:border-r border-slate-200">
              <div
                className="relative w-full h-96 md:h-[28rem] overflow-hidden"
                style={checkerboardStyle}
              >
                <Cropper
                  image={baseAvatarImage}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                  cropShape="round"
                />
              </div>
            </div>

            {/* RIGHT: live preview */}
            <div className="md:w-1/3 flex items-center justify-center px-6 py-6">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden mx-auto">
                  {croppedPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={croppedPreview}
                      alt="Avatar preview"
                      className="w-full h-full object-cover"
                    />
                  ) : baseAvatarImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={baseAvatarImage}
                      alt="Avatar preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-semibold text-slate-700">
                      {avatarInitial}
                    </span>
                  )}
                </div>

                <p className="text-xs font-semibold text-slate-900">
                  {profile.username}
                </p>
                <p className="text-[11px] text-slate-500">
                  This is how your avatar will appear.
                </p>
              </div>
            </div>
          </div>
        ) : (
          // PRE-UPLOAD STATE
          <div className="border-b border-slate-200">
            <label
              htmlFor="avatar-upload"
              className="relative w-full h-96 md:h-[28rem] group overflow-hidden flex items-center justify-center cursor-pointer"
              style={checkerboardStyle}
            >
              <div className="relative flex items-center justify-center h-full z-0">
                <div className="w-40 h-40 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                  <span className="text-lg font-semibold text-slate-700">
                    {avatarInitial}
                  </span>
                </div>
              </div>

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/50 transition z-10">
                <p className="text-2xl md:text-3xl font-semibold text-white opacity-0 group-hover:opacity-100 transition text-center px-4">
                  Drag and drop an image
                </p>
              </div>
            </label>
          </div>
        )}

        {/* Toolbar bottom */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
          <input
            id="avatar-upload"
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              setAvatarFile(file);
              setCrop({ x: 0, y: 0 });
              setZoom(1);
              setCroppedAreaPixels(null);
              setCroppedPreview(null);
              setAvatarRemoved(false);
              setError(null);
            }}
          />

          {baseAvatarImage ? (
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">Zoom</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-40 md:w-64"
                />
              </div>

              <div className="flex items-center gap-4 md:ml-auto">
                <button
                  type="button"
                  onClick={saveAvatar}
                  disabled={saving}
                  className="inline-flex items-center justify-center px-5 py-2 text-xs font-semibold rounded-full bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
                >
                  {saving ? "Saving…" : "Save avatar"}
                </button>

                <label
                  htmlFor="avatar-upload"
                  className="text-xs text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Change image
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setAvatarFile(null);
                    setAvatarPreviewUrl(null);
                    setCroppedAreaPixels(null);
                    setCroppedPreview(null);
                    setAvatarRemoved(true);
                    setError(null);
                  }}
                  className="text-xs text-red-500 hover:text-red-600 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 items-center">
              <div />
              <label
                htmlFor="avatar-upload"
                className="justify-self-center inline-flex items-center justify-center px-5 py-2 text-xs font-semibold rounded-full bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
              >
                Select new avatar
              </label>
              <button
                type="button"
                onClick={() => {
                  setAvatarFile(null);
                  setAvatarPreviewUrl(null);
                  setCroppedAreaPixels(null);
                  setCroppedPreview(null);
                  setAvatarRemoved(true);
                  setError(null);
                }}
                className="justify-self-end text-xs text-red-500 hover:text-red-600 cursor-pointer"
              >
                Remove
              </button>
            </div>
          )}
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