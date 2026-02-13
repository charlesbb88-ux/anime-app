// components/settings/SettingsProfileTab.tsx
"use client";

import React, { useEffect, useState } from "react";
import type { ProfileRow } from "@/lib/hooks/useMyProfile";
import { isUsernameTaken, updateProfile } from "@/lib/settings/profileService";

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
  const [formBio, setFormBio] = useState(profile.bio ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // if profile changes (refetch), sync
  useEffect(() => {
    setFormUsername(profile.username ?? "");
    setFormBio(profile.bio ?? "");
  }, [profile.id, profile.username, profile.bio]);

  async function onSave() {
    setError(null);

    const trimmed = formUsername.trim();
    if (!trimmed) {
      setError("Username cannot be empty.");
      return;
    }

    const newUsername = trimmed.toLowerCase();
    const newBio = formBio.trim();

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
        bio: newBio ? newBio : null,
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
    <div className="max-w-xl space-y-4 bg-white rounded-xl border border-slate-200 p-5">
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
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
        />
        <p className="text-[11px] text-slate-500">
          Your handle. Will be stored in lowercase.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="bio" className="block text-xs font-medium text-slate-700">
          Bio
        </label>
        <textarea
          id="bio"
          rows={4}
          value={formBio}
          onChange={(e) => setFormBio(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
        />
        <p className="text-[11px] text-slate-500">
          Tell people a little about yourself.
        </p>
      </div>

      <div className="pt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={onOpenBackdrop}
          className="inline-flex items-center px-5 py-2 text-xs font-semibold rounded-full border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
        >
          Edit backdrop
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center px-5 py-2 text-xs font-semibold rounded-full bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </div>
  );
}