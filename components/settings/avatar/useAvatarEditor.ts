"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

  // ✅ queue state (latest wins)
  const latestAreaRef = useRef<Area | null>(null);
  const workingRef = useRef(false);
  const disposedRef = useRef(false);

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

  const avatarInitial = useMemo(() => {
    const u = profile.username?.trim();
    return u && u.length > 0 ? u.charAt(0).toUpperCase() : "?";
  }, [profile.username]);

  const baseAvatarImage = avatarRemoved
    ? null
    : avatarPreviewUrl || profile.avatar_url || null;

  // ✅ single queue runner
  async function pumpPreviewQueue() {
    if (workingRef.current) return;
    if (!avatarPreviewUrl) return;

    workingRef.current = true;

    try {
      while (!disposedRef.current) {
        const area = latestAreaRef.current;
        if (!area) break;

        // "consume" current request
        latestAreaRef.current = null;

        try {
          const preview = await getCroppedImageDataUrl(avatarPreviewUrl, area);
          if (disposedRef.current) break;
          setCroppedPreview(preview);
        } catch {
          if (disposedRef.current) break;
          setCroppedPreview(null);
        }

        // if user moved again during await, latestAreaRef will be non-null
        // loop continues and paints the newest request next
      }
    } finally {
      workingRef.current = false;
    }
  }

  // ✅ live pixels while dragging
  function onCropAreaChange(_a: Area, pixels: Area) {
    setCroppedAreaPixels(pixels); // keep for save
    latestAreaRef.current = pixels; // request preview
    void pumpPreviewQueue();
  }

  // keep onCropComplete too (end-state accuracy)
  function onCropComplete(_a: Area, pixels: Area) {
    setCroppedAreaPixels(pixels);
    latestAreaRef.current = pixels;
    void pumpPreviewQueue();
  }

  // cleanup
  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      latestAreaRef.current = null;
    };
  }, []);

  // reset preview if no image or no crop yet
  useEffect(() => {
    if (!avatarPreviewUrl) {
      setCroppedPreview(null);
      latestAreaRef.current = null;
      return;
    }
  }, [avatarPreviewUrl]);

  function onFileSelected(file: File | null) {
    setAvatarFile(file);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCroppedPreview(null);
    latestAreaRef.current = null;
    setAvatarRemoved(false);
    setError(null);
  }

  function onRemove() {
    setAvatarFile(null);
    setAvatarPreviewUrl(null);
    setCroppedAreaPixels(null);
    setCroppedPreview(null);
    latestAreaRef.current = null;
    setAvatarRemoved(true);
    setError(null);
  }

  async function saveAvatar() {
    setError(null);
    setSaving(true);

    try {
      if (avatarRemoved) {
        const updated = await updateAvatarUrl({
          profileId: profile.id,
          avatarUrl: null,
        });
        onUpdated(updated);

        setAvatarFile(null);
        setAvatarPreviewUrl(null);
        setCroppedAreaPixels(null);
        setCroppedPreview(null);
        latestAreaRef.current = null;
        setAvatarRemoved(false);
        setSaving(false);
        return;
      }

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

      setAvatarFile(null);
      setAvatarPreviewUrl(null);
      setCroppedAreaPixels(null);
      setCroppedPreview(null);
      latestAreaRef.current = null;
      setAvatarRemoved(false);
    } catch (e: any) {
      setError(e?.message || "Failed to save avatar.");
    } finally {
      setSaving(false);
    }
  }

  return {
    saving,
    error,

    avatarInitial,
    baseAvatarImage,

    crop,
    setCrop,
    zoom,
    setZoom,

    onCropComplete,
    onCropAreaChange, // ✅ NEW
    croppedPreview,

    onFileSelected,
    onRemove,
    saveAvatar,
  };
}