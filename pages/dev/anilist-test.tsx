// pages/dev/anilist-test.tsx
"use client";

import { useState } from "react";
import type { NextPage } from "next";

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

type ImportState = "idle" | "loading" | "success" | "error";

type UnifiedSearchItem = {
  source: "anilist" | "tmdb" | "tvdb";

  anilist_id?: number;
  tmdb_id?: number;
  tvdb_id?: number | null;

  title: string;
  year: number | null;

  poster_url?: string | null;
  backdrop_url?: string | null;

  overview?: string | null;

  // dev/debug only
  raw?: any;
};

type SearchResponse = {
  success: boolean;
  query: string;
  errors?: {
    anilist?: string | null;
    tmdb?: string | null;
    tvdb?: string | null;
  };
  results: UnifiedSearchItem[];
};

const AniListTestPage: NextPage = () => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const [results, setResults] = useState<UnifiedSearchItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [importStates, setImportStates] = useState<Record<string, ImportState>>(
    {}
  );
  const [importErrors, setImportErrors] = useState<Record<string, string>>({});

  function resultKey(item: UnifiedSearchItem) {
    const id =
      item.source === "anilist"
        ? item.anilist_id
        : item.source === "tmdb"
        ? item.tmdb_id
        : item.tvdb_id;

    return `${item.source}:${String(id ?? "unknown")}`;
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setImportStates({});
    setImportErrors({});

    try {
      const res = await fetch(
        `/api/admin/search-anime?q=${encodeURIComponent(q)}`
      );
      const json = (await res.json()) as SearchResponse;

      if (!res.ok || !json.success) {
        setError((json as any)?.error || "Search failed");
      } else {
        setResults(json.results || []);

        // Show a small warning if one source failed but others succeeded
        const errs = json.errors || {};
        const partialErrors = [errs.anilist, errs.tmdb, errs.tvdb].filter(
          Boolean
        );
        if (partialErrors.length > 0) {
          setError(
            `Partial search errors: ${[
              errs.anilist ? "AniList" : null,
              errs.tmdb ? "TMDB" : null,
              errs.tvdb ? "TVDB" : null,
            ]
              .filter(Boolean)
              .join(", ")}`
          );
        }
      }
    } catch (err) {
      console.error("Search error:", err);
      setError("Network error searching APIs");
    } finally {
      setLoading(false);
    }
  }

  async function handleImport(item: UnifiedSearchItem) {
    const key = resultKey(item);

    setImportStates((prev) => ({ ...prev, [key]: "loading" }));
    setImportErrors((prev) => ({ ...prev, [key]: "" }));

    try {
      // ✅ AniList keeps using your existing endpoint
      if (item.source === "anilist" && item.anilist_id) {
        const res = await fetch("/api/admin/import-anime-from-anilist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anilistId: item.anilist_id }),
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
          const msg = json.error || "Import failed";
          setImportStates((prev) => ({ ...prev, [key]: "error" }));
          setImportErrors((prev) => ({ ...prev, [key]: msg }));
        } else {
          setImportStates((prev) => ({ ...prev, [key]: "success" }));
        }

        return;
      }

      // ✅ TMDB + TVDB use the unified importer
      if (item.source === "tmdb" && item.tmdb_id) {
        const res = await fetch("/api/admin/import-anime", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "tmdb", sourceId: item.tmdb_id }),
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
          const msg = json.error || "TMDB import failed";
          setImportStates((prev) => ({ ...prev, [key]: "error" }));
          setImportErrors((prev) => ({ ...prev, [key]: msg }));
        } else {
          setImportStates((prev) => ({ ...prev, [key]: "success" }));
        }

        return;
      }

      if (item.source === "tvdb" && item.tvdb_id) {
        const res = await fetch("/api/admin/import-anime", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "tvdb", sourceId: item.tvdb_id }),
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
          const msg = json.error || "TVDB import failed";
          setImportStates((prev) => ({ ...prev, [key]: "error" }));
          setImportErrors((prev) => ({ ...prev, [key]: msg }));
        } else {
          setImportStates((prev) => ({ ...prev, [key]: "success" }));
        }

        return;
      }

      setImportStates((prev) => ({ ...prev, [key]: "error" }));
      setImportErrors((prev) => ({
        ...prev,
        [key]: "Missing source id; cannot import.",
      }));
    } catch (err) {
      console.error("Import error:", err);
      setImportStates((prev) => ({ ...prev, [key]: "error" }));
      setImportErrors((prev) => ({
        ...prev,
        [key]: "Network error importing",
      }));
    }
  }

  function sourceBadge(source: UnifiedSearchItem["source"]) {
    if (source === "anilist") return "AniList";
    if (source === "tmdb") return "TMDB";
    return "TVDB";
  }

  function sourceColor(source: UnifiedSearchItem["source"]) {
    if (source === "anilist")
      return "bg-indigo-700/40 text-indigo-200 border-indigo-700";
    if (source === "tmdb")
      return "bg-emerald-700/40 text-emerald-200 border-emerald-700";
    return "bg-amber-700/40 text-amber-200 border-amber-700";
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Anime Import Search (dev test)</h1>
      <p className="text-sm text-gray-400 mb-4">
        Searches AniList + TMDB + TVDB together (one request). Import wired for
        AniList, TMDB, and TVDB.
      </p>

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
        <div className="mb-4 rounded-md border border-yellow-700 bg-yellow-950/50 px-3 py-2 text-sm text-yellow-200">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-5">
          {results.map((item) => {
            const key = resultKey(item);
            const importState = importStates[key] ?? "idle";
            const importError = importErrors[key];

            const yearText = item.year ?? "?";
            const overview = item.overview
              ? truncate(item.overview.replace(/\s+/g, " "), 260)
              : "No description.";

            const posterUrl = item.poster_url ?? null;
            const bannerUrl = item.backdrop_url ?? null;

            const canImport =
              (item.source === "anilist" && !!item.anilist_id) ||
              (item.source === "tmdb" && !!item.tmdb_id) ||
              (item.source === "tvdb" && !!item.tvdb_id);

            const importLabel =
              item.source === "anilist"
                ? "Import (AniList)"
                : item.source === "tmdb"
                ? "Import (TMDB)"
                : "Import (TVDB)";

            const importDisabled = importState === "loading" || !canImport;

            return (
              <div
                key={key}
                className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900/70"
              >
                {bannerUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={bannerUrl}
                    alt={`${item.title} banner`}
                    className="h-32 w-full object-cover"
                  />
                )}

                <div className="flex gap-3 p-3">
                  <div className="h-28 w-20 flex-shrink-0 overflow-hidden rounded-md bg-gray-800">
                    {posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={posterUrl}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-gray-200">
                        {item.title?.[0] ?? "?"}
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <p className="text-sm font-semibold text-gray-100">
                        {item.title}
                      </p>

                      <span className="text-[11px] text-gray-400">
                        {yearText}
                      </span>

                      <span
                        className={`ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${sourceColor(
                          item.source
                        )}`}
                      >
                        {sourceBadge(item.source)}
                      </span>
                    </div>

                    <p className="mb-2 text-[11px] leading-snug text-gray-300">
                      {overview}
                    </p>

                    <div className="mt-3 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleImport(item)}
                        disabled={importDisabled}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-600/60"
                      >
                        {importState === "loading"
                          ? "Importing..."
                          : importLabel}
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

                    <p className="mt-2 text-[10px] text-gray-500">
                      Source ID:{" "}
                      <span className="font-mono">
                        {item.source === "anilist"
                          ? item.anilist_id
                          : item.source === "tmdb"
                          ? item.tmdb_id
                          : item.tvdb_id}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && results.length === 0 && (
        <p className="text-sm text-gray-500 mt-4">
          Try searching for something to see results from all sources.
        </p>
      )}
    </div>
  );
};

export default AniListTestPage;
