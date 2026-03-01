// pages/manga/[slug].tsx

import { useEffect, useState } from "react";
import type { NextPage, GetServerSideProps } from "next";
import { useRouter } from "next/router";
import Link from "next/link";
import Image from "next/image";

import MangaMetaBox from "@/components/manga/MangaMetaBox";
import MangaQuickLogBox from "@/components/manga/MangaQuickLogBox";
import ChapterNavigator from "@/components/ChapterNavigator";
import PostFeed from "../../components/PostFeed";
import GlobalLogModal from "@/components/reviews/GlobalLogModal";
import MangaActionBox from "@/components/actions/MangaActionBox";
import EnglishTitle from "@/components/EnglishTitle";

import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createMangaSeriesReview } from "@/lib/reviews";
import { pickEnglishTitle } from "@/lib/pickEnglishTitle";

import FeedShell from "@/components/FeedShell";

import ResponsiveSwitch from "@/components/ResponsiveSwitch";
import MangaPhoneLayout from "@/components/manga/MangaPhoneLayout";

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

type MangaPageProps = {
  initialBackdropUrl: string | null;
};

function normalizeBackdropUrl(url: string) {
  if (url.includes("https://image.tmdb.org/t/p/original/")) {
    return url.replace("/t/p/original/", "/t/p/w1280/");
  }
  return url;
}

function cleanSynopsis(raw: string) {
  let s = raw
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\(Source:.*?\)/gi, "")
    .replace(/<\/?i>/gi, "")
    .replace(/<[^>]+>/g, "");

  s = s
    .replace(/\n---[\s\S]*$/m, "")
    .replace(/\n\*\*Awards:\*\*[\s\S]*$/m, "")
    .replace(/\n\*\*Additional Links:\*\*[\s\S]*$/m, "");

  s = s.replace(/^\s*[-*_]{3,}\s*$/gm, "");
  return s
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n[ \t]+\n/g, "\n\n")
    .trim();
}

