// pages/anime/[slug]/episode/[episodeNumber].tsx

import { useRouter } from "next/router";
import type { NextPage } from "next";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { Anime, AnimeEpisode } from "@/lib/types";
import { getAnimeBySlug, getAnimeEpisode } from "@/lib/anime";

import { supabase } from "@/lib/supabaseClient";

import EpisodeNavigator from "@/components/EpisodeNavigator";
import CharacterNavigator from "@/components/CharacterNavigator";
import PostFeed from "@/components/PostFeed";
import FeedShell from "@/components/FeedShell";
import GlobalLogModal from "@/components/reviews/GlobalLogModal";
import ActionBox from "@/components/actions/ActionBox";
import AnimeMetaBox from "@/components/anime/AnimeMetaBox";
import AnimeQuickLogBox from "@/components/anime/AnimeQuickLogBox";
import ResponsiveSwitch from "@/components/ResponsiveSwitch";
import AnimeEpisodePhoneLayout from "@/components/anime/AnimeEpisodePhoneLayout";

import { pickEnglishTitle } from "@/lib/pickEnglishTitle";
import { FALLBACK_BACKDROP_SRC } from "@/lib/fallbacks";

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
    if (url.includes("/t/p/original/")) return url;
    if (url.includes("/t/p/w1280/")) {
      return url.replace("/t/p/w1280/", "/t/p/w1920/");
    }
    if (url.includes("/t/p/w780/")) {
      return url.replace("/t/p/w780/", "/t/p/w1920/");
    }
  }

  return url;
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

function getBackdropUrlsStorageKey(animeId: string, episodeNumber: number): string {
  return `anime_episode_backdrop_urls_${animeId}_${episodeNumber}`;
}

function getBackdropIndexStorageKey(animeId: string, episodeNumber: number): string {
  return `anime_episode_backdrop_index_${animeId}_${episodeNumber}`;
}

function readStoredBackdropUrls(animeId: string, episodeNumber: number): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.sessionStorage.getItem(
      getBackdropUrlsStorageKey(animeId, episodeNumber)
    );
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const result: string[] = [];
    for (const item of parsed) {
      if (typeof item === "string") {
        const trimmed = item.trim();
        if (trimmed.length > 0) {
          result.push(trimmed);
        }
      }
    }

    return result;
  } catch {
    return [];
  }
}

function writeStoredBackdropUrls(
  animeId: string,
  episodeNumber: number,
  urls: string[]
): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      getBackdropUrlsStorageKey(animeId, episodeNumber),
      JSON.stringify(urls)
    );
  } catch {}
}

