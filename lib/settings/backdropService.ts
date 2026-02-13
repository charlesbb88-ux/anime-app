// lib/settings/backdropService.ts
"use client";

import { supabase } from "@/lib/supabaseClient";

export type BackdropUpdates = {
  backdrop_url: string;
  backdrop_pos_x: number; // 0..100
  backdrop_pos_y: number; // 0..100
  backdrop_zoom: number;  // 1..3
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export async function uploadBackdrop(args: {
  userId: string;
  file: File;
}): Promise<string> {
  const { userId, file } = args;

  const rawExt = (file.name.split(".").pop() || "jpg").toLowerCase();
  const ext = ["jpg", "jpeg", "png", "webp"].includes(rawExt) ? rawExt : "jpg";

  const path = `${userId}/${Date.now()}.${ext}`;
  const bucket = "backdrops";

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      upsert: true,
      contentType: file.type || undefined,
    });

  if (uploadError) throw uploadError;

  const { data: publicData } = supabase.storage
    .from(bucket)
    .getPublicUrl(uploadData.path);

  return publicData.publicUrl;
}

export async function saveBackdropToProfile(args: {
  userId: string;
  updates: BackdropUpdates;
}): Promise<void> {
  const { userId, updates } = args;

  const safe: BackdropUpdates = {
    backdrop_url: updates.backdrop_url,
    backdrop_pos_x: clamp(updates.backdrop_pos_x, 0, 100),
    backdrop_pos_y: clamp(updates.backdrop_pos_y, 0, 100),
    backdrop_zoom: clamp(updates.backdrop_zoom, 1, 3),
  };

  const { error } = await supabase.from("profiles").update(safe).eq("id", userId);
  if (error) throw error;
}

/**
 * Convenience: does upload + DB write in one call.
 */
export async function uploadAndSaveBackdrop(args: {
  userId: string;
  file: File;
  xPct: number;
  yPct: number;
  zoom: number;
}): Promise<BackdropUpdates> {
  const { userId, file, xPct, yPct, zoom } = args;

  const url = await uploadBackdrop({ userId, file });

  const updates: BackdropUpdates = {
    backdrop_url: url,
    backdrop_pos_x: clamp(xPct, 0, 100),
    backdrop_pos_y: clamp(yPct, 0, 100),
    backdrop_zoom: clamp(zoom, 1, 3),
  };

  await saveBackdropToProfile({ userId, updates });
  return updates;
}