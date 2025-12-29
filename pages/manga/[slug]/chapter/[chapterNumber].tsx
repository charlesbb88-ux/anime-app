// pages/manga/[slug]/chapter/[chapterNumber].tsx

import { useRouter } from "next/router";
import type { NextPage, GetServerSideProps } from "next";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import type { Manga, MangaChapter } from "@/lib/types";
import { getMangaBySlug, getMangaChapter } from "@/lib/manga";

import MangaQuickLogBox from "@/components/manga/MangaQuickLogBox";

// ✅ chapter review helper
import { createMangaChapterReview } from "@/lib/reviews";

// ✅ chapter log helpers
import { createMangaChapterLog, getMyMangaChapterLogCount } from "@/lib/logs";

// ✅ navigator
import ChapterNavigator from "@/components/ChapterNavigator";

// ✅ Global Log modal
import GlobalLogModal from "@/components/reviews/GlobalLogModal";

// ✅ action box (same entry point as other pages)
import MangaActionBox from "@/components/actions/MangaActionBox";

// ✅ Discussion feed (same as your current chapter page)
import LeftSidebar from "../../../../components/LeftSidebar";
import RightSidebar from "../../../../components/RightSidebar";
import PostFeed from "../../../../components/PostFeed";

import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

type MangaChapterPageProps = {
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

const MangaChapterPage: NextPage<MangaChapterPageProps> = ({ initialBackdropUrl }) => {
  const router = useRouter();
  const { slug, chapterNumber } = router.query;

  const [manga, setManga] = useState<Manga | null>(null);
  const [isMangaLoading, setIsMangaLoading] = useState(true);
  const [mangaError, setMangaError] = useState<string | null>(null);

  const [chapter, setChapter] = useState<MangaChapter | null>(null);
  const [isChapterLoading, setIsChapterLoading] = useState(false);
  const [chapterError, setChapterError] = useState<string | null>(null);

  // ✅ backdrop pool (SSR first, then can update client-side if you want)
  const [backdropUrl, setBackdropUrl] = useState<string | null>(initialBackdropUrl);

  // ✅ tags (same as main manga page)
  const [tags, setTags] = useState<MangaTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [showSpoilers, setShowSpoilers] = useState(false);

  // ✅ test review state
  const [savingReview, setSavingReview] = useState(false);
  const [reviewSaveMsg, setReviewSaveMsg] = useState<string | null>(null);

  // ✅ logging state (direct test + count)
  const [savingLog, setSavingLog] = useState(false);
  const [logSaveMsg, setLogSaveMsg] = useState<string | null>(null);
  const [myLogCount, setMyLogCount] = useState<number | null>(null);

  // ✅ open/close the log modal
  const [logOpen, setLogOpen] = useState(false);

  // ✅ Force PostFeed refresh after saving review/log (no PostFeed changes)
  const [feedNonce, setFeedNonce] = useState(0);

  // ✅ force ActionBox to remount so marks refresh immediately (no page refresh)
  const [actionBoxNonce, setActionBoxNonce] = useState(0);

  // Normalize slug + chapterNumber to strings
  const slugString = useMemo(() => {
    return Array.isArray(slug) ? slug[0] : slug ?? "";
  }, [slug]);

  const chapterNumberString = useMemo(() => {
    return Array.isArray(chapterNumber) ? chapterNumber[0] : chapterNumber ?? "";
  }, [chapterNumber]);

  // ✅ allow decimals (0.5, 14.5, etc.)
  const trimmed = String(chapterNumberString).trim();
  const isNumericLike = /^(\d+)(\.\d+)?$/.test(trimmed);
  const chapterNum = isNumericLike ? Number(trimmed) : NaN;
  const isValidChapterNumber = Number.isFinite(chapterNum) && chapterNum > 0;

  // Load manga by slug
  useEffect(() => {
    if (!router.isReady) return;
    if (!slugString) return;

    let isCancelled = false;

    const loadManga = async () => {
      setIsMangaLoading(true);
      setMangaError(null);

      const { data, error } = await getMangaBySlug(slugString);

      if (isCancelled) return;

      if (error) {
        console.error("Error loading manga by slug:", error);
        setManga(null);
        setMangaError("Failed to load manga.");
      } else if (!data) {
        setManga(null);
        setMangaError("Manga not found.");
      } else {
        setManga(data);
        setMangaError(null);
      }

      setIsMangaLoading(false);
    };

    loadManga();

    return () => {
      isCancelled = true;
    };
  }, [router.isReady, slugString]);

  // ✅ Backdrop: optional client refresh if SSR didn't provide one
  useEffect(() => {
    const mangaId = manga?.id;
    if (!mangaId) return;

    // If SSR already gave us a backdrop, you can keep it.
    // If you want it to randomize again client-side, remove this guard.
    if (backdropUrl) return;

    let cancelled = false;

    async function run() {
      const { data, error } = await supabase
        .from("manga_covers")
        .select("cached_url")
        .eq("manga_id", mangaId)
        .not("cached_url", "is", null)
        .limit(200);

      if (cancelled) return;

      if (error) {
        console.warn("[MangaChapterPage] manga_covers select failed:", error);
        return;
      }

      const urls =
        Array.isArray(data)
          ? (data as any[])
              .map((r) => (typeof r?.cached_url === "string" ? r.cached_url.trim() : ""))
              .filter(Boolean)
          : [];

      if (urls.length === 0) {
        const fallback =
          typeof (manga as any)?.banner_image_url === "string" &&
          (manga as any).banner_image_url.trim()
            ? (manga as any).banner_image_url.trim()
            : null;

        setBackdropUrl(fallback);
        return;
      }

      const pick = urls[Math.floor(Math.random() * urls.length)];
      setBackdropUrl(normalizeBackdropUrl(pick));
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [manga?.id, backdropUrl, manga]);

  // ✅ Tags: same fetch + spoiler toggle behavior as main manga page
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

  // Load chapter after manga + valid chapter number
  useEffect(() => {
    if (!manga) return;
    if (!isValidChapterNumber) return;

    let isCancelled = false;

    const loadChapter = async () => {
      setIsChapterLoading(true);
      setChapterError(null);
      setChapter(null);

      const { data, error } = await getMangaChapter(manga.id, chapterNum);

      if (isCancelled) return;

      if (error) {
        console.error("Error loading manga chapter:", error);
        setChapter(null);
        setChapterError("Failed to load chapter.");
      } else if (!data) {
        setChapter(null);
        setChapterError("Chapter not found.");
      } else {
        setChapter(data);
        setChapterError(null);
      }

      setIsChapterLoading(false);
    };

    loadChapter();

    return () => {
      isCancelled = true;
    };
  }, [manga, chapterNum, isValidChapterNumber]);

  // ✅ fetch my log count when chapter loads
  useEffect(() => {
    if (!chapter?.id) {
      setMyLogCount(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      const { count, error } = await getMyMangaChapterLogCount(chapter.id);
      if (cancelled) return;

      if (error) {
        console.error("Error fetching chapter log count:", error);
        setMyLogCount(null);
        return;
      }

      setMyLogCount(count);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [chapter?.id]);

  async function handleTestSaveReview() {
    if (!manga?.id || !chapter?.id) return;

    setSavingReview(true);
    setReviewSaveMsg(null);

    try {
      const result = await createMangaChapterReview({
        manga_id: manga.id,
        manga_chapter_id: chapter.id,
        rating: 87,
        content: `Test review for ${manga.title} - Chapter ${chapterNum} @ ${new Date().toLocaleString()}`,
        contains_spoilers: false,
      });

      if (result.error) {
        console.error("Error saving review:", result.error);
        setReviewSaveMsg(String((result.error as any)?.message || "Failed to save review."));
        return;
      }

      setReviewSaveMsg(`Saved ✅ (review id: ${result.data?.id})`);
      setFeedNonce((n) => n + 1);
    } finally {
      setSavingReview(false);
    }
  }

  async function handleTestLogChapter() {
    if (!manga?.id || !chapter?.id) return;

    setSavingLog(true);
    setLogSaveMsg(null);

    try {
      const result = await createMangaChapterLog({
        manga_id: manga.id,
        manga_chapter_id: chapter.id,
      });

      if (result.error) {
        console.error("Error logging chapter:", result.error);
        setLogSaveMsg(String((result.error as any)?.message || "Failed to log chapter."));
        return;
      }

      setLogSaveMsg(`Logged ✅ (log id: ${result.data?.id})`);

      const { count, error } = await getMyMangaChapterLogCount(chapter.id);
      if (!error) setMyLogCount(count);
    } finally {
      setSavingLog(false);
    }
  }

  if (!router.isReady) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold">Loading chapter...</h1>
        <p className="text-sm text-gray-400">Please wait while we fetch this chapter.</p>
      </div>
    );
  }

  if (!slugString || !isValidChapterNumber) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="mb-4 text-2xl font-bold">Invalid chapter URL</h1>
        <p className="mb-4 text-gray-400">The chapter number or manga slug in the URL is not valid.</p>
        <Link
          href="/"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          Go back home
        </Link>
      </div>
    );
  }

  if (isMangaLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold">Loading manga...</h1>
        <p className="text-sm text-gray-400">Please wait while we fetch this manga.</p>
      </div>
    );
  }

  if (!manga) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="mb-4 text-2xl font-bold">Manga not found</h1>
        {mangaError && <p className="mb-2 text-gray-300">{mangaError}</p>}
        <p className="mb-4 text-gray-400">We couldn&apos;t find a manga with that URL.</p>
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

  const englishTitle =
    typeof m?.title_english === "string" && m.title_english.trim() ? m.title_english.trim() : null;

  const displayPrimaryTitle = englishTitle ?? manga?.title ?? slugString;

  const normalTitle =
    typeof manga?.title === "string" && manga.title.trim() ? manga.title.trim() : null;

  const showSecondaryTitle =
    englishTitle !== null && normalTitle !== null && englishTitle !== normalTitle;

  const hasGenres = Array.isArray((m as any)?.genres) && (m as any).genres.length > 0;
  const genres: string[] = (m as any)?.genres || [];

  const spoilerTags = tags.filter((t) => t.is_general_spoiler === true || t.is_media_spoiler === true);
  const spoilerCount = spoilerTags.length;

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-0 pb-8">
        {/* Backdrop */}
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

            <img
              src="/overlays/my-overlay.png"
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            />
          </div>
        )}

        <div className="-mt-5 relative z-10 px-3">
          <div className="mb-8 flex flex-row gap-7">
            {/* LEFT COLUMN */}
            <div className="flex-shrink-0 w-56">
              {manga?.image_url ? (
                <img
                  src={(manga as any).image_url}
                  alt={manga?.title ?? slugString}
                  className="h-84 w-56 rounded-md object-cover border-2 border-black/100"
                />
              ) : (
                <div className="flex h-64 w-56 items-center justify-center rounded-lg bg-gray-800 text-4xl font-bold text-gray-200">
                  {(manga?.title?.[0] ?? slugString?.[0] ?? "?").toUpperCase()}
                </div>
              )}

              {/* Genres */}
              {hasGenres && (
                <div className="mt-4">
                  <h2 className="mb-1 text-sm font-semibold text-black-300">Genres</h2>
                  <div className="flex flex-wrap gap-2">
                    {genres.map((g) => (
                      <span key={g} className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-100">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
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
                  <p className="text-sm text-gray-500">No tags imported yet for this manga.</p>
                ) : (
                  <>
                    <div className="flex flex-col gap-1">
                      <div className="flex w-full flex-col gap-1">
                        {tags.map((tag) => {
                          const isSpoiler =
                            tag.is_general_spoiler === true || tag.is_media_spoiler === true;

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

                                <span className={`relative ${isSpoiler ? "text-red-400" : "text-gray-100"}`}>
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
                          : `Show ${spoilerCount} spoiler tag${spoilerCount === 1 ? "" : "s"}`}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="min-w-100 flex-1">
              <div className="mb-2">
                <h1 className="text-4xl font-bold leading-tight">{displayPrimaryTitle}</h1>

                {showSecondaryTitle && (
                  <h2 className="mt-1 text-xl font-semibold leading-snug text-gray-500">
                    {normalTitle}
                  </h2>
                )}

                <div className="mt-2">
                  <p className="text-2xl font-bold">Chapter {chapterNum}</p>
                </div>
              </div>

              <div className="relative w-full">
                <div className="absolute right-0 top-1 flex flex-col items-end gap-2">
                  <MangaActionBox
                    key={actionBoxNonce}
                    mangaId={manga?.id ?? null}
                    mangaChapterId={chapter?.id ?? null}
                    onOpenLog={() => setLogOpen(true)}
                    onShowActivity={() =>
                      router.push(`/manga/${slugString}/chapter/${chapterNum}/activity`)
                    }
                  />

                  <MangaQuickLogBox
                    mangaId={manga?.id ?? ""}
                    onOpenLog={(chapterId) => {
                      setLogOpen(true);
                      void chapterId;
                    }}
                  />
                </div>

                <div className="min-w-0 pr-[260px]">
                  {typeof (m as any)?.description === "string" && (m as any).description.trim() && (
                    <div className="mt-6 mb-3">
                      <p className="whitespace-pre-line text-base text-black">
                        {cleanSynopsis((m as any).description)}
                      </p>
                    </div>
                  )}

                  <div className="mt-4 min-w-0 overflow-hidden">
                    <ChapterNavigator
                      slug={slugString}
                      totalChapters={(manga as any)?.total_chapters ?? null}
                      currentChapterNumber={chapterNum}
                    />
                  </div>

                  <div className="mt-4">
                    <Link
                      href={`/manga/${slugString}`}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      ← Back to manga main page
                    </Link>
                  </div>

                  {manga && chapter && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleTestSaveReview}
                        disabled={savingReview}
                        className="rounded-md border border-gray-700 bg-gray-900/40 px-3 py-1 text-xs font-medium text-gray-200 hover:bg-gray-900/60 disabled:opacity-60"
                      >
                        {savingReview ? "Saving…" : "Test: Save chapter review"}
                      </button>

                      <button
                        type="button"
                        onClick={handleTestLogChapter}
                        disabled={savingLog}
                        className="rounded-md border border-gray-700 bg-gray-900/40 px-3 py-1 text-xs font-medium text-gray-200 hover:bg-gray-900/60 disabled:opacity-60"
                      >
                        {savingLog ? "Logging…" : "Test: Log chapter"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setLogOpen(true)}
                        className="rounded-md border border-gray-700 bg-gray-900/40 px-3 py-1 text-xs font-medium text-gray-200 hover:bg-gray-900/60"
                      >
                        Log
                      </button>

                      {typeof myLogCount === "number" && (
                        <span className="text-xs text-gray-400">
                          You logged this{" "}
                          <span className="font-semibold text-gray-200">{myLogCount}</span>{" "}
                          time{myLogCount === 1 ? "" : "s"}
                        </span>
                      )}

                      {reviewSaveMsg && <span className="text-xs text-gray-400">{reviewSaveMsg}</span>}
                      {logSaveMsg && <span className="text-xs text-gray-400">{logSaveMsg}</span>}
                    </div>
                  )}

                  <div className="mt-6 border-t border-gray-200 pt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Chapter details</p>
                      {isChapterLoading && <p className="text-xs text-gray-500">Loading chapter…</p>}
                    </div>

                    {!isChapterLoading && chapterError && (
                      <p className="text-xs text-red-500">{chapterError}</p>
                    )}

                    {!isChapterLoading && !chapterError && !chapter && (
                      <p className="text-xs text-gray-500">
                        No chapter data found for this chapter number.
                      </p>
                    )}

                    {chapter && (
                      <div className="space-y-1">
                        {chapter.title && (
                          <p className="text-sm text-gray-800">
                            Chapter title: <span className="font-medium">{chapter.title}</span>
                          </p>
                        )}

                        {(chapter as any).release_date && (
                          <p className="text-xs text-gray-600">
                            Release date: {new Date((chapter as any).release_date).toLocaleString()}
                          </p>
                        )}

                        {(chapter as any).synopsis ? (
                          <p className="text-sm text-gray-700 mt-2">{(chapter as any).synopsis}</p>
                        ) : (
                          !chapter.title && (
                            <p className="text-xs text-gray-500">
                              No title or synopsis has been added for this chapter yet.
                            </p>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {/* end right col */}
          </div>
        </div>
      </div>

      {/* DISCUSSION / FEED SECTION */}
      <div
        style={{
          marginTop: "1.5rem",
          maxWidth: "80rem",
          marginLeft: "auto",
          marginRight: "auto",
          padding: "2rem 1.5rem",
          display: "grid",
          gridTemplateColumns: "minmax(0, 19rem) minmax(0, 41rem) minmax(0, 19rem)",
          gap: "1rem",
        }}
      >
        <div>
          <LeftSidebar />
        </div>

        <div>
          {manga?.id && chapter?.id ? (
            <PostFeed key={feedNonce} mangaId={manga.id} mangaChapterId={chapter.id} />
          ) : (
            <p className="text-sm text-gray-500">Loading discussion…</p>
          )}
        </div>

        <div>
          <RightSidebar />
        </div>
      </div>

      <GlobalLogModal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        title={displayPrimaryTitle}
        posterUrl={(manga as any)?.image_url ?? null}
        mangaId={manga?.id ?? null}
        mangaChapterId={chapter?.id ?? null}
        onSuccess={async () => {
          setFeedNonce((n) => n + 1);
          setActionBoxNonce((n) => n + 1);

          if (!chapter?.id) return;
          const { count, error } = await getMyMangaChapterLogCount(chapter.id);
          if (!error) setMyLogCount(count);
        }}
      />
    </>
  );
};

// ✅ make header transparent (same as main manga page)
(MangaChapterPage as any).headerTransparent = true;

export default MangaChapterPage;

export const getServerSideProps: GetServerSideProps<MangaChapterPageProps> = async (ctx) => {
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

  // 2) Pull cached images for this manga from public.manga_covers
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
