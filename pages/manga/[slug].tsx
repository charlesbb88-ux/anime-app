// pages/manga/[slug].tsx

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import Link from "next/link";

import { supabase } from "@/lib/supabaseClient";

import LeftSidebar from "../../components/LeftSidebar";
import RightSidebar from "../../components/RightSidebar";
import PostFeed from "../../components/PostFeed";

type Manga = {
  id: string;
  title: string;
  slug: string;
  total_chapters: number | null;
  total_volumes: number | null;
  image_url: string | null;
  banner_image_url: string | null;

  title_english: string | null;
  title_native: string | null;
  title_preferred: string | null;

  description: string | null;
  format: string | null;
  status: string | null;
  season: string | null;
  season_year: number | null;
  start_date: string | null;
  end_date: string | null;
  average_score: number | null;
  source: string | null;

  genres: string[] | null;

  created_at: string;
};

type MangaTag = {
  id: number;
  manga_id: string;
  name: string;
  description: string | null;
  rank: number | null;
  is_adult: boolean | null;
  is_general_spoiler: boolean | null;
  is_media_spoiler: boolean | null;
  category: string | null;
};

const MangaPage: NextPage = () => {
  const router = useRouter();

  const [slug, setSlug] = useState<string | null>(null);
  const [manga, setManga] = useState<Manga | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [tags, setTags] = useState<MangaTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [showSpoilers, setShowSpoilers] = useState(false);

  // Normalize slug from router.query into a clean string
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

  // Fetch manga by slug
  useEffect(() => {
    if (!slug) {
      setManga(null);
      setLoading(false);
      return;
    }

    const slugValue: string = slug;
    let isMounted = true;

    async function fetchManga() {
      setLoading(true);
      setErrorMessage(null);

      const { data, error } = await supabase
        .from("manga")
        .select("*")
        .eq("slug", slugValue)
        .maybeSingle();

      if (!isMounted) return;

      if (error || !data) {
        console.error("Error fetching manga by slug", error);
        setManga(null);
        setErrorMessage("Manga not found.");
      } else {
        setManga(data as Manga);
      }

      setLoading(false);
    }

    fetchManga();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  // Fetch tags for this manga from manga_tags
  useEffect(() => {
    if (!manga?.id) {
      setTags([]);
      return;
    }

    const mangaId = manga.id;
    let isMounted = true;

    async function fetchTags() {
      setTagsLoading(true);

      const { data, error } = await supabase
        .from("manga_tags")
        .select(
          "id, manga_id, name, description, rank, is_adult, is_general_spoiler, is_media_spoiler, category"
        )
        .eq("manga_id", mangaId)
        .order("rank", { ascending: false }); // highest rank first

      if (!isMounted) return;

      if (error || !data) {
        console.error("Error fetching manga_tags", error);
        setTags([]);
      } else {
        setTags(data as MangaTag[]);
      }

      setTagsLoading(false);
    }

    fetchTags();

    return () => {
      isMounted = false;
    };
  }, [manga?.id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold">Loading manga...</h1>
        <p className="text-sm text-gray-400">
          Please wait while we fetch this manga.
        </p>
      </div>
    );
  }

  if (!manga) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="mb-4 text-2xl font-bold">Manga not found</h1>
        {errorMessage && (
          <p className="mb-2 text-gray-300">{errorMessage}</p>
        )}
        <p className="mb-4 text-gray-400">
          We couldn&apos;t find a manga with that URL.
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

  const pageTitle = manga.title;

  const m: any = manga;
  const hasGenres = Array.isArray(m.genres) && m.genres.length > 0;
  const genres: string[] = m.genres || [];

  // Pre-calc spoiler tags & count for toggle text
  const spoilerTags = tags.filter(
    (tag) => tag.is_general_spoiler === true || tag.is_media_spoiler === true
  );
  const spoilerCount = spoilerTags.length;

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Banner image */}
        {m.banner_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={m.banner_image_url}
            alt={`${manga.title} banner`}
            className="mb-6 h-40 w-full rounded-lg object-cover"
          />
        )}

        {/* Header section: cover + info */}
        <div className="mb-8 flex flex-col gap-6 md:flex-row">
          {/* Cover image */}
          <div className="flex-shrink-0">
            {manga.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={manga.image_url}
                alt={manga.title}
                className="h-64 w-44 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-64 w-44 items-center justify-center rounded-lg bg-gray-800 text-4xl font-bold text-gray-200">
                {manga.title[0] ?? "?"}
              </div>
            )}
          </div>

          {/* Text info */}
          <div className="flex-1">
            <h1 className="mb-1 text-3xl font-bold">{pageTitle}</h1>

            {/* Alternate titles */}
            {(m.title_english || m.title_native) && (
              <div className="mb-2 text-sm text-gray-400">
                {m.title_english && (
                  <div>
                    <span className="font-semibold text-gray-300">
                      English:
                    </span>{" "}
                    {m.title_english}
                  </div>
                )}
                {m.title_native && (
                  <div>
                    <span className="font-semibold text-gray-300">
                      Native:
                    </span>{" "}
                    {m.title_native}
                  </div>
                )}
              </div>
            )}

            {/* Volumes / Chapters */}
            <p className="mb-1 text-sm text-gray-400">
              Volumes:{" "}
              <span className="font-semibold text-gray-100">
                {manga.total_volumes ?? "Unknown"}
              </span>
            </p>

            <p className="mb-1 text-sm text-gray-400">
              Chapters:{" "}
              <span className="font-semibold text-gray-100">
                {manga.total_chapters ?? "Unknown"}
              </span>
            </p>

            <p className="mb-1 text-sm text-gray-400">
              Format:{" "}
              <span className="font-semibold text-gray-100">
                {m.format ?? "—"}
              </span>
            </p>

            <p className="mb-1 text-sm text-gray-400">
              Status:{" "}
              <span className="font-semibold text-gray-100">
                {m.status ?? "—"}
              </span>
            </p>

            {(m.start_date || m.end_date) && (
              <p className="mb-1 text-sm text-gray-400">
                Published:{" "}
                <span className="font-semibold text-gray-100">
                  {m.start_date ?? "?"}
                  {(m.start_date || m.end_date) && " – "}
                  {m.end_date ?? "?"}
                </span>
              </p>
            )}

            {(m.season || m.season_year) && (
              <p className="mb-1 text-sm text-gray-400">
                Season:{" "}
                <span className="font-semibold text-gray-100">
                  {m.season ?? "?"} {m.season_year ?? ""}
                </span>
              </p>
            )}

            {typeof m.average_score === "number" && (
              <p className="mb-1 text-sm text-gray-400">
                Score:{" "}
                <span className="font-semibold text-gray-100">
                  {m.average_score}/100
                </span>
              </p>
            )}

            {m.source && (
              <p className="mb-2 text-sm text-gray-400">
                Source:{" "}
                <span className="font-semibold text-gray-100">{m.source}</span>
              </p>
            )}

            <p className="mt-2 text-xs text-gray-500">
              Manga ID: <code className="text-[10px]">{manga.id}</code>
            </p>
          </div>
        </div>

        {/* Synopsis / description */}
        {m.description && (
          <div className="mb-6">
            <h2 className="mb-1 text-sm font-semibold text-gray-300">
              Synopsis
            </h2>
            <p className="whitespace-pre-line text-sm text-gray-200">
              {m.description}
            </p>
          </div>
        )}

        {/* Genres */}
        {hasGenres && (
          <div className="mb-6">
            <h2 className="mb-1 text-sm font-semibold text-gray-300">
              Genres
            </h2>
            <div className="flex flex-wrap gap-2">
              {genres.map((genre) => (
                <span
                  key={genre}
                  className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-100"
                >
                  {genre}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tags: compact column, mini bar, spoilers hidden by default */}
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
              No tags imported yet for this manga.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <div className="flex w-full max-w-[13.5rem] flex-col gap-1">
                  {tags.map((tag) => {
                    const isSpoiler =
                      tag.is_general_spoiler === true ||
                      tag.is_media_spoiler === true;

                    if (isSpoiler && !showSpoilers) {
                      return null;
                    }

                    let percent: number | null = null;
                    if (typeof tag.rank === "number") {
                      percent = Math.max(0, Math.min(100, Math.round(tag.rank)));
                    }

                    const tagNameClass = isSpoiler
                      ? "text-red-400"
                      : "text-gray-100";

                    return (
                      <div key={tag.id} className="group relative inline-flex">
                        <span
                          className="
                            relative
                            inline-flex
                            w-full
                            items-center
                            justify-between
                            rounded-full
                            border
                            border-gray-700
                            bg-gray-900/80
                            px-3
                            py-[3px]
                            text-[13px]
                            font-medium
                            overflow-hidden
                            whitespace-nowrap
                          "
                        >
                          {percent !== null && (
                            <span
                              className="pointer-events-none absolute inset-y-0 left-0 bg-blue-500/20"
                              style={{ width: `${percent}%` }}
                            />
                          )}

                          <span className={`relative ${tagNameClass}`}>
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
                              pointer-events-none
                              absolute
                              left-0
                              top-full
                              z-20
                              mt-1
                              w-64
                              rounded-md
                              bg-black
                              px-3
                              py-2
                              text-xs
                              text-gray-100
                              shadow-lg
                              opacity-0
                              translate-y-1
                              group-hover:opacity-100
                              group-hover:translate-y-0
                              transition
                              duration-200
                              delay-150
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

        {/* Simple back link for now */}
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
          {/* Manga-level feed */}
          <PostFeed mangaId={manga.id} />
        </div>

        <div>
          <RightSidebar />
        </div>
      </div>
    </>
  );
};

export default MangaPage;
