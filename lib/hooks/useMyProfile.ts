// lib/hooks/useMyProfile.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type ProfileRow = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;

  backdrop_url: string | null;
  backdrop_pos_x: number | null;
  backdrop_pos_y: number | null;
  backdrop_zoom: number | null;

  about_markdown: string | null;
  about_html: string | null;
  about_updated_at: string | null;
};

type SupaUser = any;

function isProfileRow(x: any): x is ProfileRow {
  return (
    x &&
    typeof x === "object" &&
    typeof x.id === "string" &&
    typeof x.username === "string" &&
    // these can be null, but must exist as keys in the object
    "avatar_url" in x &&
    "bio" in x &&
    typeof x.created_at === "string" &&
    "backdrop_url" in x &&
    "backdrop_pos_x" in x &&
    "backdrop_pos_y" in x &&
    "backdrop_zoom" in x &&
    "about_markdown" in x &&
    "about_html" in x &&
    "about_updated_at" in x
  );
}

export function useMyProfile() {
  const [authUser, setAuthUser] = useState<SupaUser | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    setAuthChecking(true);
    setProfileLoading(false);

    try {
      const { data, error: authErr } = await supabase.auth.getUser();

      if (authErr || !data.user) {
        setAuthUser(null);
        setProfile(null);
        setError("You must be logged in to view settings.");
        setAuthChecking(false);
        setLoading(false);
        return;
      }

      setAuthUser(data.user);
      setAuthChecking(false);

      setProfileLoading(true);

      const { data: row, error: profErr } = await supabase
        .from("profiles")
        .select(
          [
            "id",
            "username",
            "avatar_url",
            "bio",
            "created_at",
            "backdrop_url",
            "backdrop_pos_x",
            "backdrop_pos_y",
            "backdrop_zoom",
            "about_markdown",
            "about_html",
            "about_updated_at",
          ].join(", ")
        )
        .eq("id", data.user.id)
        .single();

      if (profErr || !row) {
        setProfile(null);
        setError("Profile not found for this account.");
        setProfileLoading(false);
        setLoading(false);
        return;
      }

      // ✅ runtime guard fixes TS + makes the code safer
      if (!isProfileRow(row)) {
        setProfile(null);
        setError("Profile data returned in an unexpected format.");
        setProfileLoading(false);
        setLoading(false);
        return;
      }

      setProfile(row);
      setProfileLoading(false);
      setLoading(false);
    } catch (e: any) {
      setAuthUser(null);
      setProfile(null);
      setError(e?.message || "Failed to load settings.");
      setAuthChecking(false);
      setProfileLoading(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refetch = useCallback(async () => {
    await load();
  }, [load]);

  const setProfileOptimistic = useCallback((next: ProfileRow) => {
    setProfile(next);
  }, []);

  return {
    authUser,
    profile,
    loading,
    authChecking,
    profileLoading,
    error,
    refetch,
    setProfileOptimistic,
  };
}