// pages/anime/[slug]/episode/[episodeNumber].tsx

import { useRouter } from "next/router";
import type { NextPage, GetServerSideProps } from "next";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

import type { Anime, AnimeEpisode } from "@/lib/types";
import { getAnimeBySlug, getAnimeEpisode } from "@/lib/anime";

import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ✅ episode review helper
import { createAnimeEpisodeReview } from "@/lib/reviews";

// ✅ episode log helpers
import { createAnimeEpisodeLog, getMyAnimeEpisodeLogCount } from "@/lib/logs";

import EpisodeNavigator from "@/components/EpisodeNavigator";
import CharacterNavigator from "@/components/CharacterNavigator";
import PostFeed from "@/components/PostFeed";

import FeedShell from "@/components/FeedShell";

// ✅ Global Log modal
import GlobalLogModal from "@/components/reviews/GlobalLogModal";

// ✅ Letterboxd-style action box
import ActionBox from "@/components/actions/ActionBox";

import AnimeMetaBox from "@/components/anime/AnimeMetaBox";
import AnimeQuickLogBox from "@/components/anime/AnimeQuickLogBox";

import { pickEnglishTitle } from "@/lib/pickEnglishTitle";

import ResponsiveSwitch from "@/components/ResponsiveSwitch";
import AnimeEpisodePhoneLayout from "@/components/anime/AnimeEpisodePhoneLayout";

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

type AnimeEpisodePageProps = {
  initialBackdropUrl: string | null;
};

function normalizeBackdropUrl(url: string) {
  if (!url) return url;

  // Only touch TMDB urls
  if (url.includes("https://image.tmdb.org/t/p/")) {
    // If it was original, keep original (highest quality)
    if (url.includes("/t/p/original/")) return url;

    // If it was w1280, upgrade to w1920 (much sharper on desktop)
    if (url.includes("/t/p/w1280/"))
      return url.replace("/t/p/w1280/", "/t/p/w1920/");

    // If it was w780, upgrade too
    if (url.includes("/t/p/w780/"))
      return url.replace("/t/p/w780/", "/t/p/w1920/");

    // Otherwise leave whatever size it already is
    return url;
  }

  // TVDB / anything else: leave as-is
  return url;
}

