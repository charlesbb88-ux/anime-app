// pages/anime/[slug].tsx

import { useEffect, useMemo, useState } from "react";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import Link from "next/link";
import FeedShell from "@/components/FeedShell";

import { getAnimeBySlug } from "@/lib/anime";
import type { Anime } from "@/lib/types";
import { supabase } from "@/lib/supabaseClient";

import EpisodeNavigator from "@/components/EpisodeNavigator";
import CharacterNavigator from "@/components/CharacterNavigator";
import PostFeed from "../../components/PostFeed";

import GlobalLogModal from "@/components/reviews/GlobalLogModal";

import AnimeMetaBox from "@/components/anime/AnimeMetaBox";
import AnimeQuickLogBox from "@/components/anime/AnimeQuickLogBox";

import ActionBox from "@/components/actions/ActionBox";

import ResponsiveSwitch from "@/components/ResponsiveSwitch";
import AnimePhoneLayout from "@/components/anime/AnimePhoneLayout";

import EnglishTitle from "@/components/EnglishTitle";
import { FALLBACK_BACKDROP_SRC } from "@/lib/fallbacks";
import { pickEnglishTitle } from "@/lib/pickEnglishTitle";

type AnimeTag = {
  id: number;
  anime_id: string;
  name: string;
  description: string | null;
  rank: number | null;
  is_adult: boolean | null;
  is_general_spoiler: boolean | null;
  is_media_spoiler: boolean | null;
  category: string | null;
};

const TRANSPARENT_BACKDROP_DATA_URI =
  "data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=";

function normalizeBackdropUrl(url: string): string {
  if (!url) return url;

  if (url.includes("https://image.tmdb.org/t/p/")) {
    if (url.includes("/t/p/original/")) {
      return url.replace("/t/p/original/", "/t/p/w1280/");
    }
  }

  return url;
}

function cleanSynopsis(raw: string) {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\(Source:.*?\)/gi, "")
    .replace(/<\/?i>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n[ \t]+\n/g, "\n\n")
    .trim();
}

function firstString(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" ? first : "";
  }
  return "";
}

function firstChar(value: string): string {
  return value.length > 0 ? value.charAt(0) : "?";
}

function getAnimeBackdropUrlsStorageKey(animeId: string): string {
  return `anime_backdrop_urls_${animeId}`;
}

function getAnimeBackdropIndexStorageKey(animeId: string): string {
  return `anime_backdrop_index_${animeId}`;
}

function readStoredAnimeBackdropUrls(animeId: string): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.sessionStorage.getItem(
      getAnimeBackdropUrlsStorageKey(animeId)
    );
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const urls: string[] = [];
    for (const item of parsed) {
      if (typeof item === "string") {
        const trimmed = item.trim();
        if (trimmed.length > 0) {
          urls.push(trimmed);
        }
      }
    }

    return urls;
  } catch {
    return [];
  }
}

function writeStoredAnimeBackdropUrls(animeId: string, urls: string[]): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      getAnimeBackdropUrlsStorageKey(animeId),
      JSON.stringify(urls)
    );
  } catch {}
}

function getNextRotatingAnimeBackdrop(
  animeId: string,
  urls: string[]
): string | null {
  const firstUrl = urls.find((u) => typeof u === "string" && u.length > 0);
  if (!firstUrl) return null;

  if (typeof window === "undefined") {
    return firstUrl;
  }

  try {
    const key = getAnimeBackdropIndexStorageKey(animeId);
    const raw = window.sessionStorage.getItem(key);
    const prevIndex = raw !== null ? Number(raw) : -1;
    const safePrevIndex =
      Number.isFinite(prevIndex) && prevIndex >= -1 ? prevIndex : -1;

    const nextIndex = (safePrevIndex + 1) % urls.length;
    const maybeUrl = urls[nextIndex];
    const nextUrl =
      typeof maybeUrl === "string" && maybeUrl.length > 0 ? maybeUrl : firstUrl;

    window.sessionStorage.setItem(key, String(nextIndex));
    return nextUrl;
  } catch {
    return firstUrl;
  }
}

