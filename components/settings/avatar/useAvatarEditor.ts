"use client";

import { useEffect, useMemo, useState } from "react";
import type { Area } from "react-easy-crop";

import type { ProfileRow } from "@/lib/hooks/useMyProfile";
import { getCroppedImageBlob, getCroppedImageDataUrl } from "@/lib/image/crop";
import { updateAvatarUrl, uploadAvatarPng } from "@/lib/settings/profileService";

type Args = {
  profile: ProfileRow;
  onUpdated: (next: ProfileRow) => void;
};

export function useAvatarEditor({ profile, onUpdated }: Args) {
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

  function onFileSelected(file: File | null) {
    setAvatarFile(file);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCroppedPreview(null);
    setAvatarRemoved(false);
    setError(null);
  }

  function onRemove() {
    setAvatarFile(null);
    setAvatarPreviewUrl(null);
    setCroppedAreaPixels(null);
    setCroppedPreview(null);
    setAvatarRemoved(true);
    setError(null);
  }

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
        uploadBlob = await getCroppedImageBlob(
          avatarPreviewUrl,
          croppedAreaPixels
        );
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

  return {
    // status
    saving,
    error,

    // derived
    avatarInitial,
    baseAvatarImage,

    // crop state
    crop,
    setCrop,
    zoom,
    setZoom,
    onCropComplete,
    croppedPreview,

    // actions
    onFileSelected,
    onRemove,
    saveAvatar,
  };
}