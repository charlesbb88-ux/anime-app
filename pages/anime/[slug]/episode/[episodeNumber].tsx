// pages/anime/[slug]/episode/[episodeNumber].tsx

import { useRouter } from "next/router";
import type { NextPage, GetServerSideProps } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";
import Image from "next/image";

import type { Anime, AnimeEpisode } from "@/lib/types";
import { getAnimeBySlug, getAnimeEpisode } from "@/lib/anime";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

  // ✅ Backdrop from SSR (public.anime_episode_artwork) — random every reload
  const backdropUrl = initialBackdropUrl;

  // ✅ Your uploaded overlay (match series page)
  const overlayMaskUrl = "/masks/white-edge-mask.png"; // (kept for parity if you use later)

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
  // MAIN EPISODE PAGE CONTENT (match series layout)
  // ------------------------
  return (
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

            {/* OVERLAY (match series page) */}
            <img
              src="/overlays/my-overlay.png"
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            />
          </div>
        )}

        {/* Top section (overlap + poster left + content right) */}
        <div className="-mt-5 relative z-10 px-3">
          <div className="mb-8 flex flex-row gap-7">
            <div className="flex-shrink-0">
              {anime?.image_url ? (
                <img
                  src={anime.image_url}
                  alt={anime.title}
                  className="h-84 w-56 rounded-md object-cover border border-black/100"
                />
              ) : (
                <div className="flex h-64 w-44 items-center justify-center rounded-lg bg-gray-800 text-4xl font-bold text-gray-200">
                  {(anime?.title ?? slugString)[0] ?? "?"}
                </div>
              )}
            </div>

            <div className="min-w-100 flex-1">
              {/* ROW 1 — TITLE */}
              <h1 className="mb-2 text-4xl font-bold leading-tight">
                {anime?.title ?? slugString}
                <span className="text-gray-500"> — </span>
                <span>Episode {episodeNum}</span>
              </h1>

              {/* ROW 2 — LEFT CONTENT + ActionBox pinned top-right */}
              <div className="relative w-full">
                {/* RIGHT SIDE: ActionBox pinned */}
                <div className="absolute right-0 top-1">
                  {anime && episode ? (
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
                  ) : null}
                </div>

                {/* LEFT SIDE: reserve space so content never goes under ActionBox */}
                <div className="min-w-0 pr-[260px]">
                  {/* Episode title + synopsis (this is the “synopsis area” like series page) */}
                  {episode?.title && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-700">
                        <span className="font-semibold text-gray-900">
                          Episode title:
                        </span>{" "}
                        {episode.title}
                      </p>
                    </div>
                  )}

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

                  {/* EpisodeNavigator (same spot as series page) */}
                  <div className="mt-4 min-w-0 overflow-hidden">
                    <EpisodeNavigator
                      slug={slugString}
                      totalEpisodes={anime?.total_episodes ?? null}
                      currentEpisodeNumber={episodeNum}
                    />
                  </div>

                  {/* Small utility row (back link + test buttons) */}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Link
                      href={`/anime/${slugString}`}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      ← Back to anime main page
                    </Link>

                    {anime && episode && (
                      <>
                        <button
                          type="button"
                          onClick={handleTestSaveReview}
                          disabled={savingReview}
                          className="rounded-md border border-gray-300 bg-white/70 px-3 py-1 text-xs font-medium text-gray-900 hover:bg-white disabled:opacity-60"
                        >
                          {savingReview ? "Saving…" : "Test: Save episode review"}
                        </button>

                        <button
                          type="button"
                          onClick={handleTestLogEpisode}
                          disabled={savingLog}
                          className="rounded-md border border-gray-300 bg-white/70 px-3 py-1 text-xs font-medium text-gray-900 hover:bg-white disabled:opacity-60"
                        >
                          {savingLog ? "Logging…" : "Test: Log episode"}
                        </button>

                        <button
                          type="button"
                          onClick={() => setLogOpen(true)}
                          className="rounded-md border border-gray-300 bg-white/70 px-3 py-1 text-xs font-medium text-gray-900 hover:bg-white"
                        >
                          Log
                        </button>
                      </>
                    )}

                    {typeof myLogCount === "number" && (
                      <span className="text-xs text-gray-600">
                        You logged this{" "}
                        <span className="font-semibold text-gray-900">
                          {myLogCount}
                        </span>{" "}
                        time{myLogCount === 1 ? "" : "s"}
                      </span>
                    )}

                    {reviewSaveMsg && (
                      <span className="text-xs text-gray-600">{reviewSaveMsg}</span>
                    )}
                    {logSaveMsg && (
                      <span className="text-xs text-gray-600">{logSaveMsg}</span>
                    )}

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

                  {/* Feed directly below synopsis (like series page) */}
                  {anime && episode && (
                    <div className="mx-auto mt-6 max-w-6xl px-4 pb-12">
                      <div className="mb-3 text-lg font-semibold text-gray-900">
                        Episode discussion
                      </div>
                      <PostFeed
                        key={feedNonce}
                        animeId={anime.id}
                        animeEpisodeId={episode.id}
                      />
                    </div>
                  )}
                </div>
              </div>
              {/* everything below stays in normal flow */}
            </div>
          </div>
        </div>

        {/* (Optional) Keep sidebars grid, but now it visually follows the same layout rhythm */}
        {anime && episode && (
          <div
            style={{
              marginTop: "0.5rem",
              maxWidth: "80rem",
              marginLeft: "auto",
              marginRight: "auto",
              padding: "0 1.5rem 2rem",
              display: "grid",
              gridTemplateColumns:
                "minmax(0, 19rem) minmax(0, 41rem) minmax(0, 19rem)",
              gap: "1rem",
            }}
          >
            <div>
              <LeftSidebar />
            </div>

            <div>{/* center column intentionally empty for now */}</div>

            <div>
              <RightSidebar />
            </div>
          </div>
        )}

        {/* Back link (match series page placement if you want it low) */}
        <Link href="/" className="text-xs text-blue-400 hover:text-blue-300">
          ← Back home
        </Link>
      </div>

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

          // ✅ refresh marks UI (watched/liked/watchlist/rating)
          setActionBoxNonce((n) => n + 1);
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