function getSeriesPosterUrl(anime: Anime | null): string | null {
  const raw = anime?.image_url;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

function AnimeSeriesInstantShell() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-0 pb-8">
      <div className="relative h-[620px] w-full overflow-hidden bg-gray-200">
        <img
          src="/overlays/my-overlay.png"
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      </div>

      <div className="-mt-5 relative z-10 px-3">
        <div className="mb-8 flex flex-row gap-7">
          <div className="flex-shrink-0 w-56">
            <div className="h-84 w-56 rounded-md border-3 border-black/10 bg-gray-300 animate-pulse" />

            <div className="mt-4 flex flex-wrap gap-2">
              <div className="h-6 w-20 rounded-full bg-gray-200 animate-pulse" />
              <div className="h-6 w-24 rounded-full bg-gray-200 animate-pulse" />
              <div className="h-6 w-16 rounded-full bg-gray-200 animate-pulse" />
            </div>

            <div className="mt-5 space-y-2">
              <div className="h-7 w-16 rounded bg-gray-200 animate-pulse" />
              <div className="h-7 w-full rounded-full bg-gray-200 animate-pulse" />
              <div className="h-7 w-[92%] rounded-full bg-gray-200 animate-pulse" />
              <div className="h-7 w-[84%] rounded-full bg-gray-200 animate-pulse" />
            </div>

            <div className="mt-4 rounded-md bg-gray-100/60 p-3">
              <div className="space-y-3">
                <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
                <div className="h-4 w-full rounded bg-gray-200 animate-pulse" />
                <div className="h-4 w-[88%] rounded bg-gray-200 animate-pulse" />
                <div className="h-4 w-[76%] rounded bg-gray-200 animate-pulse" />
              </div>
            </div>
          </div>

          <div className="min-w-100 flex-1">
            <div className="mt-2 h-12 w-[420px] max-w-full rounded bg-gray-300 animate-pulse" />

            <div className="relative w-full">
              <div className="absolute right-0 top-6 flex flex-col items-end gap-2">
                <div className="h-12 w-[220px] rounded bg-gray-200 animate-pulse" />
                <div className="h-24 w-[220px] rounded bg-gray-200 animate-pulse" />
              </div>

              <div className="min-w-0 pr-[270px] pl-1">
                <div className="mt-6 mb-3 space-y-3">
                  <div className="h-4 w-full rounded bg-gray-200 animate-pulse" />
                  <div className="h-4 w-[96%] rounded bg-gray-200 animate-pulse" />
                  <div className="h-4 w-[90%] rounded bg-gray-200 animate-pulse" />
                  <div className="h-4 w-[84%] rounded bg-gray-200 animate-pulse" />
                </div>

                <div className="mt-4 h-12 w-full rounded bg-gray-200 animate-pulse" />
                <div className="mt-4 h-12 w-full rounded bg-gray-200 animate-pulse" />

                <div className="mt-6 rounded-md bg-gray-100/60 p-4">
                  <div className="space-y-3">
                    <div className="h-4 w-full rounded bg-gray-200 animate-pulse" />
                    <div className="h-4 w-[96%] rounded bg-gray-200 animate-pulse" />
                    <div className="h-4 w-[88%] rounded bg-gray-200 animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="h-4 w-20 rounded bg-gray-200 animate-pulse" />
      </div>
    </div>
  );
}

