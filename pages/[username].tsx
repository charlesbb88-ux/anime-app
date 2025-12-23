"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
};

type Post = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
};

function formatTimeAgo(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;

  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;

  return date.toLocaleDateString();
}

export default function UserProfilePage() {
  const router = useRouter();
  const { username } = router.query;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  // Load logged-in user once
  useEffect(() => {
    let cancelled = false;

    supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setCurrentUser(null);
      } else {
        setCurrentUser(data.user ?? null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Normalize username param:
    // string | string[] | undefined -> lowercase string | undefined
    const raw =
      typeof username === "string"
        ? username
        : Array.isArray(username)
        ? username[0]
        : undefined;

    if (!raw) return;

    const unameLower = raw.toLowerCase(); // ✅ match our DB rule

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setNotFound(false);

      // 1) Find profile by canonical lowercase handle
      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, bio, created_at")
        .eq("username", unameLower)
        .limit(1);

      const profileRow = profileRows?.[0] ?? null;

      if (cancelled) return;

      if (profileError || !profileRow) {
        setProfile(null);
        setPosts([]);
        setNotFound(true);
        setLoading(false);
        return;
      }

      setProfile(profileRow as Profile);

      // 2) Get posts for that user_id
      const { data: postRows, error: postsError } = await supabase
        .from("posts")
        .select("id, user_id, content, created_at")
        .eq("user_id", profileRow.id)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (postsError || !postRows) {
        setPosts([]);
      } else {
        setPosts(postRows as Post[]);
      }

      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [username]);

  // For the “not found” message, we just display what was in the URL raw
  const normalizedUsername =
    typeof username === "string"
      ? username
      : Array.isArray(username)
      ? username[0]
      : "";

  const isOwner =
    !!currentUser && !!profile && currentUser.id === profile.id;

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-slate-600">Loading…</p>
      </main>
    );
  }

  if (notFound || !profile) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="bg-white shadow-sm rounded-xl px-6 py-5">
          <p className="text-lg font-semibold text-slate-800 mb-2">
            User not found
          </p>
          <p className="text-sm text-slate-500">
            We couldn’t find a profile for{" "}
            <span className="font-mono">@{normalizedUsername}</span>.
          </p>
        </div>
      </main>
    );
  }

  // Simple avatar circle (image if avatar_url, otherwise first letter)
  const avatarInitial = profile.username
    ? profile.username.trim().charAt(0).toUpperCase()
    : "?";

  return (
    <main className="min-h-screen ">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8 border-b border-slate-200 pb-5">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xl font-semibold text-slate-700">
                  {avatarInitial}
                </span>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">
                    @{profile.username}
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Joined{" "}
                    {new Date(profile.created_at).toLocaleDateString(
                      undefined,
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      }
                    )}
                  </p>
                </div>

                {isOwner && (
                  <Link
                    href="/settings"
                    className="px-3 py-1.5 text-sm rounded-full border border-slate-300 text-slate-700 hover: transition"
                  >
                    Edit profile
                  </Link>
                )}
              </div>

              {profile.bio && (
                <p className="mt-3 text-sm text-slate-800 whitespace-pre-line">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>
        </header>

        {/* Posts */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Posts by @{profile.username}
          </h2>

          {posts.length === 0 ? (
            <p className="text-sm text-slate-500">
              This user hasn’t posted anything yet.
            </p>
          ) : (
            <ul className="space-y-4">
              {posts.map((post) => (
                <li
                  key={post.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span>@{profile.username}</span>
                    <span>{formatTimeAgo(post.created_at)}</span>
                  </div>
                  <Link
                    href={`/posts/${post.id}`}
                    className="block text-slate-900 whitespace-pre-wrap"
                  >
                    {post.content}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