const MangaPage: NextPage<MangaPageProps> = ({ initialBackdropUrl }) => {
  const router = useRouter();

  const [slug, setSlug] = useState<string | null>(null);
  const [manga, setManga] = useState<Manga | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [tags, setTags] = useState<MangaTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [showSpoilers, setShowSpoilers] = useState(false);

  // ✅ save review test state
  const [savingReview, setSavingReview] = useState(false);
  const [reviewSaveMsg, setReviewSaveMsg] = useState<string | null>(null);

  // ✅ force PostFeed to remount so it refetches immediately (no page refresh)
  const [feedNonce, setFeedNonce] = useState(0);

  // ✅ force ActionBox to remount so marks refresh immediately (no page refresh)
  const [actionBoxNonce, setActionBoxNonce] = useState(0);

  // ✅ open/close the log modal
  const [logOpen, setLogOpen] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedChapterNumber, setSelectedChapterNumber] = useState<number | null>(null);
  const [chapterLogsNonce, setChapterLogsNonce] = useState(0);

  // ✅ my manga series log count
  const [myMangaSeriesLogCount, setMyMangaSeriesLogCount] = useState<number | null>(
    null
  );

  // Backdrop from SSR (public.manga_covers)
  const [backdropUrl] = useState<string | null>(initialBackdropUrl);

  // Normalize slug
  useEffect(() => {
    if (!router.isReady) return;

    const raw = router.query.slug as string | string[] | undefined;

    if (typeof raw === "string") setSlug(raw);
    else if (Array.isArray(raw) && raw.length > 0) setSlug(raw[0]);
    else setSlug(null);
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

  // Fetch tags
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
        .order("rank", { ascending: false });

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

  // ✅ fetch my manga series log count (soft-fail)
  useEffect(() => {
    const mangaId = manga?.id;
    if (!mangaId) {
      setMyMangaSeriesLogCount(null);
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
        setMyMangaSeriesLogCount(null);
        return;
      }

      const { count, error } = await supabase
        .from("manga_series_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("manga_id", mangaId);

      if (cancelled) return;

      if (error) {
        console.error("Error fetching manga series log count:", error);
        setMyMangaSeriesLogCount(null);
        return;
      }

      setMyMangaSeriesLogCount(count ?? 0);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [manga?.id]);

  // ✅ test review (unchanged behavior)
  async function handleTestSaveReview() {
    if (!manga?.id) return;

    setSavingReview(true);
    setReviewSaveMsg(null);

    try {
      const result = await createMangaSeriesReview({
        manga_id: manga.id,
        rating: 87,
        content: `Test review for ${manga.title} @ ${new Date().toLocaleString()}`,
        contains_spoilers: false,
      });

      if (result.error) {
        console.error("Error saving review:", result.error);
        setReviewSaveMsg(
          String((result.error as any)?.message || "Failed to save review.")
        );
        return;
      }

      const newId = result.data?.review?.id ?? null;
      setReviewSaveMsg(newId ? `Saved ✅ (review id: ${newId})` : "Saved ✅");
      setFeedNonce((n) => n + 1);
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
        {errorMessage && <p className="mb-2 text-gray-300">{errorMessage}</p>}
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

  const m: any = manga;

  const picked = pickEnglishTitle(
    {
      title_english: manga.title_english,
      title_preferred: manga.title_preferred,
      title: manga.title,
      title_native: manga.title_native,
    },
    {
      preferredKeys: ["title_english", "title_preferred", "title"],
      fallbackKeys: ["title_preferred", "title", "title_native", "title_english"],
      minScore: 0.55,
    }
  );

  const displayPrimaryTitle = picked?.value ?? manga.title ?? "Untitled";

  const secondaryTitle =
    typeof manga.title_preferred === "string" &&
      manga.title_preferred.trim() &&
      manga.title_preferred.trim() !== displayPrimaryTitle
      ? manga.title_preferred.trim()
      : null;

  const showSecondaryTitle = Boolean(secondaryTitle);

  const hasGenres = Array.isArray(m.genres) && m.genres.length > 0;
  const genres: string[] = m.genres || [];

  const spoilerTags = tags.filter(
    (t) => t.is_general_spoiler === true || t.is_media_spoiler === true
  );
  const spoilerCount = spoilerTags.length;

  // ------------------------
  // MAIN MANGA PAGE CONTENT
  // ------------------------
  // ------------------------
  // MAIN MANGA PAGE CONTENT
  // ------------------------

  const desktopView = (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-0 pb-8">
        {/* Backdrop (from SSR public.manga_covers) */}
        {backdropUrl && (
          <div className="relative h-[620px] w-full overflow-hidden">
            <Image
              src={backdropUrl}
              alt=""
              width={1920}
              height={1080}
              priority
              unoptimized
              sizes="100vw"
              className="h-full w-full object-cover object-[50%_25%]"
            />

            {/* Overlay (same as anime page) */}
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
            {/* LEFT COLUMN */}
            <div className="flex-shrink-0 w-56">
              {/* Poster */}
              {manga.image_url ? (
                <img
                  src={manga.image_url}
                  alt={manga.title}
                  className="h-84 w-56 rounded-md object-cover border-3 border-black/100"
                />
              ) : (
                <div className="flex h-64 w-56 items-center justify-center rounded-lg bg-gray-800 text-4xl font-bold text-gray-200">
                  {manga.title?.[0] ?? "?"}
                </div>
              )}

              {/* Genres */}
              {hasGenres && (
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
              )}

              {/* Tags */}
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
                          tag.is_general_spoiler === true ||
                          tag.is_media_spoiler === true;

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
                        ? `Hide ${spoilerCount} spoiler tag${spoilerCount === 1 ? "" : "s"
                        }`
                        : `Show ${spoilerCount} spoiler tag${spoilerCount === 1 ? "" : "s"
                        }`}
                    </button>
                  )}
                </div>
              )}

              <div className="mt-8">
                <MangaMetaBox
                  titleEnglish={manga.title_english}
                  titlePreferred={manga.title_preferred}
                  titleNative={manga.title_native}
                  totalVolumes={manga.total_volumes}
                  totalChapters={manga.total_chapters}
                  format={m.format}
                  status={m.status}
                  startDate={m.start_date}
                  endDate={m.end_date}
                  season={m.season}
                  seasonYear={m.season_year}
                  averageScore={m.average_score}
                />
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="min-w-100 flex-1">
              {/* ROW 1 — PRIMARY TITLE ONLY (no secondary here) */}
              <div className="mb-0 pl-1">
                <EnglishTitle
                  as="h1"
                  className="text-4xl font-bold leading-tight"
                  titles={{
                    title_english: manga.title_english,
                    title_preferred: manga.title_preferred,
                    title: manga.title,
                    title_native: manga.title_native,
                  }}
                  fallback={manga.title ?? manga.title_native ?? "Untitled"}
                />
              </div>

              {/* ROW 2 — LEFT CONTENT + ActionBox pinned top-right */}
              <div className="relative w-full">
                {/* RIGHT SIDE: ActionBox (pinned) */}
                <div className="absolute right-0 top-6 flex flex-col items-end gap-2">
                  <MangaActionBox
                    key={actionBoxNonce}
                    mangaId={manga.id}
                    onOpenLog={() => {
                      setSelectedChapterId(null);
                      setSelectedChapterNumber(null);
                      setLogOpen(true);
                    }}
                    onShowActivity={() => router.push(`/manga/${manga.slug}/activity`)}
                  />

                  <MangaQuickLogBox
                    mangaId={manga.id}
                    totalChapters={manga.total_chapters}
                    refreshToken={chapterLogsNonce}
                    onOpenLog={(chapterId, chapterNumber) => {
                      setSelectedChapterId(chapterId ?? null);
                      setSelectedChapterNumber(
                        typeof chapterNumber === "number" && Number.isFinite(chapterNumber) ? chapterNumber : null
                      );
                      setLogOpen(true);
                    }}
                  />
                </div>

                {/* LEFT SIDE: reserve space so text never goes under ActionBox */}
                <div className="min-w-0 pr-[270px] pl-1">
                  {showSecondaryTitle && secondaryTitle && (
                    <h2 className="mt-0 text-xl font-semibold leading-snug text-gray-500">
                      {secondaryTitle}
                    </h2>
                  )}

                  {typeof m.description === "string" && m.description.trim() && (
                    <div className="mt-6 mb-3">
                      <p className="whitespace-pre-line text-base text-black">
                        {cleanSynopsis(m.description)}
                      </p>
                    </div>
                  )}

                  {slug && (
                    <div className="mt-10 min-w-0 overflow-hidden">
                      <ChapterNavigator
                        slug={slug}
                        totalChapters={manga.total_chapters}
                        currentChapterNumber={null}
                      />
                    </div>
                  )}

                  <div className="mt-6">
                    <FeedShell>
                      <PostFeed key={feedNonce} mangaId={manga.id} />
                    </FeedShell>
                  </div>
                </div>
              </div>

              {reviewSaveMsg ? null : null}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-4">
          <Link href={`/manga/${slug}/art`} className="text-sm text-blue-500 hover:underline">
            Art
          </Link>

          <Link href="/" className="text-xs text-blue-400 hover:text-blue-300">
            ← Back home
          </Link>
        </div>
      </div>
    </>
  );

  const phoneView = (
    <MangaPhoneLayout
      slug={slug}
      manga={manga}
      backdropUrl={backdropUrl}
      tags={tags}
      tagsLoading={tagsLoading}
      showSpoilers={showSpoilers}
      setShowSpoilers={setShowSpoilers}
      cleanSynopsis={cleanSynopsis}
      actionBoxNonce={actionBoxNonce}
      chapterLogsNonce={chapterLogsNonce}
      onOpenLog={() => {
        setSelectedChapterId(null);
        setSelectedChapterNumber(null);
        setLogOpen(true);
      }}
      onShowActivity={() => router.push(`/manga/${manga.slug}/activity`)}
      onOpenLogForChapter={(chapterId, chapterNumber) => {
        setSelectedChapterId(chapterId ?? null);
        setSelectedChapterNumber(
          typeof chapterNumber === "number" && Number.isFinite(chapterNumber)
            ? chapterNumber
            : null
        );
        setLogOpen(true);
      }}
      feedNonce={feedNonce}
      reviewSaveMsg={reviewSaveMsg}
    />
  );
  return (
    <>
      <ResponsiveSwitch desktop={desktopView} phone={phoneView} />

      {/* ✅ Global log modal stays OUTSIDE so behavior is identical everywhere */}
      <GlobalLogModal
        open={logOpen}
        onClose={() => {
          setLogOpen(false);
          setSelectedChapterId(null);
          setSelectedChapterNumber(null);
        }}
        title={displayPrimaryTitle}
        posterUrl={manga.image_url}
        mangaId={manga.id}
        mangaChapterId={selectedChapterId}
        mangaChapterNumber={selectedChapterNumber}
        onSuccess={async () => {
          if (selectedChapterId) {
            setChapterLogsNonce((n) => n + 1);
          }

          const {
            data: { user },
            error: userError,
          } = await supabase.auth.getUser();

          if (userError || !user) return;

          const { count: myCount, error: myErr } = await supabase
            .from("manga_series_logs")
            .select("id", { count: "exact", head: true })
            .eq("manga_id", manga.id)
            .eq("user_id", user.id);

          if (!myErr) setMyMangaSeriesLogCount(myCount ?? 0);

          setActionBoxNonce((n) => n + 1);
          setFeedNonce((n) => n + 1);
        }}
      />
    </>
  );
};

(MangaPage as any).headerTransparent = true;

export default MangaPage;

export const getServerSideProps: GetServerSideProps<MangaPageProps> = async (ctx) => {
  const raw = ctx.params?.slug;
  const slug =
    typeof raw === "string" ? raw : Array.isArray(raw) && raw[0] ? raw[0] : null;

  if (!slug) {
    return { props: { initialBackdropUrl: null } };
  }

  // 1) Get manga id by slug (server-side)
  const { data: mangaRow, error: mangaErr } = await supabaseAdmin
    .from("manga")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (mangaErr || !mangaRow?.id) {
    return { props: { initialBackdropUrl: null } };
  }

  // 2) Pull ALL cached images for this manga from public.manga_covers
  const { data: covers, error: coverErr } = await supabaseAdmin
    .from("manga_covers")
    .select("cached_url")
    .eq("manga_id", mangaRow.id)
    .not("cached_url", "is", null)
    .limit(200);

  if (coverErr || !covers || covers.length === 0) {
    return { props: { initialBackdropUrl: null } };
  }

  const urls = covers
    .map((c: any) => (typeof c.cached_url === "string" ? c.cached_url.trim() : ""))
    .filter(Boolean);

  if (urls.length === 0) {
    return { props: { initialBackdropUrl: null } };
  }

  const pick = urls[Math.floor(Math.random() * urls.length)];

  return {
    props: {
      initialBackdropUrl: normalizeBackdropUrl(pick),
    },
  };
};
