// pages/anime.tsx

import type { NextPage } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Anime } from "@/lib/types";
import { listAnime } from "@/lib/anime";

const AnimeListPage: NextPage = () => {
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      const { data, error } = await listAnime({
        limit: 200,
      });

      if (isCancelled) return;

      if (error) {
        console.error("Error loading anime list:", error);
        setAnimeList([]);
        setLoadError("Failed to load anime catalog.");
      } else {
        setAnimeList(data || []);
        setLoadError(null);
      }

      setIsLoading(false);
    };

    load();

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col">
        <header className="mb-6 flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-gray-900">Anime catalog</h1>
          <p className="text-sm text-gray-500">
            All anime imported into your database. This will eventually show
            everything.
          </p>
        </header>

        {isLoading && (
          <p className="text-sm text-gray-500">Loading anime…</p>
        )}

        {!isLoading && loadError && (
          <p className="text-sm text-red-500">{loadError}</p>
        )}

        {!isLoading && !loadError && animeList.length === 0 && (
          <p className="text-sm text-gray-500">
            No anime found yet. Try importing some from the AniList dev page.
          </p>
        )}

        {!isLoading && !loadError && animeList.length > 0 && (
          <section className="mt-2 space-y-3">
            {animeList.map((anime) => {
              const episodes =
                typeof anime.total_episodes === "number"
                  ? anime.total_episodes
                  : null;

              const score =
                typeof anime.average_score === "number"
                  ? (anime.average_score / 10).toFixed(1)
                  : null;

              return (
                <Link
                  key={anime.id}
                  href={`/anime/${anime.slug}`}
                  className="
                    group
                    flex
                    flex-col
                    gap-3
                    overflow-hidden
                    rounded-xl
                    border
                    border-gray-200
                    bg-white
                    p-3
                    shadow-sm
                    transition
                    hover:-translate-y-0.5
                    hover:border-blue-500
                    hover:shadow-md
                    sm:flex-row
                  "
                >
                  {/* Poster – small, fixed width */}
                  <div className="flex-shrink-0">
                    <div className="h-32 w-24 overflow-hidden rounded-md bg-gray-200">
                      {anime.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={anime.image_url}
                          alt={anime.title}
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gray-800 text-2xl font-semibold text-gray-300">
                          {anime.title.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div className="space-y-1">
                      <h2 className="line-clamp-2 text-sm font-semibold text-gray-900">
                        {anime.title}
                      </h2>
                      {anime.title_english && (
                        <p className="line-clamp-1 text-[11px] text-gray-500">
                          {anime.title_english}
                        </p>
                      )}
                    </div>

                    <div className="mt-2 space-y-1 text-[11px] text-gray-500">
                      <div className="flex flex-wrap gap-3">
                        {episodes !== null && (
                          <span>
                            Ep:{" "}
                            <span className="font-semibold text-gray-800">
                              {episodes}
                            </span>
                          </span>
                        )}

                        {anime.format && (
                          <span className="uppercase tracking-wide text-gray-600">
                            {anime.format}
                          </span>
                        )}

                        {anime.status && (
                          <span className="uppercase tracking-wide text-gray-600">
                            {anime.status}
                          </span>
                        )}
                      </div>

                      {score && (
                        <p>
                          Score:{" "}
                          <span className="font-semibold text-gray-800">
                            {score}/10
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
};

export default AnimeListPage;
