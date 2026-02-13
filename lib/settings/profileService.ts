// lib/settings/profileService.ts
"use client";

import { supabase } from "@/lib/supabaseClient";
import type { ProfileRow } from "@/lib/hooks/useMyProfile";

export async function isUsernameTaken(args: {
  username: string;
  excludeProfileId: string;
}): Promise<boolean> {
  const { username, excludeProfileId } = args;

  const { count, error } = await supabase
    .from("profiles")
    .select("id", { head: true, count: "exact" })
    .eq("username", username)
    .neq("id", excludeProfileId);

  if (error) throw error;
  return typeof count === "number" && count > 0;
}

export async function updateProfile(args: {
  profileId: string;
  username: string;
  bio: string | null;
}): Promise<ProfileRow> {
  const { profileId, username, bio } = args;

  const { data, error } = await supabase
    .from("profiles")
    .update({
      username,
      bio,
    })
    .eq("id", profileId)
    .select("id, username, avatar_url, bio, created_at")
    .single();

  if (error) throw error;
  return data as ProfileRow;
}

export async function updateAvatarUrl(args: {
  profileId: string;
  avatarUrl: string | null;
}): Promise<ProfileRow> {
  const { profileId, avatarUrl } = args;

  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", profileId)
    .select("id, username, avatar_url, bio, created_at")
    .single();

  if (error) throw error;
  return data as ProfileRow;
}

export async function uploadAvatarPng(args: {
  profileId: string;
  blob: Blob;
}): Promise<string> {
  const { profileId, blob } = args;

  const filePath = `${profileId}/${Date.now()}.png`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, blob, {
      upsert: true,
      contentType: "image/png",
    });

  if (uploadError) throw uploadError;

  const { data: publicData } = supabase.storage
    .from("avatars")
    .getPublicUrl(uploadData.path);

  return publicData.publicUrl;
}