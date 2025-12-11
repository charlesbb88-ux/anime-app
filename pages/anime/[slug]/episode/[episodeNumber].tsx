// pages/anime/[slug]/episode/[episodeNumber].tsx

import { useRouter } from "next/router";
import type { NextPage } from "next";
import { useEffect, useState } from "react";
import type { Anime, AnimeEpisode } from "@/lib/types";
import { getAnimeBySlug, getAnimeEpisode } from "@/lib/anime";

const AnimeEpisodePage: NextPage = () => {
  const router = useRouter();
  const { slug, episodeNumber } = router.query;

  const [anime, setAnime] = useState<Anime | null>(null);
  const [isAnimeLoading, setIsAnimeLoading] = useState(true);
  const [animeError, setAnimeError] = useState<string | null>(null);

  const [episode, setEpisode] = useState<AnimeEpisode | null>(null);
  const [isEpisodeLoading, setIsEpisodeLoading] = useState(false);
  const [episodeError, setEpisodeError] = useState<string | null>(null);

  // Normalize slug and episodeNumber to strings
  const slugString = Array.isArray(slug) ? slug[0] : slug ?? "";
  const episodeNumberString = Array.isArray(episodeNumber)
    ? episodeNumber[0]
    : episodeNumber ?? "";

  const episodeNum = Number(episodeNumberString);
  const isValidEpisodeNumber =
    Number.isInteger(episodeNum) && episodeNum > 0;

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
        <h1 className="text-xl font-semibold mb-2">
          Invalid episode URL
        </h1>
        <p className="text-sm text-gray-500">
          The episode number or anime slug in the URL is not valid.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <header className="mb-6">
        <p className="text-sm text-gray-500 mb-1">Anime episode page</p>
        <h1 className="text-2xl font-bold">
          {anime?.title ?? slugString} — Episode {episodeNum}
        </h1>

        {isAnimeLoading && (
          <p className="text-xs text-gray-500 mt-1">
            Loading anime details…
          </p>
        )}

        {!isAnimeLoading && animeError && (
          <p className="text-xs text-red-500 mt-1">{animeError}</p>
        )}
      </header>

      <section className="space-y-4">
        <div>
          <p className="text-sm text-gray-600">
            This is still an early version of the anime episode page.
          </p>
          <p className="text-xs text-gray-500">
            slug: <code className="font-mono">{slugString}</code>
          </p>
          <p className="text-xs text-gray-500">
            episodeNumber: <code className="font-mono">{episodeNum}</code>
          </p>
        </div>

        {anime && (
          <div className="mt-2 border-t border-gray-200 pt-4 space-y-1">
            <p className="text-sm font-semibold">Anime details</p>
            <p className="text-sm text-gray-700">
              Title: <span className="font-medium">{anime.title}</span>
            </p>
            {anime.title_english && (
              <p className="text-xs text-gray-600">
                English: {anime.title_english}
              </p>
            )}
            {anime.title_native && (
              <p className="text-xs text-gray-600">
                Native: {anime.title_native}
              </p>
            )}
            {typeof anime.total_episodes === "number" && (
              <p className="text-xs text-gray-600">
                Total episodes: {anime.total_episodes}
              </p>
            )}
          </div>
        )}

        <div className="mt-4 border-t border-gray-200 pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Episode details</p>
            {isEpisodeLoading && (
              <p className="text-xs text-gray-500">
                Loading episode…
              </p>
            )}
          </div>

          {!isEpisodeLoading && episodeError && (
            <p className="text-xs text-red-500">{episodeError}</p>
          )}

          {!isEpisodeLoading && !episodeError && !episode && (
            <p className="text-xs text-gray-500">
              No episode data found for this episode number.
            </p>
          )}

          {episode && (
            <div className="space-y-1">
              {episode.title && (
                <p className="text-sm text-gray-800">
                  Episode title:{" "}
                  <span className="font-medium">{episode.title}</span>
                </p>
              )}

              {episode.air_date && (
                <p className="text-xs text-gray-600">
                  Air date: {new Date(episode.air_date).toLocaleString()}
                </p>
              )}

              {episode.synopsis && (
                <p className="text-sm text-gray-700 mt-2">
                  {episode.synopsis}
                </p>
              )}

              {!episode.title && !episode.synopsis && (
                <p className="text-xs text-gray-500">
                  No title or synopsis has been added for this episode yet.
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
};

export default AnimeEpisodePage;
