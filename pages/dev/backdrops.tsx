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
  anilist_id: number | null;
};

type ArtworkRow = {
  id: string;
  anime_id: string;
  source: string | null;
  kind: string | number | null;
  url: string | null;
  lang: string | null;
  width: number | null;
  height: number | null;
  vote: number | null;
  is_primary: boolean | null;
  created_at: string | null;
};

type EpisodeRow = {
  id: string;
  anime_id: string;
  episode_number: number | null;
  title: string | null;
};

type EpisodeArtworkRow = {
  id: string;
  anime_episode_id: string;
  source: string | null;
  kind: string | number | null;
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

  // ✅ track all anime ids that represent “the same anime”
  const [selectedAnimeIds, setSelectedAnimeIds] = useState<string[]>([]);

  // --- Anime backdrops ---
  const [loadingBackdrops, setLoadingBackdrops] = useState(false);
  const [backdropsError, setBackdropsError] = useState<string | null>(null);
  const [backdrops, setBackdrops] = useState<ArtworkRow[]>([]);

  // --- Episodes ---
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [episodesError, setEpisodesError] = useState<string | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeRow[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<EpisodeRow | null>(
    null
  );

  // --- Episode artwork ---
  const [loadingEpisodeArtwork, setLoadingEpisodeArtwork] = useState(false);
  const [episodeArtworkError, setEpisodeArtworkError] = useState<string | null>(
    null
  );
  const [episodeArtwork, setEpisodeArtwork] = useState<EpisodeArtworkRow[]>([]);

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

      const { data, error } = await supabase
        .from("anime")
        .select("id, title, slug, image_url, banner_image_url, anilist_id")
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

  // --- Resolve “same anime” ids (by anilist_id) whenever selection changes ---
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setSelectedAnimeIds([]);
      setEpisodes([]);
      setSelectedEpisode(null);
      setEpisodeArtwork([]);
      setBackdrops([]);

      if (!selected?.id) return;

      let animeIds: string[] = [selected.id];

      if (typeof selected.anilist_id === "number") {
        const { data: rows, error: rowsErr } = await supabase
          .from("anime")
          .select("id")
          .eq("anilist_id", selected.anilist_id);

        if (!rowsErr && rows && rows.length > 0) {
          animeIds = rows.map((r: any) => r.id);
        }
      }

      if (cancelled) return;
      setSelectedAnimeIds(animeIds);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [selected?.id, selected?.anilist_id]);

  // --- Load backdrops for selected anime (across same-anime ids) ---
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setBackdropsError(null);
      setBackdrops([]);

      if (!selected?.id) return;
      if (selectedAnimeIds.length === 0) return;

      setLoadingBackdrops(true);

      const { data, error } = await supabase
        .from("anime_artwork")
        .select(
          "id, anime_id, source, kind, url, lang, width, height, vote, is_primary, created_at"
        )
        .in("anime_id", selectedAnimeIds)
        .in("kind", ["backdrop", "3"])
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
  }, [selected?.id, selectedAnimeIds]);

  // --- Load episodes for selected anime (across same-anime ids) ---
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setEpisodesError(null);
      setEpisodes([]);
      setSelectedEpisode(null);

      if (!selected?.id) return;
      if (selectedAnimeIds.length === 0) return;

      setLoadingEpisodes(true);

      const { data, error } = await supabase
        .from("anime_episodes")
        .select("id, anime_id, episode_number, title")
        .in("anime_id", selectedAnimeIds)
        .order("episode_number", { ascending: true })
        .limit(500);

      if (cancelled) return;

      if (error) {
        setEpisodes([]);
        setEpisodesError(error.message || "Failed to load episodes.");
      } else {
        const rows = ((data as EpisodeRow[]) ?? []).slice();

        // If duplicates exist (because duplicate anime rows exist), de-dupe by episode_number when possible.
        const seen = new Set<string>();
        const deduped: EpisodeRow[] = [];
        for (const e of rows) {
          const key =
            typeof e.episode_number === "number"
              ? `n:${e.episode_number}`
              : `id:${e.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          deduped.push(e);
        }

        setEpisodes(deduped);

        // Auto-select ep 1 (or first row) for convenience
        const first =
          deduped.find((x) => x.episode_number === 1) ?? deduped[0] ?? null;
        setSelectedEpisode(first);
      }

      setLoadingEpisodes(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [selected?.id, selectedAnimeIds]);

  // --- Load episode artwork for selected episode ---
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setEpisodeArtworkError(null);
      setEpisodeArtwork([]);

      if (!selectedEpisode?.id) return;

      setLoadingEpisodeArtwork(true);

      const { data, error } = await supabase
        .from("anime_episode_artwork")
        .select(
          "id, anime_episode_id, source, kind, url, lang, width, height, vote, is_primary, created_at"
        )
        .eq("anime_episode_id", selectedEpisode.id)
        .order("is_primary", { ascending: false })
        .order("vote", { ascending: false })
        .order("width", { ascending: false });

      if (cancelled) return;

      if (error) {
        setEpisodeArtwork([]);
        setEpisodeArtworkError(
          error.message || "Failed to load episode artwork."
        );
      } else {
        setEpisodeArtwork((data as EpisodeArtworkRow[]) ?? []);
      }

      setLoadingEpisodeArtwork(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [selectedEpisode?.id]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">
            Dev: Anime + Episode Artwork
          </h1>
          <p className="text-sm text-gray-400">
            Search an anime, click it, then inspect artwork in{" "}
            <code className="text-xs">public.anime_artwork</code> and{" "}
            <code className="text-xs">public.anime_episode_artwork</code>.
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

      {/* 3-column layout: Results / Episodes / Artwork */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[22rem_18rem_1fr]">
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
            <div className="max-h-[34rem] overflow-auto">
              {results.map((r) => {
                const isActive = selected?.id === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelected(r)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${
                      isActive ? "bg-blue-500/10" : "hover:bg-gray-800/40"
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
                      <div className="truncate text-[11px] text-gray-600">
                        anilist_id:{" "}
                        {typeof r.anilist_id === "number" ? r.anilist_id : "—"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Episodes list */}
        <div className="rounded-lg border border-gray-800 bg-black/20">
          <div className="border-b border-gray-800 px-3 py-2">
            <div className="text-sm font-semibold text-gray-200">Episodes</div>
            <div className="text-xs text-gray-500">
              {selected
                ? `${selected.title || "(no title)"} • ${episodes.length} loaded`
                : "Select an anime to load episodes."}
            </div>
          </div>

          {episodesError && (
            <div className="m-3 rounded-md border border-red-900 bg-red-950/30 px-3 py-2 text-sm text-red-200">
              {episodesError}
            </div>
          )}

          {!selected ? (
            <div className="px-3 py-6 text-sm text-gray-500">
              Search and click an anime first.
            </div>
          ) : loadingEpisodes ? (
            <div className="px-3 py-6 text-sm text-gray-500">
              Loading episodes…
            </div>
          ) : episodes.length === 0 ? (
            <div className="px-3 py-6 text-sm text-gray-500">
              No episodes found in <code>public.anime_episodes</code>.
            </div>
          ) : (
            <div className="max-h-[34rem] overflow-auto">
              {episodes.map((e) => {
                const isActive = selectedEpisode?.id === e.id;
                const epNum =
                  typeof e.episode_number === "number"
                    ? `Ep ${e.episode_number}`
                    : "Ep ?";
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setSelectedEpisode(e)}
                    className={`w-full px-3 py-2 text-left transition ${
                      isActive ? "bg-blue-500/10" : "hover:bg-gray-800/40"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="truncate text-sm font-semibold text-gray-100">
                        {epNum}
                      </div>
                      <div className="text-[11px] text-gray-500 font-mono">
                        {e.id.slice(0, 8)}…
                      </div>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-gray-400">
                      {e.title || "(no episode title)"}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Artwork panels */}
        <div className="rounded-lg border border-gray-800 bg-black/20">
          <div className="border-b border-gray-800 px-3 py-2">
            <div className="text-sm font-semibold text-gray-200">Artwork</div>
            <div className="text-xs text-gray-500">
              {selectedEpisode
                ? `Episode artwork: ${
                    typeof selectedEpisode.episode_number === "number"
                      ? `Ep ${selectedEpisode.episode_number}`
                      : "Episode"
                  } • ${episodeArtwork.length} found`
                : selected
                ? `Anime backdrops: ${backdrops.length} found`
                : "Select an anime (and an episode) to inspect artwork."}
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {selected?.slug ? (
                <Link
                  href={`/anime/${selected.slug}`}
                  className="text-xs font-medium text-blue-400 hover:text-blue-300"
                >
                  Open anime page →
                </Link>
              ) : null}

              {selected?.slug && selectedEpisode?.episode_number ? (
                <Link
                  href={`/anime/${selected.slug}/episode/${selectedEpisode.episode_number}`}
                  className="text-xs font-medium text-blue-400 hover:text-blue-300"
                >
                  Open episode page →
                </Link>
              ) : null}
            </div>
          </div>

          {/* Episode artwork errors */}
          {episodeArtworkError && (
            <div className="m-3 rounded-md border border-red-900 bg-red-950/30 px-3 py-2 text-sm text-red-200">
              {episodeArtworkError}
            </div>
          )}

          {/* Backdrops errors */}
          {backdropsError && (
            <div className="m-3 rounded-md border border-red-900 bg-red-950/30 px-3 py-2 text-sm text-red-200">
              {backdropsError}
            </div>
          )}

          {!selected ? (
            <div className="px-3 py-6 text-sm text-gray-500">
              Search and click an anime.
            </div>
          ) : (
            <div className="p-3 space-y-6">
              {/* Anime backdrops section */}
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <div className="text-sm font-semibold text-gray-200">
                    Anime Backdrops
                  </div>
                  <div className="text-xs text-gray-500">
                    {loadingBackdrops ? "Loading…" : `${backdrops.length} found`}
                  </div>
                </div>

                {loadingBackdrops ? (
                  <div className="text-sm text-gray-500">
                    Loading backdrops…
                  </div>
                ) : backdrops.length === 0 ? (
                  <div className="text-sm text-gray-500">
                    No backdrops found (kind = <code>backdrop</code> or{" "}
                    <code>3</code>).
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {backdrops.map((b) => {
                      const dims =
                        b.width && b.height
                          ? `${b.width}×${b.height}`
                          : "unknown";
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
                              style={{ height: "auto" }}
                            />
                          ) : (
                            <div className="flex h-40 items-center justify-center bg-gray-900 text-sm text-gray-500">
                              No URL
                            </div>
                          )}

                          <div className="border-t border-gray-800 px-3 py-2 text-xs text-gray-300">
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                              <span>
                                <span className="text-gray-400">dims:</span>{" "}
                                {dims}
                              </span>
                              <span>
                                <span className="text-gray-400">kind:</span>{" "}
                                {b.kind === null || b.kind === undefined
                                  ? "—"
                                  : String(b.kind)}{" "}
                                <span className="text-gray-500">
                                  ({typeof b.kind})
                                </span>
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

              {/* Episode artwork section */}
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <div className="text-sm font-semibold text-gray-200">
                    Episode Artwork
                  </div>
                  <div className="text-xs text-gray-500">
                    {selectedEpisode
                      ? loadingEpisodeArtwork
                        ? "Loading…"
                        : `${episodeArtwork.length} found`
                      : "Select an episode"}
                  </div>
                </div>

                {!selectedEpisode ? (
                  <div className="text-sm text-gray-500">
                    Pick an episode in the middle panel.
                  </div>
                ) : loadingEpisodeArtwork ? (
                  <div className="text-sm text-gray-500">
                    Loading episode artwork…
                  </div>
                ) : episodeArtwork.length === 0 ? (
                  <div className="text-sm text-gray-500">
                    No episode artwork found in{" "}
                    <code>public.anime_episode_artwork</code> for this episode.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {episodeArtwork.map((b) => {
                      const dims =
                        b.width && b.height
                          ? `${b.width}×${b.height}`
                          : "unknown";
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
                              style={{ height: "auto" }}
                            />
                          ) : (
                            <div className="flex h-40 items-center justify-center bg-gray-900 text-sm text-gray-500">
                              No URL
                            </div>
                          )}

                          <div className="border-t border-gray-800 px-3 py-2 text-xs text-gray-300">
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                              <span>
                                <span className="text-gray-400">dims:</span>{" "}
                                {dims}
                              </span>
                              <span>
                                <span className="text-gray-400">kind:</span>{" "}
                                {b.kind === null || b.kind === undefined
                                  ? "—"
                                  : String(b.kind)}{" "}
                                <span className="text-gray-500">
                                  ({typeof b.kind})
                                </span>
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
          )}
        </div>
      </div>

      <div className="mt-6 text-xs text-gray-500">
        If search returns nothing, check RLS on <code>public.anime</code>. If
        backdrops don’t load, check RLS on <code>public.anime_artwork</code>. If
        episodes don’t load, check RLS on{" "}
        <code>public.anime_episodes</code>. If episode artwork doesn’t load,
        check RLS on <code>public.anime_episode_artwork</code>.
      </div>
    </div>
  );
}
