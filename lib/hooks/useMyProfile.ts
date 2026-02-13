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
};

type SupaUser = any;

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
      const res = await supabase.auth.getUser();
      const { data, error: authErr } = res;

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

      const { data: rows, error: profErr } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, bio, created_at")
        .eq("id", data.user.id)
        .limit(1);

      const row = rows?.[0] ?? null;

      if (profErr || !row) {
        setProfile(null);
        setError("Profile not found for this account.");
        setProfileLoading(false);
        setLoading(false);
        return;
      }

      setProfile(row as ProfileRow);
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

  // Useful when a tab saves something and you want immediate UI update
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