const AnimePage: NextPage = () => {
  const router = useRouter();
  const slug = useMemo(() => firstString(router.query.slug), [router.query.slug]);

  const [anime, setAnime] = useState<Anime | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [tags, setTags] = useState<AnimeTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [showSpoilers, setShowSpoilers] = useState(false);

  const [feedNonce, setFeedNonce] = useState(0);
  const [actionBoxNonce, setActionBoxNonce] = useState(0);

  const [logOpen, setLogOpen] = useState(false);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  const [selectedEpisodeNumber, setSelectedEpisodeNumber] = useState<number | null>(
    null
  );

  const [episodeLogsNonce, setEpisodeLogsNonce] = useState(0);
  const [quickLogRefreshToken, setQuickLogRefreshToken] = useState(0);

  const [backdropUrl, setBackdropUrl] = useState<string | null>(null);
  const [backdropResolved, setBackdropResolved] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;

    if (!slug) {
      setAnime(null);
      setLoading(false);
      setErrorMessage("Anime not found.");
      setBackdropUrl(null);
      setBackdropResolved(true);
      return;
    }

    let isMounted = true;

    async function run() {
      setLoading(true);
      setErrorMessage(null);
      setShowSpoilers(false);
      setBackdropUrl(null);
      setBackdropResolved(false);

      const { data, error } = await getAnimeBySlug(slug);

      if (!isMounted) return;

      if (error || !data) {
        console.error("Error fetching anime by slug", error);
        setAnime(null);
        setErrorMessage("Anime not found.");
      } else {
        setAnime(data);
      }

      setLoading(false);
    }

    run();

    return () => {
      isMounted = false;
    };
  }, [router.isReady, slug]);

  useEffect(() => {
    if (!anime?.id) {
      setBackdropUrl(null);
      setBackdropResolved(true);
      return;
    }

    const animeId = anime.id;
    let cancelled = false;

    async function run() {
      setBackdropResolved(false);

      const storedUrls = readStoredAnimeBackdropUrls(animeId);

      if (storedUrls.length > 0) {
        const immediatePick = getNextRotatingAnimeBackdrop(animeId, storedUrls);

        if (!cancelled) {
          setBackdropUrl(
            typeof immediatePick === "string"
              ? normalizeBackdropUrl(immediatePick)
              : null
          );
          setBackdropResolved(true);
        }
        return;
      }

      const { data: arts, error: artErr } = await supabase
        .from("anime_artwork")
        .select("url, is_primary, vote, width")
        .eq("anime_id", animeId)
        .in("kind", ["backdrop", "3"])
        .limit(50);

      if (cancelled) return;

      if (!artErr && Array.isArray(arts) && arts.length > 0) {
        const sorted = [...arts].sort((a: any, b: any) => {
          const ap = a.is_primary ? 1 : 0;
          const bp = b.is_primary ? 1 : 0;
          if (bp !== ap) return bp - ap;

          const av = typeof a.vote === "number" ? a.vote : -1;
          const bv = typeof b.vote === "number" ? b.vote : -1;
          if (bv !== av) return bv - av;

          const aw = typeof a.width === "number" ? a.width : -1;
          const bw = typeof b.width === "number" ? b.width : -1;
          return bw - aw;
        });

        const topN = sorted.slice(0, Math.min(12, sorted.length));
        const urls: string[] = [];

        for (const row of topN as Array<{ url?: unknown }>) {
          if (typeof row?.url === "string") {
            const trimmed = row.url.trim();
            if (trimmed.length > 0) {
              urls.push(trimmed);
            }
          }
        }

        if (urls.length > 0) {
          writeStoredAnimeBackdropUrls(animeId, urls);

          const pick = getNextRotatingAnimeBackdrop(animeId, urls);

          setBackdropUrl(
            typeof pick === "string" ? normalizeBackdropUrl(pick) : null
          );
          setBackdropResolved(true);
          return;
        }
      }

      const seriesPosterUrl = getSeriesPosterUrl(anime);
      if (seriesPosterUrl) {
        setBackdropUrl(seriesPosterUrl);
        setBackdropResolved(true);
        return;
      }

      setBackdropUrl(FALLBACK_BACKDROP_SRC);
      setBackdropResolved(true);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [anime, anime?.id]);

  useEffect(() => {
    const animeId = anime?.id;
    if (!animeId) {
      setTags([]);
      return;
    }

    let isMounted = true;

    async function run() {
      setTagsLoading(true);

      const { data, error } = await supabase
        .from("anime_tags")
        .select(
          "id, anime_id, name, description, rank, is_adult, is_general_spoiler, is_media_spoiler, category"
        )
        .eq("anime_id", animeId)
        .order("rank", { ascending: false });

      if (!isMounted) return;

      if (error || !data) {
        console.error("Error fetching anime_tags", error);
        setTags([]);
      } else {
        setTags(data as AnimeTag[]);
      }

      setTagsLoading(false);
    }

    run();

    return () => {
      isMounted = false;
    };
  }, [anime?.id]);

  if (!router.isReady || loading) {
    return <AnimeSeriesInstantShell />;
  }

  if (!anime) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="mb-4 text-2xl font-bold">Anime not found</h1>
        {errorMessage ? <p className="mb-2 text-gray-300">{errorMessage}</p> : null}
        <p className="mb-4 text-gray-400">
          We couldn&apos;t find an anime with that URL.
        </p>
      </div>
    );
  }

  const a: any = anime;

  const picked = pickEnglishTitle(
    {
      title_english: (anime as any).title_english,
      title_preferred: (anime as any).title_preferred,
      title: anime.title,
      title_native: (anime as any).title_native,
    },
    {
      preferredKeys: ["title_english", "title_preferred", "title"],
      fallbackKeys: ["title_preferred", "title", "title_native", "title_english"],
      minScore: 0.55,
    }
  );

  const displayPrimaryTitle = picked?.value ?? anime.title ?? "Untitled";

  const hasGenres = Array.isArray(a.genres) && a.genres.length > 0;
  const genres: string[] = Array.isArray(a.genres) ? a.genres : [];

  const spoilerTags = tags.filter(
    (t) => t.is_general_spoiler === true || t.is_media_spoiler === true
  );
  const spoilerCount = spoilerTags.length;

  const desktopView = (
    <div className="mx-auto max-w-6xl px-4 pt-0 pb-8">
      <div className="relative h-[620px] w-full overflow-hidden bg-gray-200">
        {backdropResolved && backdropUrl ? (
          <img
            src={backdropUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-bottom"
          />
        ) : null}

        <img
          src="/overlays/my-overlay.png"
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      </div>

      <div className="-mt-5 relative z-10 px-3">
        <div className="mb-8 flex flex-row gap-7">
          <div className="flex-shrink-0 w-56">
            {anime.image_url ? (
              <img
                src={anime.image_url}
                alt={anime.title}
                className="h-84 w-56 rounded-md object-cover border-3 border-black/100"
              />
            ) : (
              <div className="flex h-64 w-56 items-center justify-center rounded-lg bg-gray-800 text-4xl font-bold text-gray-200">
                {firstChar(anime.title ?? "").toUpperCase()}
              </div>
            )}

            {hasGenres ? (
              <div className="mt-4">
                <h2 className="mb-1 text-sm font-semibold text-black-300">
                  Genres
                </h2>
                <div className="flex flex-wrap gap-2">
                  {genres.map((g) => (
                    <span
                      key={g}
                      className="rounded-full bg-black px-3 py-1 text-xs text-gray-100"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-5">
              <div className="mb-1 flex items-center gap-2">
                <h2 className="text-base font-semibold text-black-300">Tags</h2>
                {tagsLoading ? (
                  <span className="text-[10px] uppercase tracking-wide text-gray-500">
                    Loading…
                  </span>
                ) : null}
              </div>

              {!tagsLoading && tags.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No tags imported yet for this anime.
                </p>
              ) : (
                <>
                  <div className="flex flex-col gap-1">
                    <div className="flex w-full flex-col gap-1">
                      {tags.map((tag) => {
                        const isSpoiler =
                          tag.is_general_spoiler === true ||
                          tag.is_media_spoiler === true;

                        if (isSpoiler && !showSpoilers) return null;

                        const percent =
                          typeof tag.rank === "number"
                            ? Math.max(0, Math.min(100, Math.round(tag.rank)))
                            : null;

                        return (
                          <div key={tag.id} className="group relative inline-flex">
                            <span
                              className="
                                relative inline-flex w-full items-center justify-between
                                rounded-full border border-gray-700 bg-gray-900/80
                                px-3 py-[3px] text-[13px] font-medium
                                whitespace-nowrap overflow-hidden
                              "
                            >
                              {percent !== null ? (
                                <span
                                  className="pointer-events-none absolute inset-y-0 left-0 bg-black"
                                  style={{ width: `${percent}%` }}
                                />
                              ) : null}

                              <span
                                className={`relative ${
                                  isSpoiler ? "text-red-400" : "text-gray-100"
                                }`}
                              >
                                {tag.name}
                              </span>

                              {percent !== null ? (
                                <span className="relative text-[11px] font-semibold text-gray-200">
                                  {percent}%
                                </span>
                              ) : null}
                            </span>

                            {tag.description ? (
                              <div
                                className="
                                  pointer-events-none absolute left-0 top-full z-20 mt-1 w-64
                                  rounded-md bg-black px-3 py-2 text-xs text-gray-100 shadow-lg
                                  opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0
                                  transition duration-200 delay-150
                                "
                              >
                                {tag.description}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {spoilerCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setShowSpoilers((prev) => !prev)}
                      className="mt-2 text-sm font-medium text-blue-400 hover:text-blue-300"
                    >
                      {showSpoilers
                        ? `Hide ${spoilerCount} spoiler tag${
                            spoilerCount === 1 ? "" : "s"
                          }`
                        : `Show ${spoilerCount} spoiler tag${
                            spoilerCount === 1 ? "" : "s"
                          }`}
                    </button>
                  ) : null}
                </>
              )}
            </div>

            <div className="mt-4">
              <AnimeMetaBox
                titleEnglish={a?.title_english ?? null}
                titleNative={a?.title_native ?? null}
                totalEpisodes={anime.total_episodes ?? null}
                format={a?.format ?? null}
                status={a?.status ?? null}
                startDate={a?.start_date ?? null}
                endDate={a?.end_date ?? null}
                season={a?.season ?? null}
                seasonYear={a?.season_year ?? null}
                averageScore={
                  typeof a?.average_score === "number" ? a.average_score : null
                }
              />
            </div>
          </div>

          <div className="min-w-100 flex-1">
            <EnglishTitle
              as="h1"
              className="text-4xl font-bold leading-tight"
              titles={{
                title_english: (anime as any).title_english,
                title_preferred: (anime as any).title_preferred,
                title: anime.title,
                title_native: (anime as any).title_native,
              }}
              fallback={anime.title}
            />

            <div className="relative w-full">
              <div className="absolute right-0 top-6 flex flex-col items-end gap-2">
                <ActionBox
                  key={actionBoxNonce}
                  animeId={anime.id}
                  onOpenLog={() => setLogOpen(true)}
                  onShowActivity={() => router.push(`/anime/${anime.slug}/activity`)}
                />

                <AnimeQuickLogBox
                  animeId={anime.id}
                  totalEpisodes={anime.total_episodes}
                  refreshToken={quickLogRefreshToken}
                  onOpenLog={(episodeId, episodeNumber) => {
                    setSelectedEpisodeId(episodeId ?? null);
                    setSelectedEpisodeNumber(
                      typeof episodeNumber === "number" ? episodeNumber : null
                    );
                    setLogOpen(true);
                  }}
                />
              </div>

              <div className="min-w-0 pr-[270px] pl-1">
                {typeof a.description === "string" && a.description.trim() ? (
                  <div className="mt-6 mb-3">
                    <p className="whitespace-pre-line text-base text-black">
                      {cleanSynopsis(a.description)}
                    </p>
                  </div>
                ) : null}

                <div className="mt-4 min-w-0 overflow-hidden">
                  <EpisodeNavigator
                    slug={slug}
                    totalEpisodes={anime.total_episodes}
                    currentEpisodeNumber={null}
                  />
                </div>

                <CharacterNavigator slug={slug} className="mt-4" />

                <div className="mt-6">
                  <FeedShell>
                    {anime.id ? (
                      <PostFeed key={feedNonce} animeId={anime.id} />
                    ) : (
                      <div className="rounded-md bg-gray-100/60 p-4">
                        <div className="space-y-3">
                          <div className="h-4 w-full rounded bg-gray-200 animate-pulse" />
                          <div className="h-4 w-[96%] rounded bg-gray-200 animate-pulse" />
                          <div className="h-4 w-[88%] rounded bg-gray-200 animate-pulse" />
                        </div>
                      </div>
                    )}
                  </FeedShell>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Link href="/" className="text-xs text-blue-400 hover:text-blue-300">
        ← Back home
      </Link>
    </div>
  );

  const phoneView = (
    <AnimePhoneLayout
      slug={slug}
      anime={anime as any}
      backdropUrl={
        backdropResolved
          ? backdropUrl ?? FALLBACK_BACKDROP_SRC
          : TRANSPARENT_BACKDROP_DATA_URI
      }
      tags={tags}
      tagsLoading={tagsLoading}
      showSpoilers={showSpoilers}
      setShowSpoilers={setShowSpoilers}
      cleanSynopsis={cleanSynopsis}
      actionBoxNonce={actionBoxNonce}
      episodeLogsNonce={episodeLogsNonce}
      onOpenLog={() => {
        setSelectedEpisodeId(null);
        setSelectedEpisodeNumber(null);
        setLogOpen(true);
      }}
      onShowActivity={() => router.push(`/anime/${anime.slug}/activity`)}
      onOpenLogForEpisode={(episodeId, episodeNumber) => {
        setSelectedEpisodeId(episodeId ?? null);
        setSelectedEpisodeNumber(
          typeof episodeNumber === "number" ? episodeNumber : null
        );
        setLogOpen(true);
      }}
      feedNonce={feedNonce}
      reviewSaveMsg={null}
    />
  );

  return (
    <>
      <ResponsiveSwitch desktop={desktopView} phone={phoneView} />

      <GlobalLogModal
        open={logOpen}
        onClose={() => {
          setLogOpen(false);
          setSelectedEpisodeId(null);
          setSelectedEpisodeNumber(null);
        }}
        title={
          selectedEpisodeNumber
            ? `${displayPrimaryTitle} — Episode ${selectedEpisodeNumber}`
            : displayPrimaryTitle
        }
        posterUrl={anime.image_url}
        animeId={anime.id}
        animeEpisodeId={selectedEpisodeId}
        animeEpisodeNumber={selectedEpisodeNumber}
        onSuccess={async () => {
          setQuickLogRefreshToken((n) => n + 1);

          if (selectedEpisodeId) {
            setEpisodeLogsNonce((n) => n + 1);
          }

          setActionBoxNonce((n) => n + 1);
          setFeedNonce((n) => n + 1);
        }}
      />
    </>
  );
};

(AnimePage as any).headerTransparent = true;

export default AnimePage;