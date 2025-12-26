// pages/anime/[slug].tsx

import { useEffect, useState } from "react";
import type { NextPage, GetServerSideProps } from "next";
import { useRouter } from "next/router";
import Link from "next/link";
import Image from "next/image";

import { getAnimeBySlug } from "@/lib/anime";
import type { Anime } from "@/lib/types";
import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ✅ review INSERT helper (Letterboxd-style: multiple reviews allowed)
import { createAnimeSeriesReview } from "@/lib/reviews";

import EpisodeNavigator from "@/components/EpisodeNavigator";

import PostFeed from "../../components/PostFeed";

// ✅ Global Log modal
import GlobalLogModal from "@/components/reviews/GlobalLogModal";

// ✅ Letterboxd-style action box (reusable)
import ActionBox from "@/components/actions/ActionBox";

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

type AnimePageProps = {
  initialBackdropUrl: string | null;
};

function normalizeBackdropUrl(url: string) {
  // TMDB "original" is huge; use a smaller size for faster first paint
  if (url.includes("https://image.tmdb.org/t/p/original/")) {
    return url.replace("/t/p/original/", "/t/p/w1280/");
    // If you want even faster first paint, use w780:
    // return url.replace("/t/p/original/", "/t/p/w780/");
  }
  return url; // TVDB stays as-is
}

function cleanSynopsis(raw: string) {
  return raw
    // normalize line endings
    .replace(/\r\n/g, "\n")
    // convert <br> to newlines
    .replace(/<br\s*\/?>/gi, "\n")
    // remove "(Source: ...)" anywhere
    .replace(/\(Source:.*?\)/gi, "")
    // remove italic tags but KEEP their text (better than deleting the whole block)
    .replace(/<\/?i>/gi, "")
    // strip any other html tags that might be in there
    .replace(/<[^>]+>/g, "")
    // collapse 3+ newlines into just 2 newlines (prevents giant gaps)
    .replace(/\n{3,}/g, "\n\n")
    // also collapse “blank lines with spaces”
    .replace(/\n[ \t]+\n/g, "\n\n")
    // trim overall
    .trim();
}