const AnimeEpisodePage: NextPage<AnimeEpisodePageProps> = ({
  initialBackdropUrl,
}) => {
  const router = useRouter();
  const { slug, episodeNumber } = router.query;

  const [anime, setAnime] = useState<Anime | null>(null);
  const [isAnimeLoading, setIsAnimeLoading] = useState(true);
  const [animeError, setAnimeError] = useState<string | null>(null);

  const [episode, setEpisode] = useState<AnimeEpisode | null>(null);
  const [isEpisodeLoading, setIsEpisodeLoading] = useState(false);
  const [episodeError, setEpisodeError] = useState<string | null>(null);

  // ✅ my log count
  const [myLogCount, setMyLogCount] = useState<number | null>(null);

  // ✅ Force PostFeed refresh after saving
  const [feedNonce, setFeedNonce] = useState(0);

  // ✅ Force ActionBox refresh after saving
  const [actionBoxNonce, setActionBoxNonce] = useState(0);

  // ✅ open/close the global log modal
  const [logOpen, setLogOpen] = useState(false);

  // ✅ tags (same as series page)
  const [tags, setTags] = useState<AnimeTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [showSpoilers, setShowSpoilers] = useState(false);

  // ✅ quick log refresh (same pattern as series page)
  const [episodeLogsNonce, setEpisodeLogsNonce] = useState(0);

  // ✅ Backdrop from SSR (public.anime_episode_artwork) — random every reload
  const backdropUrl = initialBackdropUrl;

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

  // ✅ fetch tags for THIS anime (same as series page)
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

  const a: any = anime;

  const pickedSeriesTitle = anime
    ? pickEnglishTitle({
      title_english: (a as any).title_english,
      title_preferred: (a as any).title_preferred,
      title: anime.title,
      title_native: (a as any).title_native,
    })?.value
    : null;

  const seriesDisplayTitle = pickedSeriesTitle ?? (anime?.title ?? slugString);

  const genres: string[] = useMemo(() => {
    const g = (a as any)?.genres;
    return Array.isArray(g) ? g : [];
  }, [a]);

  const hasGenres = genres.length > 0;

  const spoilerTags = useMemo(
    () =>
      tags.filter((t) => t.is_general_spoiler === true || t.is_media_spoiler === true),
    [tags]
  );
  const spoilerCount = spoilerTags.length;

  // ------------------------
  // Loading / Invalid
  // ------------------------
  if (!router.isReady) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-gray-500">Loading episode…</p>
      </div>
    );
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

  // ------------------------
  // MAIN EPISODE PAGE CONTENT (series-page structure)
  // ------------------------
  const desktopView = (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-0 pb-8">
        {/* Backdrop (SSR random from public.anime_episode_artwork) */}
        {backdropUrl && (
          <div className="relative h-[620px] w-full overflow-hidden">
            <Image
              src={backdropUrl}
              alt=""
              width={1920}
              height={1080}
              priority
              quality={95}
              sizes="100vw"
              className="h-full w-full object-cover object-bottom"
              unoptimized={backdropUrl.includes("artworks.thetvdb.com")}
            />

            <img
              src="/overlays/my-overlay.png"
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            />
          </div>
        )}

        {/* Top section (same structure as series page) */}
        <div className="-mt-5 relative z-10 px-3">
          <div className="mb-8 flex flex-row gap-7">
            {/* LEFT COLUMN */}
            <div className="flex-shrink-0 w-56">
              {anime?.image_url ? (
                <img
                  src={anime.image_url}
                  alt={anime.title}
                  className="h-84 w-56 rounded-md object-cover border-3 border-black/100"
                />
              ) : (
                <div className="flex h-64 w-56 items-center justify-center rounded-lg bg-gray-800 text-4xl font-bold text-gray-200">
                  {(anime?.title ?? slugString)[0] ?? "?"}
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
                    {tagsLoading && (
                      <span className="text-[10px] uppercase tracking-wide text-gray-500">
                        Loading…
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex w-full flex-col gap-1">
                      {tags.map((tag) => {
                        const isSpoiler =
                          tag.is_general_spoiler || tag.is_media_spoiler;
                        if (isSpoiler && !showSpoilers) return null;

                        let percent: number | null = null;
                        if (typeof tag.rank === "number") {
                          percent = Math.max(
                            0,
                            Math.min(100, Math.round(tag.rank))
                          );
                        }

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
                              {percent !== null && (
                                <span
                                  className="pointer-events-none absolute inset-y-0 left-0 bg-black"
                                  style={{ width: `${percent}%` }}
                                />
                              )}

                              <span
                                className={`relative ${isSpoiler ? "text-red-400" : "text-gray-100"
                                  }`}
                              >
                                {tag.name}
                              </span>

                              {percent !== null && (
                                <span className="relative text-[11px] font-semibold text-gray-200">
                                  {percent}%
                                </span>
                              )}
                            </span>

                            {tag.description && (
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
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {spoilerCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowSpoilers((prev) => !prev)}
                      className="mt-2 text-sm font-medium text-blue-400 hover:text-blue-300"
                    >
                      {showSpoilers
                        ? `Hide ${spoilerCount} spoiler tag${spoilerCount === 1 ? "" : "s"
                        }`
                        : `Show ${spoilerCount} spoiler tag${spoilerCount === 1 ? "" : "s"
                        }`}
                    </button>
                  )}
                </div>
              )}

              <div className="mt-4">
                <AnimeMetaBox
                  titleEnglish={a?.title_english}
                  titleNative={a?.title_native}
                  totalEpisodes={anime?.total_episodes ?? null}
                  format={a?.format}
                  status={a?.status}
                  startDate={a?.start_date}
                  endDate={a?.end_date}
                  season={a?.season}
                  seasonYear={a?.season_year}
                  averageScore={
                    typeof a?.average_score === "number" ? a.average_score : null
                  }
                />
              </div>
            </div>

            {/* RIGHT COLUMN */}
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
                        onOpenLog={() => setLogOpen(true)}
                        onShowActivity={() =>
                          router.push(
                            `/anime/${slugString}/episode/${episodeNum}/activity`
                          )
                        }
                      />

                      <AnimeQuickLogBox
                        animeId={anime.id}
                        totalEpisodes={anime.total_episodes}
                        refreshToken={episodeLogsNonce}
                        onOpenLog={() => setLogOpen(true)}
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
                  ) : (
                    episode && (
                      <div className="mt-6 mb-3">
                        <p className="text-sm text-gray-500">
                          No synopsis has been added for this episode yet.
                        </p>
                      </div>
                    )
                  )}

                  <div className="mt-4 min-w-0 overflow-hidden">
                    <EpisodeNavigator
                      slug={slugString}
                      totalEpisodes={anime?.total_episodes ?? null}
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

                    {isAnimeLoading && (
                      <span className="text-xs text-gray-500">
                        Loading anime details…
                      </span>
                    )}
                    {!isAnimeLoading && animeError && (
                      <span className="text-xs text-red-500">{animeError}</span>
                    )}
                    {isEpisodeLoading && (
                      <span className="text-xs text-gray-500">Loading episode…</span>
                    )}
                    {!isEpisodeLoading && episodeError && (
                      <span className="text-xs text-red-500">{episodeError}</span>
                    )}
                  </div>

                  {anime && episode && (
                    <div className="mt-6">
                      <FeedShell>
                        <PostFeed
                          key={feedNonce}
                          animeId={anime.id}
                          animeEpisodeId={episode.id}
                        />
                      </FeedShell>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <Link href="/" className="text-xs text-blue-400 hover:text-blue-300">
          ← Back home
        </Link>
      </div>
    </>
  );

  const phoneView = (
    <AnimeEpisodePhoneLayout
      slug={slugString}
      episodeNum={episodeNum}
      anime={anime as any}
      episode={episode as any}
      backdropUrl={backdropUrl}
      tags={tags}
      tagsLoading={tagsLoading}
      showSpoilers={showSpoilers}
      setShowSpoilers={setShowSpoilers}
      actionBoxNonce={actionBoxNonce}
      episodeLogsNonce={episodeLogsNonce}
      onOpenLog={() => setLogOpen(true)}
      onShowActivity={() =>
        router.push(`/anime/${slugString}/episode/${episodeNum}/activity`)
      }
      onOpenLogForEpisode={() => setLogOpen(true)}
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
        onClose={() => setLogOpen(false)}
        title={
          anime
            ? `${seriesDisplayTitle} — Episode ${episodeNum}`
            : `Episode ${episodeNum}`
        }
        posterUrl={anime?.image_url ?? null}
        animeId={anime?.id ?? null}
        animeEpisodeId={episode?.id ?? null}
        onSuccess={async () => {
          if (!episode?.id) return;

          const { count, error } = await getMyAnimeEpisodeLogCount(episode.id);
          if (!error) setMyLogCount(count);

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

export const getServerSideProps: GetServerSideProps<
  AnimeEpisodePageProps
> = async (ctx) => {
  const rawSlug = ctx.params?.slug;
  const slug =
    typeof rawSlug === "string"
      ? rawSlug
      : Array.isArray(rawSlug) && rawSlug[0]
        ? rawSlug[0]
        : null;

  const rawEp = ctx.params?.episodeNumber;
  const epStr =
    typeof rawEp === "string"
      ? rawEp
      : Array.isArray(rawEp) && rawEp[0]
        ? rawEp[0]
        : null;

  const episodeNum = epStr ? parseInt(epStr, 10) : NaN;

  if (!slug || !Number.isFinite(episodeNum) || episodeNum <= 0) {
    return { props: { initialBackdropUrl: null } };
  }

  // 1) get anime id by slug
  const { data: animeRow, error: animeErr } = await supabaseAdmin
    .from("anime")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (animeErr || !animeRow?.id) {
    return { props: { initialBackdropUrl: null } };
  }

  // 2) get episode id by (anime_id, episode_number)
  const { data: epRow, error: epErr } = await supabaseAdmin
    .from("anime_episodes")
    .select("id")
    .eq("anime_id", animeRow.id)
    .eq("episode_number", episodeNum)
    .maybeSingle();

  if (epErr || !epRow?.id) {
    return { props: { initialBackdropUrl: null } };
  }

  // 3) pull episode artwork + pick random backdrop
  const { data: arts, error: artsErr } = await supabaseAdmin
    .from("anime_episode_artwork")
    .select("url")
    .eq("anime_episode_id", epRow.id)
    .neq("source", "tvdb"); // ❌ remove TVDB entirely

  if (artsErr || !arts || arts.length === 0) {
    return { props: { initialBackdropUrl: null } };
  }

  const urls = arts.map((r) => r.url).filter(Boolean) as string[];
  const picked = urls.length ? urls[Math.floor(Math.random() * urls.length)] : null;

  return {
    props: {
      initialBackdropUrl: picked ? normalizeBackdropUrl(picked) : null,
    },
  };
};
