// components/settings/SettingsProfileTab.tsx
"use client";

import React, { useEffect, useState } from "react";
import type { ProfileRow } from "@/lib/hooks/useMyProfile";
import { isUsernameTaken, updateProfile } from "@/lib/settings/profileService";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  profile: ProfileRow;
  onUpdated: (next: ProfileRow) => void;
  onOpenBackdrop: () => void;
};

export default function SettingsProfileTab({
  profile,
  onUpdated,
  onOpenBackdrop,
}: Props) {
  const [formUsername, setFormUsername] = useState(profile.username ?? "");
  const [email, setEmail] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // if profile changes (refetch), sync
  useEffect(() => {
    setFormUsername(profile.username ?? "");
  }, [profile.id, profile.username]);

  // load signed-in user's email (from Supabase Auth)
  useEffect(() => {
    let mounted = true;

    async function loadEmail() {
      const { data, error } = await supabase.auth.getUser();
      if (!mounted) return;

      if (error) {
        setEmail(null);
        return;
      }

      setEmail(data.user?.email ?? null);
    }

    loadEmail();

    return () => {
      mounted = false;
    };
  }, []);

  async function onSave() {
    setError(null);

    const trimmed = formUsername.trim();
    if (!trimmed) {
      setError("Username cannot be empty.");
      return;
    }

    const newUsername = trimmed.toLowerCase();

    setSaving(true);
    try {
      if (newUsername !== (profile.username ?? "")) {
        const taken = await isUsernameTaken({
          username: newUsername,
          excludeProfileId: profile.id,
        });

        if (taken) {
          setError("That username is already taken.");
          setSaving(false);
          return;
        }
      }

      const updated = await updateProfile({
        profileId: profile.id,
        username: newUsername,
        bio: profile.bio ?? null, // ✅ keep existing bio value unchanged
      });

      onUpdated(updated);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl space-y-4 bg-white rounded-xs border-2 border-black p-5">
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      <div className="space-y-1">
        <label
          htmlFor="username"
          className="block text-xs font-medium text-slate-700"
        >
          Username
        </label>
        <input
          id="username"
          type="text"
          value={formUsername}
          onChange={(e) => setFormUsername(e.target.value)}
          className="w-full rounded-md border border-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
        />
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-slate-700">Email</p>
        </div>

        <div className="w-full rounded-md border border-black-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
          {email ?? "—"}
        </div>
      </div>
      <div className="pt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center px-5 py-2 text-xs font-semibold rounded-sm bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60 cursor-pointer"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </div>
  );
}