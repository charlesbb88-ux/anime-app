// pages/anime/[slug]/episode/[episodeNumber].tsx

"use client";

import { useRouter } from "next/router";
import type { NextPage } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { Anime, AnimeEpisode } from "@/lib/types";
import { getAnimeBySlug, getAnimeEpisode } from "@/lib/anime";

// ✅ episode review helper
import { createAnimeEpisodeReview } from "@/lib/reviews";

// ✅ episode log helpers
import { createAnimeEpisodeLog, getMyAnimeEpisodeLogCount } from "@/lib/logs";

import EpisodeNavigator from "@/components/EpisodeNavigator";
import LeftSidebar from "@/components/LeftSidebar";
import RightSidebar from "@/components/RightSidebar";
import PostFeed from "@/components/PostFeed";

// ✅ Global Log modal
import GlobalLogModal from "@/components/reviews/GlobalLogModal";

// ✅ Letterboxd-style action box
import ActionBox from "@/components/actions/ActionBox";

const AnimeEpisodePage: NextPage = () => {
  const router = useRouter();
  const { slug, episodeNumber } = router.query;

  const [anime, setAnime] = useState<Anime | null>(null);
  const [isAnimeLoading, setIsAnimeLoading] = useState(true);
  const [animeError, setAnimeError] = useState<string | null>(null);

  const [episode, setEpisode] = useState<AnimeEpisode | null>(null);
  const [isEpisodeLoading, setIsEpisodeLoading] = useState(false);
  const [episodeError, setEpisodeError] = useState<string | null>(null);

  // ✅ Test review saving state
  const [savingReview, setSavingReview] = useState(false);
  const [reviewSaveMsg, setReviewSaveMsg] = useState<string | null>(null);

  // ✅ Test logging state
  const [savingLog, setSavingLog] = useState(false);
  const [logSaveMsg, setLogSaveMsg] = useState<string | null>(null);

  // ✅ my log count
  const [myLogCount, setMyLogCount] = useState<number | null>(null);

  // ✅ Force PostFeed refresh after saving
  const [feedNonce, setFeedNonce] = useState(0);

  // ✅ Force ActionBox refresh after saving
  const [actionBoxNonce, setActionBoxNonce] = useState(0);

  // ✅ open/close the global log modal
  const [logOpen, setLogOpen] = useState(false);

  // Normalize slug and episodeNumber to strings
  const slugString = Array.isArray(slug) ? slug[0] : slug ?? "";
  const episodeNumberString = Array.isArray(episodeNumber)
    ? episodeNumber[0]
    : episodeNumber ?? "";

  const episodeNum = Number(episodeNumberString);
  const isValidEpisodeNumber = Number.isInteger(episodeNum) && episodeNum > 0;

  // Load anime by slug once the router is ready and slug is valid
  useEffect(() => {
    if (!router.isReady) return;
    if (!slugString) return;

    let isCancelled = false;

    const loadAnime = async () => {
      setIsAnimeLoading(true);
      setAnimeError(null);

      const { data, error } = await getAnimeBySlug(slugString);

      if (isCancelled) return;

      if (error) {
        console.error("Error loading anime by slug:", error);
        setAnime(null);
        setAnimeError("Failed to load anime.");
      } else if (!data) {
        setAnime(null);
        setAnimeError("Anime not found.");
      } else {
        setAnime(data);
        setAnimeError(null);
      }

      setIsAnimeLoading(false);
    };

    loadAnime();

    return () => {
      isCancelled = true;
    };
  }, [router.isReady, slugString]);

  // Load episode once we know the anime (to get anime.id) and have a valid episode number
  useEffect(() => {
    if (!anime) return;
    if (!isValidEpisodeNumber) return;

    let isCancelled = false;

    const loadEpisode = async () => {
      setIsEpisodeLoading(true);
      setEpisodeError(null);
      setEpisode(null);

      const { data, error } = await getAnimeEpisode(anime.id, episodeNum);

      if (isCancelled) return;

      if (error) {
        console.error("Error loading anime episode:", error);
        setEpisode(null);
        setEpisodeError("Failed to load episode.");
      } else if (!data) {
        setEpisode(null);
        setEpisodeError("Episode not found.");
      } else {
        setEpisode(data);
        setEpisodeError(null);
      }

      setIsEpisodeLoading(false);
    };

    loadEpisode();

    return () => {
      isCancelled = true;
    };
  }, [anime, episodeNum, isValidEpisodeNumber]);

  // ✅ fetch my log count when the episode loads
  useEffect(() => {
    if (!episode?.id) {
      setMyLogCount(null);
      return;
    }

    let isCancelled = false;

    const run = async () => {
      const { count, error } = await getMyAnimeEpisodeLogCount(episode.id);
      if (isCancelled) return;

      if (error) {
        console.error("Error fetching log count:", error);
        setMyLogCount(null);
        return;
      }

      setMyLogCount(count);
    };

    run();

    return () => {
      isCancelled = true;
    };
  }, [episode?.id]);

  async function handleTestSaveReview() {
    if (!anime?.id || !episode?.id) return;

    setSavingReview(true);
    setReviewSaveMsg(null);

    try {
      const result = await createAnimeEpisodeReview({
        anime_id: anime.id,
        anime_episode_id: episode.id,
        rating: 87,
        content: `Test review for ${anime.title} - Episode ${episodeNum} @ ${new Date().toLocaleString()}`,
        contains_spoilers: false,
      });

      if (result.error) {
        console.error("Error saving review:", result.error);
        setReviewSaveMsg(
          String((result.error as any)?.message || "Failed to save review.")
        );
        return;
      }

      setReviewSaveMsg(`Saved ✅ (review id: ${result.data?.id})`);

      // ✅ Force PostFeed to re-mount and re-fetch the episode feed
      setFeedNonce((n) => n + 1);
    } finally {
      setSavingReview(false);
    }
  }

  // ✅ test log episode (INSERT ONLY)
  async function handleTestLogEpisode() {
    if (!anime?.id || !episode?.id) return;

    setSavingLog(true);
    setLogSaveMsg(null);

    try {
      const result = await createAnimeEpisodeLog({
        anime_id: anime.id,
        anime_episode_id: episode.id,
      });

      if (result.error) {
        console.error("Error logging episode:", result.error);
        setLogSaveMsg(
          String((result.error as any)?.message || "Failed to log episode.")
        );
        return;
      }

      setLogSaveMsg(`Logged ✅ (log id: ${result.data?.id})`);

      // ✅ refresh count
      const { count, error } = await getMyAnimeEpisodeLogCount(episode.id);
      if (!error) setMyLogCount(count);
    } finally {
      setSavingLog(false);
    }
  }

  if (!router.isReady) {
    return (
      <main className="min-h-screen px-4 py-8">
        <p className="text-sm text-gray-500">Loading episode…</p>
      </main>
    );
  }

  if (!slugString || !isValidEpisodeNumber) {
    return (
      <main className="min-h-screen px-4 py-8">
        <h1 className="mb-2 text-xl font-semibold text-gray-100">
          Invalid episode URL
        </h1>
        <p className="text-sm text-gray-500">
          The episode number or anime slug in the URL is not valid.
        </p>
      </main>
    );
  }

  const a: any = anime;

  return (
    <>
      <main className="min-h-screen">
        <div className="mx-auto max-w-5xl px-4 py-8">
          {a?.banner_image_url && (
            <img
              src={a.banner_image_url}
              alt={`${anime?.title ?? slugString} banner`}
              className="mb-6 h-40 w-full rounded-lg object-cover"
            />
          )}

          <div className="mb-6 flex flex-col gap-6 md:flex-row">
            <div className="flex-shrink-0">
              {anime?.image_url ? (
                <img
                  src={anime.image_url}
                  alt={anime.title}
                  className="h-64 w-44 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-64 w-44 items-center justify-center rounded-lg bg-gray-800 text-4xl font-bold text-gray-200">
                  {(anime?.title ?? slugString)[0] ?? "?"}
                </div>
              )}
            </div>

            <div className="flex-1">
              <p className="mb-1 text-xs text-gray-500">Anime episode page</p>

              <h1 className="mb-2 text-3xl font-bold text-gray-100">
                {anime?.title ?? slugString}
                <span className="text-gray-500"> — </span>
                <span className="text-gray-100">Episode {episodeNum}</span>
              </h1>

              {episode?.title && (
                <p className="mb-2 text-sm text-gray-300">
                  <span className="font-semibold text-gray-200">
                    Episode title:
                  </span>{" "}
                  {episode.title}
                </p>
              )}

              {isAnimeLoading && (
                <p className="text-xs text-gray-500">Loading anime details…</p>
              )}

              {!isAnimeLoading && animeError && (
                <p className="text-xs text-red-400">{animeError}</p>
              )}

              {isEpisodeLoading && (
                <p className="text-xs text-gray-500">Loading episode…</p>
              )}

              {!isEpisodeLoading && episodeError && (
                <p className="text-xs text-red-400">{episodeError}</p>
              )}

              <div className="mt-4">
                <EpisodeNavigator
                  slug={slugString}
                  totalEpisodes={anime?.total_episodes ?? null}
                  currentEpisodeNumber={episodeNum}
                />
              </div>

              <div className="mt-4 flex items-center gap-3">
                <Link
                  href={`/anime/${slugString}`}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  ← Back to anime main page
                </Link>

                {anime && episode && (
                  <button
                    type="button"
                    onClick={() => setLogOpen(true)}
                    className="rounded-md border border-gray-700 bg-gray-900/40 px-3 py-1 text-xs font-medium text-gray-200 hover:bg-gray-900/60"
                  >
                    Log
                  </button>
                )}
              </div>

              {anime && episode && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestSaveReview}
                    disabled={savingReview}
                    className="rounded-md border border-gray-700 bg-gray-900/40 px-3 py-1 text-xs font-medium text-gray-200 hover:bg-gray-900/60 disabled:opacity-60"
                  >
                    {savingReview ? "Saving…" : "Test: Save episode review"}
                  </button>

                  <button
                    type="button"
                    onClick={handleTestLogEpisode}
                    disabled={savingLog}
                    className="rounded-md border border-gray-700 bg-gray-900/40 px-3 py-1 text-xs font-medium text-gray-200 hover:bg-gray-900/60 disabled:opacity-60"
                  >
                    {savingLog ? "Logging…" : "Test: Log episode"}
                  </button>

                  {typeof myLogCount === "number" && (
                    <span className="text-xs text-gray-400">
                      You logged this{" "}
                      <span className="font-semibold text-gray-200">
                        {myLogCount}
                      </span>{" "}
                      time{myLogCount === 1 ? "" : "s"}
                    </span>
                  )}

                  {reviewSaveMsg && (
                    <span className="text-xs text-gray-400">
                      {reviewSaveMsg}
                    </span>
                  )}
                  {logSaveMsg && (
                    <span className="text-xs text-gray-400">{logSaveMsg}</span>
                  )}
                </div>
              )}

              {/* ✅ NEW: ActionBox (series marks) that opens episode modal */}
              {anime && episode && (
                <div className="mt-3">
                  <ActionBox
                    key={actionBoxNonce}
                    animeId={anime.id}
                    animeEpisodeId={episode.id}   // ✅ THIS IS THE FIX
                    onOpenLog={() => setLogOpen(true)}
                    onShowActivity={() =>
                      router.push(`/anime/${slugString}/episode/${episodeNum}/activity`)
                    }
                  />

                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-gray-200">
                Episode details
              </h2>
              {episode?.air_date && (
                <p className="text-xs text-gray-500">
                  Air date:{" "}
                  <span className="text-gray-300">
                    {new Date(episode.air_date).toLocaleString()}
                  </span>
                </p>
              )}
            </div>

            {!episode && !episodeError && !isEpisodeLoading && (
              <p className="mt-2 text-sm text-gray-500">
                No episode data found for this episode number.
              </p>
            )}

            {episode?.synopsis ? (
              <p className="mt-3 whitespace-pre-line text-sm text-gray-200">
                {episode.synopsis}
              </p>
            ) : (
              episode && (
                <p className="mt-2 text-sm text-gray-500">
                  No synopsis has been added for this episode yet.
                </p>
              )
            )}
          </div>
        </div>

        {anime && episode && (
          <div
            style={{
              marginTop: "1.5rem",
              maxWidth: "80rem",
              marginLeft: "auto",
              marginRight: "auto",
              padding: "2rem 1.5rem",
              display: "grid",
              gridTemplateColumns:
                "minmax(0, 19rem) minmax(0, 41rem) minmax(0, 19rem)",
              gap: "1rem",
            }}
          >
            <div>
              <LeftSidebar />
            </div>

            <div>
              <div className="mb-3 text-lg font-semibold text-gray-100">
                Episode discussion
              </div>

              <PostFeed
                key={feedNonce}
                animeId={anime.id}
                animeEpisodeId={episode.id}
              />
            </div>

            <div>
              <RightSidebar />
            </div>
          </div>
        )}
      </main>

      {/* ✅ Global log modal render */}
      <GlobalLogModal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        title={
          anime ? `${anime.title} — Episode ${episodeNum}` : `Episode ${episodeNum}`
        }
        posterUrl={anime?.image_url ?? null}
        animeId={anime?.id ?? null}
        animeEpisodeId={episode?.id ?? null}
        onSuccess={async () => {
          if (!episode?.id) return;

          const { count, error } = await getMyAnimeEpisodeLogCount(episode.id);
          if (!error) setMyLogCount(count);

          // ✅ refresh episode feed so new review shows immediately
          setFeedNonce((n) => n + 1);

          // ✅ optional: refresh marks UI (watched/liked/watchlist/rating)
          setActionBoxNonce((n) => n + 1);
        }}
      />
    </>
  );
};

export default AnimeEpisodePage;
