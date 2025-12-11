// pages/dev/anilist-test.tsx

import { useState } from "react";
import type { NextPage } from "next";
import { searchAniListAnime, type AniListAnime } from "@/lib/anilist";

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

type ImportState = "idle" | "loading" | "success" | "error";

const AniListTestPage: NextPage = () => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AniListAnime[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importStates, setImportStates] = useState<Record<number, ImportState>>(
    {}
  );
  const [importErrors, setImportErrors] = useState<Record<number, string>>({});

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setImportStates({});
    setImportErrors({});

    const { data, error } = await searchAniListAnime(query.trim(), 1, 10);

    if (error) {
      setError(error);
    } else {
      setResults(data);
    }

    setLoading(false);
  }

  async function handleImport(anime: AniListAnime) {
    const id = anime.id;

    setImportStates((prev) => ({ ...prev, [id]: "loading" }));
    setImportErrors((prev) => ({ ...prev, [id]: "" }));

    try {
      const res = await fetch("/api/admin/import-anime-from-anilist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // If you set ANILIST_IMPORT_SECRET, you can also send it here:
          // "x-import-secret": "your-secret",
        },
        body: JSON.stringify({ anilistId: id }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        const msg = json.error || "Import failed";
        setImportStates((prev) => ({ ...prev, [id]: "error" }));
        setImportErrors((prev) => ({ ...prev, [id]: msg }));
      } else {
        setImportStates((prev) => ({ ...prev, [id]: "success" }));
      }
    } catch (err) {
      console.error("Import error:", err);
      setImportStates((prev) => ({ ...prev, [id]: "error" }));
      setImportErrors((prev) => ({
        ...prev,
        [id]: "Network error importing anime",
      }));
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">AniList Search (dev test)</h1>

      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <input
          type="text"
          className="flex-1 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
          placeholder="Search for an anime (e.g. Attack on Titan)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-blue-600/60 hover:bg-blue-500"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {error && (
        <div className="mb-4 rounded-md border border-red-700 bg-red-950/60 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-5">
          {results.map((anime) => {
            const displayTitle =
              anime.title.romaji ||
              anime.title.english ||
              anime.title.native ||
              "Untitled";

            const year = anime.seasonYear ?? "?";
            const season = anime.season ?? "?";
            const episodes = anime.episodes ?? null;

            const genres = anime.genres ?? [];
            const genreText = genres.join(", ");

            const nonSpoilerTags =
              anime.tags?.filter((t) => !t.isMediaSpoiler) ?? [];
            const tagNames = nonSpoilerTags.map((t) => t.name);
            const tagText = tagNames.join(", ");

            const description = anime.description
              ? truncate(anime.description.replace(/\s+/g, " "), 260)
              : "No description.";

            let trailerUrl: string | null = null;
            if (anime.trailer?.site === "youtube" && anime.trailer.id) {
              trailerUrl = `https://www.youtube.com/watch?v=${anime.trailer.id}`;
            }

            const score =
              typeof anime.averageScore === "number"
                ? (anime.averageScore / 10).toFixed(1)
                : null;

            const importState = importStates[anime.id] ?? "idle";
            const importError = importErrors[anime.id];

            return (
              <div
                key={anime.id}
                className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900/70"
              >
                {/* Banner (if available) */}
                {anime.bannerImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={anime.bannerImage}
                    alt={`${displayTitle} banner`}
                    className="h-32 w-full object-cover"
                  />
                )}

                <div className="flex gap-3 p-3">
                  {/* Poster */}
                  <div className="h-28 w-20 flex-shrink-0 overflow-hidden rounded-md bg-gray-800">
                    {anime.coverImage?.medium ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={anime.coverImage.medium}
                        alt={displayTitle}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-gray-200">
                        {displayTitle[0]}
                      </div>
                    )}
                  </div>

                  {/* Main info */}
                  <div className="flex-1">
                    <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <p className="text-sm font-semibold text-gray-100">
                        {displayTitle}
                      </p>
                      <span className="text-[11px] text-gray-400">
                        {season} {year}
                      </span>
                    </div>

                    {/* Meta row: episodes / format / status / score */}
                    <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-gray-400">
                      <span>
                        Episodes:{" "}
                          <span className="font-semibold text-gray-200">
                          {episodes ?? "Unknown"}
                        </span>
                      </span>
                      {anime.format && (
                        <span>
                          Format:{" "}
                          <span className="font-semibold text-gray-200">
                            {anime.format}
                          </span>
                        </span>
                      )}
                      {anime.status && (
                        <span>
                          Status:{" "}
                          <span className="font-semibold text-gray-200">
                            {anime.status}
                          </span>
                        </span>
                      )}
                      {score && (
                        <span>
                          Score:{" "}
                          <span className="font-semibold text-gray-200">
                            {score}/10
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <p className="mb-2 text-[11px] leading-snug text-gray-300">
                      {description}
                    </p>

                    {/* Genres & tags */}
                    <div className="mb-2 flex flex-wrap gap-2">
                      {genreText && (
                        <span className="rounded-full bg-gray-800 px-2 py-1 text-[10px] text-gray-200">
                          Genres: {genreText}
                        </span>
                      )}
                      {tagText && (
                        <span className="rounded-full bg-gray-800 px-2 py-1 text-[10px] text-gray-200">
                          Tags: {tagText}
                        </span>
                      )}
                    </div>

                    {/* Trailer link */}
                    {trailerUrl && (
                      <a
                        href={trailerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center text-[11px] text-blue-400 hover:text-blue-300"
                      >
                        Watch trailer on YouTube ↗
                      </a>
                    )}

                    {/* Import button + status */}
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleImport(anime)}
                        disabled={importState === "loading"}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-600/60"
                      >
                        {importState === "loading"
                          ? "Importing..."
                          : "Import into catalog"}
                      </button>

                      {importState === "success" && (
                        <span className="text-[11px] text-emerald-400">
                          Imported!
                        </span>
                      )}

                      {importState === "error" && importError && (
                        <span className="text-[11px] text-red-400">
                          {importError}
                        </span>
                      )}
                    </div>

                    {/* Footer ID for debugging */}
                    <p className="mt-2 text-[10px] text-gray-500">
                      AniList ID:{" "}
                      <span className="font-mono">{anime.id}</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && results.length === 0 && (
        <p className="text-sm text-gray-500 mt-4">
          Try searching for something to see AniList results.
        </p>
      )}
    </div>
  );
};

export default AniListTestPage;
