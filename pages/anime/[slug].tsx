// pages/anime/[slug].tsx

"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import Link from "next/link";

import { getAnimeBySlug } from "@/lib/anime";
import type { Anime } from "@/lib/types";
import { supabase } from "@/lib/supabaseClient";

// ✅ NEW: review upsert helper (Step 2 file)
import { upsertAnimeSeriesReview } from "@/lib/reviews";

import EpisodeNavigator from "@/components/EpisodeNavigator";

import LeftSidebar from "../../components/LeftSidebar";
import RightSidebar from "../../components/RightSidebar";
import PostFeed from "../../components/PostFeed";

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

const AnimePage: NextPage = () => {
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

  // ✅ Your uploaded overlay (public/masks/white-edge-mask.png)
  const overlayMaskUrl = "/masks/white-edge-mask.png";

  // ✅ NEW (temporary): save review test state
  const [savingReview, setSavingReview] = useState(false);
  const [reviewSaveMsg, setReviewSaveMsg] = useState<string | null>(null);

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
    if (!anime?.id) {
      setTags([]);
      return;
    }

    let isMounted = true;
    const animeId = anime.id;

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

  // ✅ NEW (temporary): test write a series review
  async function handleTestSaveReview() {
    if (!anime?.id) return;

    setSavingReview(true);
    setReviewSaveMsg(null);

    try {
      const result = await upsertAnimeSeriesReview({
        anime_id: anime.id,
        rating: 87,
        content: `Test review for ${anime.title} @ ${new Date().toLocaleString()}`,
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
    } finally {
      setSavingReview(false);
    }
  }

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

  // Trailer thumb URLs (for fallback)
  const trailerThumbBase: string | null =
    typeof a.trailer_thumbnail_url === "string" && a.trailer_thumbnail_url
      ? a.trailer_thumbnail_url
      : null;

  const trailerThumbHi: string | null = trailerThumbBase
    ? trailerThumbBase.replace("/hqdefault.jpg", "/maxresdefault.jpg")
    : null;

  const trailerThumbMd: string | null = trailerThumbBase
    ? trailerThumbBase.replace("/hqdefault.jpg", "/sddefault.jpg")
    : null;

  // ------------------------
  // MAIN ANIME PAGE CONTENT
  // ------------------------
  return (
    <>
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Banner (Letterboxd structure, but fades into WHITE page background) */}
        {a.banner_image_url && (
          <div className="mb-6 h-40 w-full overflow-hidden rounded-lg">
            <div className="relative h-full w-full">
              {/* backdropimage */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${a.banner_image_url})`,
                  backgroundSize: "cover",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center 0px",
                }}
              />

              {/* ✅ backdropmask (YOUR PNG overlay, stretched to fit any aspect) */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${overlayMaskUrl})`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center",
                  backgroundSize: "100% 100%", // <-- key: makes 1900x400 work on any container
                  pointerEvents: "none",
                }}
              />
            </div>
          </div>
        )}

        {/* Top section */}
        <div className="mb-8 flex flex-col gap-6 md:flex-row">
          <div className="flex-shrink-0">
            {anime.image_url ? (
              <img
                src={anime.image_url}
                alt={anime.title}
                className="h-64 w-44 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-64 w-44 items-center justify-center rounded-lg bg-gray-800 text-4xl font-bold text-gray-200">
                {anime.title[0] ?? "?"}
              </div>
            )}
          </div>

          <div className="flex-1">
            <h1 className="mb-1 text-3xl font-bold">{anime.title}</h1>

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
              <span className="font-semibold text-gray-100">
                {a.format ?? "—"}
              </span>
            </p>

            <p className="mb-1 text-sm text-gray-400">
              Status:{" "}
              <span className="font-semibold text-gray-100">
                {a.status ?? "—"}
              </span>
            </p>

            {(a.start_date || a.end_date) && (
              <p className="mb-1 text-sm text-gray-400">
                Aired:{" "}
                <span className="font-semibold text-gray-100">
                  {a.start_date ?? "?"} {(a.start_date || a.end_date) && " – "}{" "}
                  {a.end_date ?? "?"}
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

            {a.source && (
              <p className="mb-2 text-sm text-gray-400">
                Source:{" "}
                <span className="font-semibold text-gray-100">{a.source}</span>
              </p>
            )}

            {/* ✅ Episode Navigator */}
            {slug && (
              <div className="mt-4">
                <EpisodeNavigator
                  slug={slug}
                  totalEpisodes={anime.total_episodes}
                  currentEpisodeNumber={null}
                />
              </div>
            )}

            <p className="mt-2 text-xs text-gray-500">
              Anime ID: <code className="text-[10px]">{anime.id}</code>
            </p>

            {/* ✅ NEW (temporary): test save review button + tiny status */}
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestSaveReview}
                disabled={savingReview}
                className="rounded-md border border-gray-700 bg-gray-900/40 px-3 py-1 text-xs font-medium text-gray-200 hover:bg-gray-900/60 disabled:opacity-60"
              >
                {savingReview ? "Saving…" : "Test: Save review"}
              </button>

              {reviewSaveMsg && (
                <span className="text-xs text-gray-400">{reviewSaveMsg}</span>
              )}
            </div>
          </div>
        </div>

        {/* Synopsis */}
        {a.description && (
          <div className="mb-6">
            <h2 className="mb-1 text-sm font-semibold text-gray-300">
              Synopsis
            </h2>
            <p className="whitespace-pre-line text-sm text-gray-200">
              {a.description}
            </p>
          </div>
        )}

        {/* Genres */}
        {hasGenres && (
          <div className="mb-6">
            <h2 className="mb-1 text-sm font-semibold text-gray-300">Genres</h2>
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

        {/* Tags */}
        <div className="mb-8">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-300">Tags</h2>
            {tagsLoading && (
              <span className="text-[10px] uppercase tracking-wide text-gray-500">
                Loading…
              </span>
            )}
          </div>

          {!tagsLoading && tags.length === 0 ? (
            <p className="text-sm text-gray-500">
              No tags imported yet for this anime.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <div className="flex w-full max-w-[13.5rem] flex-col gap-1">
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
                            className={`relative ${
                              isSpoiler ? "text-red-400" : "text-gray-100"
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
                    ? `Hide ${spoilerCount} spoiler tag${
                        spoilerCount === 1 ? "" : "s"
                      }`
                    : `Show ${spoilerCount} spoiler tag${
                        spoilerCount === 1 ? "" : "s"
                      }`}
                </button>
              )}
            </>
          )}
        </div>

        {/* Back link */}
        <Link href="/" className="text-xs text-blue-400 hover:text-blue-300">
          ← Back home
        </Link>
      </div>

      {/* ------------------------------------------- */}
      {/*     DISCUSSION FEED SECTION — SMALL GAP     */}
      {/* ------------------------------------------- */}
      <div
        style={{
          marginTop: "1.5rem",
          maxWidth: "80rem",
          marginLeft: "auto",
          marginRight: "auto",
          padding: "2rem 1.5rem",
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 19rem) minmax(0, 41rem) minmax(0, 19rem)",
          gap: "1rem",
        }}
      >
        <div>
          <LeftSidebar />
        </div>

        <div>
          <PostFeed animeId={anime!.id} />
        </div>

        <div>
          <RightSidebar />
        </div>
      </div>

      {/* ------------------------------------------- */}
      {/*     DEBUG: TRAILER THUMBNAIL PREVIEW        */}
      {/* ------------------------------------------- */}
      {trailerThumbBase && trailerSrc && (
        <div
          style={{
            marginTop: "3rem",
            maxWidth: "80rem",
            marginLeft: "auto",
            marginRight: "auto",
            padding: "2rem 1.5rem",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: "0.75rem",
              color: "#888",
              marginBottom: "0.5rem",
            }}
          >
            Trailer thumbnail (debug)
          </p>

          <div className="relative overflow-hidden rounded-lg">
            <img
              src={trailerSrc}
              alt={`${anime.title} trailer thumbnail`}
              onError={() => {
                // fallback chain: maxres -> sd -> hq
                if (trailerThumbHi && trailerSrc === trailerThumbHi) {
                  setTrailerSrc(trailerThumbMd || trailerThumbBase);
                  return;
                }
                if (trailerThumbMd && trailerSrc === trailerThumbMd) {
                  setTrailerSrc(trailerThumbBase);
                  return;
                }
              }}
              style={{
                width: "100%",
                display: "block",
              }}
            />

            {/* ✅ SAME overlay mask, stretched to fit any aspect */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: `url(${overlayMaskUrl})`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
                backgroundSize: "100% 100%",
              }}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default AnimePage;