function getNextRotatingBackdrop(
  animeId: string,
  episodeNumber: number,
  urls: string[]
): string | null {
  const firstUrl = urls.find((u) => typeof u === "string" && u.length > 0);
  if (!firstUrl) return null;

  if (typeof window === "undefined") {
    return firstUrl;
  }

  try {
    const key = getBackdropIndexStorageKey(animeId, episodeNumber);
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

function BackdropFrame({
  url,
  showOverlay = true,
}: {
  url: string | null;
  showOverlay?: boolean;
}) {
  return (
    <div className="relative h-[620px] w-full overflow-hidden bg-gray-200">
      {url ? (
        <img
          src={url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-bottom"
        />
      ) : null}

      {showOverlay ? (
        <img
          src="/overlays/my-overlay.png"
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
    </div>
  );
}

function AnimeEpisodeInstantShell() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-0 pb-8">
      <BackdropFrame url={null} showOverlay />

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
            <div className="mb-0 pl-1">
              <div className="mt-2 h-12 w-[420px] max-w-full rounded bg-gray-300 animate-pulse" />
              <div className="mt-3 h-7 w-[320px] max-w-full rounded bg-gray-200 animate-pulse" />
            </div>

            <div className="relative w-full">
              <div className="absolute right-0 top-6 flex flex-col items-end gap-2">
                <div className="h-12 w-[220px] rounded bg-gray-200 animate-pulse" />
                <div className="h-24 w-[220px] rounded bg-gray-200 animate-pulse" />
              </div>

              <div className="min-w-0 pr-[270px] pl-1">
                <div className="mt-6 mb-3 space-y-3">
                  <div className="h-4 w-full rounded bg-gray-200 animate-pulse" />
                  <div className="h-4 w-[94%] rounded bg-gray-200 animate-pulse" />
                  <div className="h-4 w-[88%] rounded bg-gray-200 animate-pulse" />
                </div>

                <div className="mt-4 h-12 w-full rounded bg-gray-200 animate-pulse" />
                <div className="mt-4 h-12 w-full rounded bg-gray-200 animate-pulse" />

                <div className="mt-2 flex gap-3">
                  <div className="h-4 w-36 rounded bg-gray-200 animate-pulse" />
                  <div className="h-4 w-28 rounded bg-gray-200 animate-pulse" />
                </div>

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
          {/* end right col */}
        </div>
      </div>

      <div className="h-4 w-20 rounded bg-gray-200 animate-pulse" />
    </div>
  );
}

const AnimeEpisodePage: NextPage = () => {
  const router = useRouter();
  const { slug, episodeNumber } = router.query;

  const [anime, setAnime] = useState<Anime | null>(null);
  const [isAnimeLoading, setIsAnimeLoading] = useState(true);
  const [animeError, setAnimeError] = useState<string | null>(null);

  const [episode, setEpisode] = useState<AnimeEpisode | null>(null);
  const [isEpisodeLoading, setIsEpisodeLoading] = useState(false);
  const [episodeError, setEpisodeError] = useState<string | null>(null);

  const [feedNonce, setFeedNonce] = useState(0);
  const [actionBoxNonce, setActionBoxNonce] = useState(0);

  const [logOpen, setLogOpen] = useState(false);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  const [selectedEpisodeNumber, setSelectedEpisodeNumber] = useState<number | null>(
    null
  );

  const [tags, setTags] = useState<AnimeTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [showSpoilers, setShowSpoilers] = useState(false);

  const [episodeLogsNonce, setEpisodeLogsNonce] = useState(0);
  const [quickLogRefreshToken, setQuickLogRefreshToken] = useState(0);

  const [backdropUrl, setBackdropUrl] = useState<string | null>(null);
  const [backdropLoaded, setBackdropLoaded] = useState(false);

  const slugString = useMemo(() => firstString(slug), [slug]);
  const episodeNumberString = useMemo(
    () => firstString(episodeNumber),
    [episodeNumber]
  );

  const trimmedEpisodeNumber = episodeNumberString.trim();
  const parsedEpisodeNum = Number(trimmedEpisodeNumber);
  const isValidEpisodeNumber =
    trimmedEpisodeNumber.length > 0 &&
    Number.isInteger(parsedEpisodeNum) &&
    parsedEpisodeNum > 0;

  const episodeNum = isValidEpisodeNumber ? parsedEpisodeNum : NaN;

  const a: any = anime;

  const pickedSeriesTitle = useMemo(() => {
    if (!anime) return null;

    return (
      pickEnglishTitle({
        title_english: a?.title_english ?? null,
        title_preferred: a?.title_preferred ?? null,
        title: anime.title ?? null,
        title_native: a?.title_native ?? null,
      })?.value ?? null
    );
  }, [anime, a]);

  const seriesDisplayTitle = pickedSeriesTitle ?? anime?.title ?? slugString;

  const genres: string[] = useMemo(() => {
    const g = a?.genres;
    return Array.isArray(g) ? g : [];
  }, [a]);

  const hasGenres = genres.length > 0;

  const spoilerTags = useMemo(
    () =>
      tags.filter(
        (t) => t.is_general_spoiler === true || t.is_media_spoiler === true
      ),
    [tags]
  );
  const spoilerCount = spoilerTags.length;

  useEffect(() => {
    if (!router.isReady) return;
    if (!slugString) return;

    let isCancelled = false;

    const loadAnime = async () => {
      setIsAnimeLoading(true);
      setAnimeError(null);
      setAnime(null);
      setTags([]);
      setShowSpoilers(false);
      setBackdropUrl(null);
      setBackdropLoaded(false);

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

  useEffect(() => {
    if (!anime?.id || !isValidEpisodeNumber) {
      setBackdropUrl(null);
      setBackdropLoaded(true);
      return;
    }

    const animeId = anime.id;
    let cancelled = false;

    async function run() {
      setBackdropLoaded(false);

      const storedUrls = readStoredBackdropUrls(animeId, episodeNum);

      if (storedUrls.length > 0) {
        const immediatePick = getNextRotatingBackdrop(
          animeId,
          episodeNum,
          storedUrls
        );

        if (!cancelled) {
          setBackdropUrl(
            typeof immediatePick === "string"
              ? normalizeBackdropUrl(immediatePick)
              : FALLBACK_BACKDROP_SRC
          );
          setBackdropLoaded(true);
        }
        return;
      }

      const { data: epRow, error: epErr } = await supabase
        .from("anime_episodes")
        .select("id")
        .eq("anime_id", animeId)
        .eq("episode_number", episodeNum)
        .maybeSingle();

      if (cancelled) return;

      if (epErr || !epRow?.id) {
        setBackdropUrl(FALLBACK_BACKDROP_SRC);
        setBackdropLoaded(true);
        return;
      }

      const { data: arts, error: artsErr } = await supabase
        .from("anime_episode_artwork")
        .select("url, source")
        .eq("anime_episode_id", epRow.id)
        .neq("source", "tvdb");

      if (cancelled) return;

      if (artsErr || !Array.isArray(arts) || arts.length === 0) {
        setBackdropUrl(FALLBACK_BACKDROP_SRC);
        setBackdropLoaded(true);
        return;
      }

      const urls: string[] = [];
      for (const row of arts as Array<{ url?: unknown }>) {
        if (typeof row?.url === "string") {
          const trimmed = row.url.trim();
          if (trimmed.length > 0) {
            urls.push(trimmed);
          }
        }
      }

      if (urls.length === 0) {
        setBackdropUrl(FALLBACK_BACKDROP_SRC);
        setBackdropLoaded(true);
        return;
      }

      writeStoredBackdropUrls(animeId, episodeNum, urls);

      const pick = getNextRotatingBackdrop(animeId, episodeNum, urls);

      setBackdropUrl(
        typeof pick === "string" ? normalizeBackdropUrl(pick) : FALLBACK_BACKDROP_SRC
      );
      setBackdropLoaded(true);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [anime?.id, isValidEpisodeNumber, episodeNum]);

  useEffect(() => {
    if (!anime?.id) {
      setTags([]);
      return;
    }

    const animeId = anime.id;
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
        setSelectedEpisodeId(data.id);
        setSelectedEpisodeNumber(data.episode_number ?? episodeNum);
      }

      setIsEpisodeLoading(false);
    };

    loadEpisode();

    return () => {
      isCancelled = true;
    };
  }, [anime, episodeNum, isValidEpisodeNumber]);

  useEffect(() => {
    setSelectedEpisodeId(episode?.id ?? null);
    setSelectedEpisodeNumber(
      episode?.episode_number ?? (isValidEpisodeNumber ? episodeNum : null)
    );
  }, [episode?.id, episode?.episode_number, episodeNum, isValidEpisodeNumber]);

  if (!router.isReady || isAnimeLoading) {
    return <AnimeEpisodeInstantShell />;
  }

  if (!slugString || !isValidEpisodeNumber) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <h1 className="mb-2 text-xl font-semibold text-gray-900">
          Invalid episode URL
        </h1>
        <p className="text-sm text-gray-600">
          The episode number or anime slug in the URL is not valid.
        </p>
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <h1 className="mb-2 text-xl font-semibold text-gray-900">
          Anime not found
        </h1>
        {animeError ? <p className="text-sm text-red-500">{animeError}</p> : null}
      </div>
    );
  }

  const desktopView = (
    <div className="mx-auto max-w-6xl px-4 pt-0 pb-8">
      <div className="relative h-[620px] w-full overflow-hidden bg-gray-200">
        {backdropLoaded && backdropUrl ? (
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
                alt={anime.title ?? slugString}
                className="h-84 w-56 rounded-md object-cover border-3 border-black/100"
              />
            ) : (
              <div className="flex h-64 w-56 items-center justify-center rounded-lg bg-gray-800 text-4xl font-bold text-gray-200">
                {firstChar(anime.title ?? slugString).toUpperCase()}
              </div>
            )}

            {hasGenres && (
              <div className="mt-4">
                <h2 className="mb-1 text-sm font-semibold text-black-300">Genres</h2>
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
            )}

            {tags.length > 0 && (
              <div className="mt-5">
                <div className="mb-1 flex items-center gap-2">
                  <h2 className="text-base font-semibold text-black-300">Tags</h2>
                  {tagsLoading ? (
                    <span className="text-[10px] uppercase tracking-wide text-gray-500">
                      Loading…
                    </span>
                  ) : null}
                </div>

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
              </div>
            )}

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
            <div className="mb-0 pl-1">
              <h1 className="text-4xl font-bold leading-tight">
                {episode?.title ? episode.title : <>Episode {episodeNum}</>}
              </h1>

              <div className="mt-0 text-xl font-semibold leading-snug text-black">
                <Link href={`/anime/${slugString}`} className="hover:underline">
                  {seriesDisplayTitle}
                </Link>
                <span className="mx-2">•</span>
                <span>Episode {episodeNum}</span>
              </div>
            </div>

            <div className="relative w-full">
              <div className="absolute right-0 top-6 flex flex-col items-end gap-2">
                {anime && episode ? (
                  <>
                    <ActionBox
                      key={actionBoxNonce}
                      animeId={anime.id}
                      animeEpisodeId={episode.id}
                      onOpenLog={() => {
                        setSelectedEpisodeId(episode.id);
                        setSelectedEpisodeNumber(
                          episode.episode_number ?? episodeNum
                        );
                        setLogOpen(true);
                      }}
                      onShowActivity={() =>
                        router.push(
                          `/anime/${slugString}/episode/${episodeNum}/activity`
                        )
                      }
                    />

                    <AnimeQuickLogBox
                      animeId={anime.id}
                      totalEpisodes={anime.total_episodes ?? null}
                      refreshToken={quickLogRefreshToken}
                      onOpenLog={(episodeId, episodeNumberValue) => {
                        setSelectedEpisodeId(episodeId ?? episode.id ?? null);

                        const n =
                          typeof episodeNumberValue === "number" &&
                          Number.isFinite(episodeNumberValue)
                            ? episodeNumberValue
                            : episode.episode_number ?? episodeNum;

                        setSelectedEpisodeNumber(n);
                        setLogOpen(true);
                      }}
                    />
                  </>
                ) : null}
              </div>

              <div className="min-w-0 pr-[270px] pl-1">
                {episode?.synopsis ? (
                  <div className="mt-6 mb-3">
                    <p className="whitespace-pre-line text-base text-black">
                      {episode.synopsis}
                    </p>
                  </div>
                ) : episode ? (
                  <div className="mt-6 mb-3">
                    <p className="text-sm text-gray-500">
                      No synopsis has been added for this episode yet.
                    </p>
                  </div>
                ) : isEpisodeLoading ? (
                  <div className="mt-6 mb-3 space-y-3">
                    <div className="h-4 w-full rounded bg-gray-200 animate-pulse" />
                    <div className="h-4 w-[94%] rounded bg-gray-200 animate-pulse" />
                    <div className="h-4 w-[88%] rounded bg-gray-200 animate-pulse" />
                  </div>
                ) : null}

                <div className="mt-4 min-w-0 overflow-hidden">
                  <EpisodeNavigator
                    slug={slugString}
                    totalEpisodes={anime.total_episodes ?? null}
                    currentEpisodeNumber={episodeNum}
                  />
                </div>

                <CharacterNavigator slug={slugString} className="mt-4" />

                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/anime/${slugString}`}
                    className="text-xs text-black hover:underline"
                  >
                    ← Back to anime main page
                  </Link>

                  {isAnimeLoading ? (
                    <span className="text-xs text-gray-500">
                      Loading anime details…
                    </span>
                  ) : null}

                  {!isAnimeLoading && animeError ? (
                    <span className="text-xs text-red-500">{animeError}</span>
                  ) : null}

                  {isEpisodeLoading ? (
                    <span className="text-xs text-gray-500">Loading episode…</span>
                  ) : null}

                  {!isEpisodeLoading && episodeError ? (
                    <span className="text-xs text-red-500">{episodeError}</span>
                  ) : null}
                </div>

                <div className="mt-6">
                  <FeedShell>
                    {anime.id && episode?.id ? (
                      <PostFeed
                        key={feedNonce}
                        animeId={anime.id}
                        animeEpisodeId={episode.id}
                      />
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
    <AnimeEpisodePhoneLayout
      slug={slugString}
      episodeNum={episodeNum}
      anime={anime as any}
      episode={episode as any}
      backdropUrl={backdropLoaded ? backdropUrl ?? FALLBACK_BACKDROP_SRC : TRANSPARENT_BACKDROP_DATA_URI}
      tags={tags}
      tagsLoading={tagsLoading}
      showSpoilers={showSpoilers}
      setShowSpoilers={setShowSpoilers}
      actionBoxNonce={actionBoxNonce}
      episodeLogsNonce={quickLogRefreshToken}
      onOpenLog={() => {
        setSelectedEpisodeId(episode?.id ?? null);
        setSelectedEpisodeNumber(episode?.episode_number ?? episodeNum);
        setLogOpen(true);
      }}
      onShowActivity={() =>
        router.push(`/anime/${slugString}/episode/${episodeNum}/activity`)
      }
      onOpenLogForEpisode={(episodeId, episodeNumberValue) => {
        setSelectedEpisodeId(episodeId ?? episode?.id ?? null);
        setSelectedEpisodeNumber(
          typeof episodeNumberValue === "number" &&
            Number.isFinite(episodeNumberValue)
            ? episodeNumberValue
            : episode?.episode_number ?? episodeNum
        );
        setLogOpen(true);
      }}
      feedNonce={feedNonce}
      seriesDisplayTitle={seriesDisplayTitle}
      isAnimeLoading={isAnimeLoading}
      animeError={animeError}
      isEpisodeLoading={isEpisodeLoading}
      episodeError={episodeError}
    />
  );

  return (
    <>
      <ResponsiveSwitch desktop={desktopView} phone={phoneView} />

      <GlobalLogModal
        open={logOpen}
        onClose={() => {
          setLogOpen(false);
          setSelectedEpisodeId(episode?.id ?? null);
          setSelectedEpisodeNumber(episode?.episode_number ?? episodeNum);
        }}
        title={
          anime
            ? `${seriesDisplayTitle} — Episode ${selectedEpisodeNumber ?? episodeNum}`
            : `Episode ${selectedEpisodeNumber ?? episodeNum}`
        }
        posterUrl={anime?.image_url ?? null}
        animeId={anime?.id ?? null}
        animeEpisodeId={selectedEpisodeId}
        animeEpisodeNumber={selectedEpisodeNumber ?? episodeNum}
        onSuccess={async () => {
          setQuickLogRefreshToken((n) => n + 1);
          setFeedNonce((n) => n + 1);
          setActionBoxNonce((n) => n + 1);
          setEpisodeLogsNonce((n) => n + 1);
        }}
      />
    </>
  );
};

(AnimeEpisodePage as any).headerTransparent = true;

export default AnimeEpisodePage;