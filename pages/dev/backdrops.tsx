// pages/dev/backdrops.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type AnimeSearchRow = {
  id: string;
  title: string | null;
  slug: string | null;
  image_url: string | null;
  banner_image_url: string | null;
};

type ArtworkRow = {
  id: string;
  anime_id: string;
  source: string | null;
  kind: string | null;
  url: string | null;
  lang: string | null;
  width: number | null;
  height: number | null;
  vote: number | null;
  is_primary: boolean | null;
  created_at: string | null;
};

export default function DevBackdropsPage() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<AnimeSearchRow[]>([]);

  const [selected, setSelected] = useState<AnimeSearchRow | null>(null);

  const [loadingBackdrops, setLoadingBackdrops] = useState(false);
  const [backdropsError, setBackdropsError] = useState<string | null>(null);
  const [backdrops, setBackdrops] = useState<ArtworkRow[]>([]);

  const canSearch = useMemo(() => query.trim().length >= 2, [query]);

  // --- Search anime (debounced) ---
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setSearchError(null);

      const q = query.trim();
      if (q.length < 2) {
        setResults([]);
        return;
      }

      setSearching(true);

      // Search by title and slug.
      // NOTE: ilike is Postgres case-insensitive match.
      const { data, error } = await supabase
        .from("anime")
        .select("id, title, slug, image_url, banner_image_url")
        .or(`title.ilike.%${q}%,slug.ilike.%${q}%`)
        .order("title", { ascending: true })
        .limit(20);

      if (cancelled) return;

      if (error) {
        setResults([]);
        setSearchError(error.message || "Search failed.");
      } else {
        setResults((data as AnimeSearchRow[]) ?? []);
      }

      setSearching(false);
    }

    const t = setTimeout(run, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  // --- Load backdrops for selected anime ---
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setBackdropsError(null);
      setBackdrops([]);

      if (!selected?.id) return;

      setLoadingBackdrops(true);

      const { data, error } = await supabase
        .from("anime_artwork")
        .select(
          "id, anime_id, source, kind, url, lang, width, height, vote, is_primary, created_at"
        )
        .eq("anime_id", selected.id)
        .eq("kind", "backdrop")
        .order("is_primary", { ascending: false })
        .order("vote", { ascending: false })
        .order("width", { ascending: false });

      if (cancelled) return;

      if (error) {
        setBackdrops([]);
        setBackdropsError(error.message || "Failed to load backdrops.");
      } else {
        setBackdrops((data as ArtworkRow[]) ?? []);
      }

      setLoadingBackdrops(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [selected?.id]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">
            Dev: Anime Backdrops
          </h1>
          <p className="text-sm text-gray-400">
            Search an anime, click it, then see all backdrops in{" "}
            <code className="text-xs">public.anime_artwork</code>.
          </p>
        </div>

        <Link
          href="/"
          className="text-sm font-medium text-blue-400 hover:text-blue-300"
        >
          ← Back home
        </Link>
      </div>

      {/* Search box */}
      <div className="mb-4">
        <label className="mb-1 block text-sm font-semibold text-gray-300">
          Search anime (title or slug)
        </label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type at least 2 characters…"
          className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500"
        />
        <div className="mt-1 text-xs text-gray-500">
          {searching ? "Searching…" : canSearch ? " " : "Type 2+ characters."}
        </div>

        {searchError && (
          <div className="mt-2 rounded-md border border-red-900 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            {searchError}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[22rem_1fr]">
        {/* Results list */}
        <div className="rounded-lg border border-gray-800 bg-black/20">
          <div className="border-b border-gray-800 px-3 py-2 text-sm font-semibold text-gray-200">
            Results
          </div>

          {results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-gray-500">
              {canSearch
                ? searching
                  ? "Searching…"
                  : "No matches."
                : "Search to see results."}
            </div>
          ) : (
            <div className="max-h-[28rem] overflow-auto">
              {results.map((r) => {
                const isActive = selected?.id === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelected(r)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${
                      isActive
                        ? "bg-blue-500/10"
                        : "hover:bg-gray-800/40"
                    }`}
                  >
                    {r.image_url ? (
                      <img
                        src={r.image_url}
                        alt=""
                        className="h-12 w-9 flex-shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="h-12 w-9 flex-shrink-0 rounded bg-gray-800" />
                    )}

                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-100">
                        {r.title || "(no title)"}
                      </div>
                      <div className="truncate text-xs text-gray-500">
                        {r.slug ? `/anime/${r.slug}` : "no slug"} • {r.id}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Backdrops panel */}
        <div className="rounded-lg border border-gray-800 bg-black/20">
          <div className="flex items-center justify-between border-b border-gray-800 px-3 py-2">
            <div>
              <div className="text-sm font-semibold text-gray-200">
                Backdrops
              </div>
              <div className="text-xs text-gray-500">
                {selected
                  ? `${selected.title || "(no title)"} • ${backdrops.length} found`
                  : "Select an anime to load backdrops."}
              </div>
            </div>

            {selected?.slug ? (
              <Link
                href={`/anime/${selected.slug}`}
                className="text-xs font-medium text-blue-400 hover:text-blue-300"
              >
                Open anime page →
              </Link>
            ) : null}
          </div>

          {backdropsError && (
            <div className="m-3 rounded-md border border-red-900 bg-red-950/30 px-3 py-2 text-sm text-red-200">
              {backdropsError}
            </div>
          )}

          {!selected ? (
            <div className="px-3 py-6 text-sm text-gray-500">
              Search and click an anime on the left.
            </div>
          ) : loadingBackdrops ? (
            <div className="px-3 py-6 text-sm text-gray-500">
              Loading backdrops…
            </div>
          ) : backdrops.length === 0 ? (
            <div className="px-3 py-6 text-sm text-gray-500">
              No backdrops found for this anime (kind = <code>backdrop</code>).
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 p-3 sm:grid-cols-2">
              {backdrops.map((b) => {
                const dims =
                  b.width && b.height ? `${b.width}×${b.height}` : "unknown";
                return (
                  <div
                    key={b.id}
                    className="overflow-hidden rounded-lg border border-gray-800 bg-black/30"
                  >
                    {b.url ? (
                      <img
                        src={b.url}
                        alt=""
                        className="block w-full"
                        style={{
                          // PURE image, no crop effect:
                          // we are not forcing a height, no object-cover
                          height: "auto",
                        }}
                      />
                    ) : (
                      <div className="flex h-40 items-center justify-center bg-gray-900 text-sm text-gray-500">
                        No URL
                      </div>
                    )}

                    <div className="border-t border-gray-800 px-3 py-2 text-xs text-gray-300">
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <span className="text-gray-400">id:</span>
                        <span className="font-mono">{b.id}</span>
                      </div>

                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        <span>
                          <span className="text-gray-400">dims:</span> {dims}
                        </span>
                        <span>
                          <span className="text-gray-400">vote:</span>{" "}
                          {typeof b.vote === "number" ? b.vote : "—"}
                        </span>
                        <span>
                          <span className="text-gray-400">primary:</span>{" "}
                          {b.is_primary ? "yes" : "no"}
                        </span>
                        <span>
                          <span className="text-gray-400">source:</span>{" "}
                          {b.source || "—"}
                        </span>
                        <span>
                          <span className="text-gray-400">lang:</span>{" "}
                          {b.lang || "—"}
                        </span>
                      </div>

                      {b.url ? (
                        <div className="mt-2 break-all text-[11px] text-gray-500">
                          {b.url}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 text-xs text-gray-500">
        If search returns nothing, check RLS on <code>public.anime</code>. If
        backdrops don’t load, check RLS on <code>public.anime_artwork</code>.
      </div>
    </div>
  );
}