const AnimePage: NextPage<AnimePageProps> = ({ initialBackdropUrl }) => {
  const router = useRouter();

  const [slug, setSlug] = useState<string | null>(null);
  const [anime, setAnime] = useState<Anime | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [tags, setTags] = useState<AnimeTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [showSpoilers, setShowSpoilers] = useState(false);

  // ✅ MUST be declared up here (before any returns)
  const [trailerSrc, setTrailerSrc] = useState<string | null>(null);

  // ✅ Backdrop from SSR (public.anime_artwork)
  const [backdropUrl] = useState<string | null>(initialBackdropUrl);

  // ✅ Your uploaded overlay (public/masks/white-edge-mask.png)
  const overlayMaskUrl = "/masks/white-edge-mask.png";

  // ✅ NEW (temporary): save review test state
  const [savingReview, setSavingReview] = useState(false);
  const [reviewSaveMsg, setReviewSaveMsg] = useState<string | null>(null);

  // ✅ NEW: force PostFeed to remount so it refetches immediately (no page refresh)
  const [feedNonce, setFeedNonce] = useState(0);

  // ✅ NEW: force ActionBox to remount so marks refresh immediately (no page refresh)
  const [actionBoxNonce, setActionBoxNonce] = useState(0);

  // ✅ open/close the log modal
  const [logOpen, setLogOpen] = useState(false);

  // ✅ my series log count
  const [mySeriesLogCount, setMySeriesLogCount] = useState<number | null>(null);

  // Normalize slug from router.query
  useEffect(() => {
    if (!router.isReady) return;

    const raw = router.query.slug as string | string[] | undefined;

    if (typeof raw === "string") {
      setSlug(raw);
    } else if (Array.isArray(raw) && raw.length > 0) {
      setSlug(raw[0]);
    } else {
      setSlug(null);
    }
  }, [router.isReady, router.query.slug]);

  // Fetch anime
  useEffect(() => {
    if (!slug) {
      setAnime(null);
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function run() {
      setLoading(true);
      setErrorMessage(null);

      const { data, error } = await getAnimeBySlug(slug!);

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
  }, [slug]);

  // Fetch tags
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

  // ✅ keep trailerSrc synced to the best available thumbnail (maxres -> hq)
  useEffect(() => {
    const a: any = anime;

    const base: string | null =
      typeof a?.trailer_thumbnail_url === "string" && a.trailer_thumbnail_url
        ? a.trailer_thumbnail_url
        : null;

    if (!base) {
      setTrailerSrc(null);
      return;
    }

    const hi = base.replace("/hqdefault.jpg", "/maxresdefault.jpg");
    setTrailerSrc(hi || base);
  }, [anime]);

  // ✅ NEW (temporary): test write a series review (INSERT ONLY)
  async function handleTestSaveReview() {
    const animeId = anime?.id;
    const animeTitle = anime?.title;
    if (!animeId || !animeTitle) return;

    setSavingReview(true);
    setReviewSaveMsg(null);

    try {
      const result = await createAnimeSeriesReview({
        anime_id: animeId,
        rating: 87,
        content: `Test review for ${animeTitle} @ ${new Date().toLocaleString()}`,
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

      // ✅ Force PostFeed to refetch immediately (no manual refresh)
      setFeedNonce((n) => n + 1);
    } finally {
      setSavingReview(false);
    }
  }

  // ✅ fetch my series log count (soft-fail)
  useEffect(() => {
    const animeId = anime?.id;
    if (!animeId) {
      setMySeriesLogCount(null);
      return;
    }

    let cancelled = false;

    async function run() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (userError || !user) {
        setMySeriesLogCount(null);
        return;
      }

      const { count, error } = await supabase
        .from("anime_series_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("anime_id", animeId);

      if (cancelled) return;

      if (error) {
        console.error("Error fetching series log count:", error);
        setMySeriesLogCount(null);
        return;
      }

      setMySeriesLogCount(count ?? 0);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [anime?.id]);

  // ------------------------
  // Loading / Not Found
  // ------------------------
  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold">Loading anime...</h1>
        <p className="text-sm text-gray-400">
          Please wait while we fetch this anime.
        </p>
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="mb-4 text-2xl font-bold">Anime not found</h1>
        {errorMessage && <p className="mb-2 text-gray-300">{errorMessage}</p>}
        <p className="mb-4 text-gray-400">
          We couldn&apos;t find an anime with that URL.
        </p>
        <Link
          href="/"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          Go back home
        </Link>
      </div>
    );
  }

  const a: any = anime;
  const hasGenres = Array.isArray(a.genres) && a.genres.length > 0;
  const genres: string[] = a.genres || [];

  const spoilerTags = tags.filter(
    (t) => t.is_general_spoiler === true || t.is_media_spoiler === true
  );
  const spoilerCount = spoilerTags.length;

  // ------------------------
  // MAIN ANIME PAGE CONTENT
  // ------------------------
  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-0 pb-8">
        {/* Backdrop (from SSR public.anime_artwork) */}
        {backdropUrl && (
          <div className="relative h-[620px] w-full overflow-hidden">
            <Image
              src={backdropUrl}
              alt=""
              width={1920}
              height={1080}
              priority
              sizes="100vw"
              className="h-full w-full object-cover object-bottom"
            />

            {/* OVERLAY */}
            <img
              src="/overlays/my-overlay.png"
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            />
          </div>
        )}


        {/* Top section */}
        <div className="-mt-5 relative z-10 px-3">
          <div className="mb-8 flex flex-row gap-7">
            <div className="flex-shrink-0 w-56">
              {/* Poster */}
              {anime.image_url ? (
                <img
                  src={anime.image_url}
                  alt={anime.title}
                  className="h-84 w-56 rounded-md object-cover border border-black/100"
                />
              ) : (
                <div className="flex h-64 w-56 items-center justify-center rounded-lg bg-gray-800 text-4xl font-bold text-gray-200">
                  {anime.title[0] ?? "?"}
                </div>
              )}

              {/* Genres (moved here) */}
              {hasGenres && (
                <div className="mt-4">
                  <h2 className="mb-1 text-sm font-semibold text-black-300">Genres</h2>
                  <div className="flex flex-wrap gap-2">
                    {genres.map((g) => (
                      <span
                        key={g}
                        className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-100"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags (moved here) */}
              <div className="mt-5">
                <div className="mb-1 flex items-center gap-2">
                  <h2 className="text-base font-semibold text-black-300">Tags</h2>
                  {tagsLoading && (
                    <span className="text-[10px] uppercase tracking-wide text-gray-500">
                      Loading…
                    </span>
                  )}
                </div>

                {!tagsLoading && tags.length === 0 ? (
                  <p className="text-sm text-gray-500">No tags imported yet for this anime.</p>
                ) : (
                  <>
                    <div className="flex flex-col gap-1">
                      <div className="flex w-full flex-col gap-1">
                        {tags.map((tag) => {
                          const isSpoiler =
                            tag.is_general_spoiler || tag.is_media_spoiler;

                          if (isSpoiler && !showSpoilers) return null;

                          let percent: number | null = null;
                          if (typeof tag.rank === "number") {
                            percent = Math.max(0, Math.min(100, Math.round(tag.rank)));
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
                                    className="pointer-events-none absolute inset-y-0 left-0 bg-blue-500/20"
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
                          ? `Hide ${spoilerCount} spoiler tag${spoilerCount === 1 ? "" : "s"}`
                          : `Show ${spoilerCount} spoiler tag${spoilerCount === 1 ? "" : "s"}`
                        }
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="min-w-100 flex-1">
              {/* ROW 1 — TITLE (full width, can be tall) */}
              <h1 className="mb-2 text-4xl font-bold leading-tight">
                {anime.title}
              </h1>

              {/* ROW 2 — LEFT CONTENT + ActionBox pinned top-right */}
              <div className="relative w-full">
                {/* RIGHT SIDE: ActionBox (pinned, won't move) */}
                <div className="absolute right-0 top-1">
                  <ActionBox
                    key={actionBoxNonce}
                    animeId={anime.id}
                    onOpenLog={() => setLogOpen(true)}
                    onShowActivity={() => router.push(`/anime/${anime.slug}/activity`)}
                  />
                </div>

                {/* LEFT SIDE: reserve space so text never goes under ActionBox */}
                <div className="min-w-0 pr-[260px]">
                  {/* ✅ SYNOPSIS goes here (between poster and actionbox) */}
                  {typeof a.description === "string" && a.description.trim() && (
                    <div className="mt-6 mb-3">
                      <p className="whitespace-pre-line text-base text-black">
                        {cleanSynopsis(a.description)}
                      </p>
                    </div>
                  )}

                  {/* ✅ Episode Navigator */}
                  {slug && (
                    <div className="mt-4 min-w-0 overflow-hidden">
                      <EpisodeNavigator
                        slug={slug}
                        totalEpisodes={anime.total_episodes}
                        currentEpisodeNumber={null}
                      />
                    </div>
                  )}

                  {/* ✅ Feed */}
                  <div className="mt-6">
                    <PostFeed key={feedNonce} animeId={anime.id} />
                  </div>

                </div>
              </div>
              {/* EVERYTHING BELOW stays the same */}
            </div>
          </div>
        </div>

        {/* Meta info stays below synopsis */}
        {(a.title_english || a.title_native) && (
          <div className="mb-2 text-sm text-gray-400">
            {a.title_english && (
              <div>
                <span className="font-semibold text-gray-300">English:</span>{" "}
                {a.title_english}
              </div>
            )}
            {a.title_native && (
              <div>
                <span className="font-semibold text-gray-300">Native:</span>{" "}
                {a.title_native}
              </div>
            )}
          </div>
        )}

        <p className="mb-1 text-sm text-gray-400">
          Episodes:{" "}
          <span className="font-semibold text-gray-100">
            {anime.total_episodes ?? "Unknown"}
          </span>
        </p>

        <p className="mb-1 text-sm text-gray-400">
          Format:{" "}
          <span className="font-semibold text-gray-100">{a.format ?? "—"}</span>
        </p>

        <p className="mb-1 text-sm text-gray-400">
          Status:{" "}
          <span className="font-semibold text-gray-100">{a.status ?? "—"}</span>
        </p>

        {(a.start_date || a.end_date) && (
          <p className="mb-1 text-sm text-gray-400">
            Aired:{" "}
            <span className="font-semibold text-gray-100">
              {a.start_date ?? "?"} – {a.end_date ?? "?"}
            </span>
          </p>
        )}

        {(a.season || a.season_year) && (
          <p className="mb-1 text-sm text-gray-400">
            Season:{" "}
            <span className="font-semibold text-gray-100">
              {a.season ?? "?"} {a.season_year ?? ""}
            </span>
          </p>
        )}

        {typeof a.average_score === "number" && (
          <p className="mb-1 text-sm text-gray-400">
            Score:{" "}
            <span className="font-semibold text-gray-100">
              {a.average_score}/100
            </span>
          </p>
        )}

        {/* Back link */}
        <Link href="/" className="text-xs text-blue-400 hover:text-blue-300">
          ← Back home
        </Link>
      </div>

      <GlobalLogModal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        title={anime.title}
        posterUrl={anime.image_url}
        animeId={anime.id}
        onSuccess={async () => {
          const {
            data: { user },
            error: userError,
          } = await supabase.auth.getUser();

          if (userError || !user) return;

          const { count, error } = await supabase
            .from("anime_series_logs")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("anime_id", anime.id);

          if (!error) setMySeriesLogCount(count ?? 0);

          // ✅ Refresh ActionBox immediately (watched/liked/watchlist/rating)
          setActionBoxNonce((n) => n + 1);

          // ✅ NEW: Refresh PostFeed immediately (so the new review shows without reload)
          setFeedNonce((n) => n + 1);
        }}
      />
    </>
  );
};

(AnimePage as any).headerTransparent = true;

export default AnimePage;

export const getServerSideProps: GetServerSideProps<AnimePageProps> = async (ctx) => {
  const raw = ctx.params?.slug;
  const slug =
    typeof raw === "string" ? raw : Array.isArray(raw) && raw[0] ? raw[0] : null;

  if (!slug) {
    return { props: { initialBackdropUrl: null } };
  }

  // 1) Get anime id by slug (server-side)
  const { data: animeRow, error: animeErr } = await supabaseAdmin
    .from("anime")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (animeErr || !animeRow?.id) {
    return { props: { initialBackdropUrl: null } };
  }

  // 2) Get a RANDOM backdrop from anime_artwork (server-side)
  const { data: arts, error: artErr } = await supabaseAdmin
    .from("anime_artwork")
    .select("url, is_primary, vote, width")
    .eq("anime_id", animeRow.id)
    .in("kind", ["backdrop", "3"]) // ✅ supports both new + legacy kinds
    .limit(50); // cap so you don’t pull thousands if something goes crazy

  if (artErr || !arts || arts.length === 0) {
    return { props: { initialBackdropUrl: null } };
  }

  // Optional: prefer better ones first (primary/vote/width)
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

  // Pick randomly from the top N (so it’s random but not ugly/low-res)
  const topN = sorted.slice(0, Math.min(12, sorted.length));
  const pick = topN[Math.floor(Math.random() * topN.length)];

  const rawUrl = pick?.url ?? null;

  return {
    props: {
      initialBackdropUrl: rawUrl ? normalizeBackdropUrl(rawUrl) : null,
    },
  };
};
