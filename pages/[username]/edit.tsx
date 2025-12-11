"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient"; // 👈 fixed path

type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
};

type SupaUser = any;

const EditProfilePage: NextPage = () => {
  const router = useRouter();
  const { username } = router.query;

  const [authUser, setAuthUser] = useState<SupaUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formUsername, setFormUsername] = useState("");
  const [formAvatarUrl, setFormAvatarUrl] = useState("");
  const [formBio, setFormBio] = useState("");

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load logged-in user
  useEffect(() => {
    let cancelled = false;

    supabase.auth.getUser().then((res) => {
      if (cancelled) return;
      const { data, error } = res;

      if (error) {
        setAuthUser(null);
      } else {
        setAuthUser(data.user ?? null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Load profile by username in URL
  useEffect(() => {
    const raw =
      typeof username === "string"
        ? username
        : Array.isArray(username)
        ? username[0]
        : undefined;

    if (!raw) return;

    const unameLower = raw.toLowerCase();

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError(null);

      const { data: rows, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, bio, created_at")
        .eq("username", unameLower)
        .limit(1);

      if (cancelled) return;

      const row = rows?.[0] ?? null;

      if (error || !row) {
        setProfile(null);
        setLoading(false);
        setLoadError("Profile not found.");
        return;
      }

      setProfile(row as Profile);
      setFormUsername(row.username ?? "");
      setFormAvatarUrl(row.avatar_url ?? "");
      setFormBio(row.bio ?? "");
      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [username]);

  const isOwner =
    !!authUser && !!profile && authUser.id === profile.id;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !isOwner) return;

    setSaveError(null);

    const trimmed = formUsername.trim();
    if (!trimmed) {
      setSaveError("Username cannot be empty.");
      return;
    }

    // keep usernames lowercase like the rest of the app
    const newUsername = trimmed.toLowerCase();
    const newAvatar = formAvatarUrl.trim();
    const newBio = formBio.trim();

    setSaving(true);

    try {
      // Check uniqueness if changed
      if (newUsername !== profile.username) {
        const { count, error: uniqError } = await supabase
          .from("profiles")
          .select("id", { head: true, count: "exact" })
          .eq("username", newUsername)
          .neq("id", profile.id);

        if (uniqError) throw uniqError;

        if (typeof count === "number" && count > 0) {
          setSaveError("That username is already taken.");
          setSaving(false);
          return;
        }
      }

      const updates = {
        username: newUsername,
        avatar_url: newAvatar || null,
        bio: newBio || null,
      };

      const { data: updated, error: updateError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", profile.id)
        .select("id, username")
        .single();

      if (updateError) throw updateError;

      const finalUsername = (updated as Profile).username;
      router.push(`/${finalUsername}`);
    } catch (err: any) {
      setSaveError(err.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-slate-600">Loading…</p>
      </main>
    );
  }

  if (loadError || !profile) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="bg-white shadow-sm rounded-xl px-6 py-5 space-y-2">
          <p className="text-sm text-red-500">
            {loadError || "Profile not found."}
          </p>
          <Link
            href="/"
            className="text-xs text-blue-600 hover:underline"
          >
            Go back home
          </Link>
        </div>
      </main>
    );
  }

  if (!isOwner) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="bg-white shadow-sm rounded-xl px-6 py-5 space-y-2">
          <p className="text-sm text-red-500">
            You can only edit your own profile.
          </p>
          <Link
            href={`/${profile.username}`}
            className="text-xs text-blue-600 hover:underline"
          >
            Back to profile
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-slate-900">
            Edit profile
          </h1>
          <Link
            href={`/${profile.username}`}
            className="text-xs text-slate-500 hover:underline"
          >
            Cancel and go back
          </Link>
        </div>

        {saveError && (
          <p className="mb-3 text-sm text-red-500">{saveError}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div className="space-y-1">
            <label
              htmlFor="username"
              className="block text-xs font-medium text-slate-600"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={formUsername}
              onChange={(e) => setFormUsername(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-500">
              Will be stored in lowercase.
            </p>
          </div>

          {/* Avatar URL */}
          <div className="space-y-1">
            <label
              htmlFor="avatar_url"
              className="block text-xs font-medium text-slate-600"
            >
              Avatar URL
            </label>
            <input
              id="avatar_url"
              type="text"
              value={formAvatarUrl}
              onChange={(e) => setFormAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.png"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-500">
              For now, paste a direct image URL. You can add uploads later.
            </p>
          </div>

          {/* Bio */}
          <div className="space-y-1">
            <label
              htmlFor="bio"
              className="block text-xs font-medium text-slate-600"
            >
              Bio
            </label>
            <textarea
              id="bio"
              rows={4}
              value={formBio}
              onChange={(e) => setFormBio(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/${profile.username}`)}
              className="text-xs text-slate-500 hover:underline"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </main>
  );
};

export default EditProfilePage;
