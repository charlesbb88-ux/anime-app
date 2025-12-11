// pages/[username]/anime.tsx

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";

import { supabase } from "@/lib/supabaseClient";
import {
  listAnime,
  getUserAnimeProgress,
  upsertUserAnimeProgress,
} from "@/lib/anime";
import type {
  Anime,
  UserAnimeProgressWithAnime,
  UserAnimeStatus,
} from "@/lib/types";

type Profile = {
  id: string;
  username: string | null;
};

const STATUS_OPTIONS: UserAnimeStatus[] = [
  "watching",
  "completed",
  "paused",
  "dropped",
  "plan_to_watch",
];

const UserAnimePage: NextPage = () => {
  const router = useRouter();
  const { username } = router.query;

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [animeOptions, setAnimeOptions] = useState<Anime[]>([]);
  const [animeOptionsLoading, setAnimeOptionsLoading] = useState(true);

  const [userProgress, setUserProgress] = useState<
    UserAnimeProgressWithAnime[]
  >([]);
  const [progressLoading, setProgressLoading] = useState(true);

  const [selectedAnimeId, setSelectedAnimeId] = useState<string>("");
  const [addingToList, setAddingToList] = useState(false);
  const [rowUpdatingId, setRowUpdatingId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isOwner =
    !!currentUser && !!profile && currentUser.id === profile.id;

  // 1) Load current logged-in user (if any), safely for logged-out users
  useEffect(() => {
    let isMounted = true;

    async function fetchUser() {
      setAuthLoading(true);

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (error) {
          console.error("Error getting auth session", error);
          setCurrentUser(null);
        } else {
          setCurrentUser(session?.user ?? null);
        }
      } catch (err) {
        console.error("getSession threw, treating as logged out", err);
        if (isMounted) {
          setCurrentUser(null);
        }
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    }

    fetchUser();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2) Load profile by [username] param
  useEffect(() => {
    if (!router.isReady) return;
    if (!username || typeof username !== "string") return;

    let isMounted = true;

    async function fetchProfile() {
      setProfileLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, username")
        .eq("username", username)
        .single();

      if (!isMounted) return;

      if (error || !data) {
        console.error("Error fetching profile by username", error);
        setProfile(null);
      } else {
        setProfile(data as Profile);
      }
      setProfileLoading(false);
    }

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [router.isReady, username]);

  // 3) Fetch anime options (for add-to-list)
  useEffect(() => {
    let isMounted = true;

    async function fetchAnimeOptions() {
      setAnimeOptionsLoading(true);

      const { data, error } = await listAnime({ limit: 200 });

      if (!isMounted) return;

      if (error) {
        console.error("Error fetching anime list", error);
        setAnimeOptions([]);
      } else {
        const sorted = (data ?? []).slice().sort((a, b) =>
          a.title.localeCompare(b.title)
        );
        setAnimeOptions(sorted);
        if (sorted.length > 0 && !selectedAnimeId) {
          setSelectedAnimeId(sorted[0].id);
        }
      }

      setAnimeOptionsLoading(false);
    }

    fetchAnimeOptions();

    return () => {
      isMounted = false;
    };
  }, [selectedAnimeId]);

  // 4) Fetch this profile's anime progress
  useEffect(() => {
    if (!profile?.id) {
      setUserProgress([]);
      setProgressLoading(false);
      return;
    }

    const profileId: string = profile.id;

    let isMounted = true;

    async function fetchProgress() {
      setProgressLoading(true);

      const { data, error } = await getUserAnimeProgress(profileId);

      if (!isMounted) return;

      if (error) {
        console.error("Error fetching user anime progress", error);
        setUserProgress([]);
      } else {
        setUserProgress(data ?? []);
      }
      setProgressLoading(false);
    }

    fetchProgress();

    return () => {
      isMounted = false;
    };
  }, [profile?.id]);

  async function refreshUserProgressForProfile(profileId: string) {
    setProgressLoading(true);
    const { data, error } = await getUserAnimeProgress(profileId);
    if (error) {
      console.error("Error refreshing user anime progress", error);
      setUserProgress([]);
    } else {
      setUserProgress(data ?? []);
    }
    setProgressLoading(false);
  }

  // --- Handlers (only meaningful if isOwner) ---

  async function handleAddToList() {
    if (!isOwner || !profile || !selectedAnimeId || addingToList) return;

    setErrorMessage(null);
    setAddingToList(true);

    try {
      const { error } = await upsertUserAnimeProgress({
        userId: profile.id,
        animeId: selectedAnimeId,
        episodesWatched: 0,
        status: "plan_to_watch",
      });

      if (error) {
        console.error("Error upserting anime progress", error);
        setErrorMessage("Could not add anime to the list.");
      } else {
        await refreshUserProgressForProfile(profile.id);
      }
    } finally {
      setAddingToList(false);
    }
  }

  async function handleIncrementEpisodes(entry: UserAnimeProgressWithAnime) {
    if (!isOwner || !profile || rowUpdatingId === entry.id) return;

    const current = entry.episodes_watched ?? 0;
    const total = entry.anime?.total_episodes ?? null;

    if (total !== null && current >= total) {
      return;
    }

    setErrorMessage(null);
    setRowUpdatingId(entry.id);

    try {
      const newCount = current + 1;

      const { error } = await upsertUserAnimeProgress({
        userId: profile.id,
        animeId: entry.anime_id,
        episodesWatched: newCount,
        status: entry.status,
      });

      if (error) {
        console.error("Error incrementing episodes", error);
        setErrorMessage("Could not update episodes.");
      } else {
        setUserProgress((prev) =>
          prev.map((p) =>
            p.id === entry.id ? { ...p, episodes_watched: newCount } : p
          )
        );
      }
    } finally {
      setRowUpdatingId(null);
    }
  }

  async function handleStatusChange(
    entry: UserAnimeProgressWithAnime,
    newStatus: UserAnimeStatus
  ) {
    if (!isOwner || !profile || rowUpdatingId === entry.id) return;

    setErrorMessage(null);
    setRowUpdatingId(entry.id);

    try {
      const { error } = await upsertUserAnimeProgress({
        userId: profile.id,
        animeId: entry.anime_id,
        episodesWatched: entry.episodes_watched,
        status: newStatus,
      });

      if (error) {
        console.error("Error updating status", error);
        setErrorMessage("Could not update status.");
      } else {
        setUserProgress((prev) =>
          prev.map((p) =>
            p.id === entry.id ? { ...p, status: newStatus } : p
          )
        );
      }
    } finally {
      setRowUpdatingId(null);
    }
  }

  // --- Render ---

  const pageTitle = profile?.username
    ? `${profile.username}'s Anime List`
    : "Anime List";

  if (profileLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">{pageTitle}</h1>
        <p className="text-sm text-gray-400">Loading profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">User not found</h1>
        <p className="mb-4 text-gray-300">
          We couldn&apos;t find a user with that username.
        </p>
        <Link
          href="/"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          Go back home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{pageTitle}</h1>
          {!authLoading && isOwner && (
            <p className="text-xs text-gray-400">
              You&apos;re viewing your own list. Extra controls are enabled.
            </p>
          )}
          {!authLoading && !isOwner && (
            <p className="text-xs text-gray-400">
              You&apos;re viewing this user&apos;s public anime list.
            </p>
          )}
        </div>

        <Link
          href={`/${profile.username ?? ""}`}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          ← Back to profile
        </Link>
      </div>

      {/* Add-to-list: only for owner */}
      {isOwner && (
        <section className="mb-8 rounded-lg border border-gray-800 bg-gray-900/60 p-4">
          <h2 className="text-lg font-semibold mb-3">Add anime to your list</h2>

          {animeOptionsLoading ? (
            <p className="text-sm text-gray-400">Loading anime...</p>
          ) : animeOptions.length === 0 ? (
            <p className="text-sm text-gray-400">
              No anime available. You may need to seed the{" "}
              <code className="text-xs">anime</code> table.
            </p>
          ) : (
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <select
                className="w-full md:w-64 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
                value={selectedAnimeId}
                onChange={(e) => setSelectedAnimeId(e.target.value)}
              >
                {animeOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleAddToList}
                disabled={addingToList || !selectedAnimeId}
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-blue-600/60 hover:bg-blue-500"
              >
                {addingToList ? "Adding..." : "Add to list"}
              </button>
            </div>
          )}
        </section>
      )}

      {/* Error banner */}
      {errorMessage && (
        <div className="mb-4 rounded-md border border-red-700 bg-red-950/60 px-3 py-2 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      {/* Anime list */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Anime</h2>

        {progressLoading ? (
          <p className="text-sm text-gray-400">Loading anime list...</p>
        ) : userProgress.length === 0 ? (
          <p className="text-sm text-gray-400">
            {isOwner
              ? "You haven't added any anime yet. Use the section above to start your list."
              : "This user hasn't added any anime yet."}
          </p>
        ) : (
          <div className="space-y-3">
            {userProgress.map((entry) => {
              const anime = entry.anime;
              const isUpdating = rowUpdatingId === entry.id;

              const statusLabel = entry.status.replace(/_/g, " ");

              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-4 rounded-lg border border-gray-800 bg-gray-900/60 p-3"
                >
                  {/* Poster */}
                  <div className="flex-shrink-0">
                    {anime?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={anime.image_url}
                        alt={anime.title}
                        className="h-24 w-16 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-24 w-16 items-center justify-center rounded-md bg-gray-800 text-lg font-bold text-gray-200">
                        {anime?.title?.[0] ?? "?"}
                      </div>
                    )}
                  </div>

                  {/* Middle: title + status */}
                  <div className="flex flex-1 flex-col gap-2">
                    <p className="text-sm font-semibold text-gray-100">
                      {anime?.title ?? "Unknown title"}
                    </p>

                    <div className="text-xs text-gray-400">
                      Status:{" "}
                      {isOwner ? (
                        <select
                          className="ml-1 rounded-md border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-gray-100 focus:border-blue-500 focus:outline-none"
                          value={entry.status}
                          disabled={isUpdating}
                          onChange={(e) =>
                            handleStatusChange(
                              entry,
                              e.target.value as UserAnimeStatus
                            )
                          }
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-medium text-gray-200">
                          {statusLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: episodes (and +1 if owner) */}
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-sm text-gray-100">
                      Episodes:{" "}
                      <span className="font-semibold">
                        {entry.episodes_watched ?? 0}
                      </span>{" "}
                      /{" "}
                      <span className="font-semibold">
                        {anime?.total_episodes ?? "?"}
                      </span>
                    </p>

                    {isOwner && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleIncrementEpisodes(entry)}
                        className="inline-flex items-center justify-center rounded-md border border-gray-700 px-3 py-1 text-xs font-medium text-gray-100 hover:border-blue-500 hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isUpdating ? "Updating..." : "+1 episode"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default UserAnimePage;
