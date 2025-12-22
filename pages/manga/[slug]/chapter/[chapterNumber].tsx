// pages/manga/[slug]/chapter/[chapterNumber].tsx
"use client";

import { useRouter } from "next/router";
import type { NextPage } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { Manga, MangaChapter } from "@/lib/types";
import { getMangaBySlug, getMangaChapter } from "@/lib/manga";

// ✅ chapter review helper
import { createMangaChapterReview } from "@/lib/reviews";

// ✅ chapter log helpers
import {
  createMangaChapterLog,
  getMyMangaChapterLogCount,
} from "@/lib/logs";

// ✅ navigator
import ChapterNavigator from "@/components/ChapterNavigator";

import LeftSidebar from "../../../../components/LeftSidebar";
import RightSidebar from "../../../../components/RightSidebar";
import PostFeed from "../../../../components/PostFeed";

// ✅ Global Log modal
import GlobalLogModal from "@/components/reviews/GlobalLogModal";

// ✅ action box (same entry point as other pages)
import MangaActionBox from "@/components/actions/MangaActionBox";

const MangaChapterPage: NextPage = () => {
  const router = useRouter();
  const { slug, chapterNumber } = router.query;

  const [manga, setManga] = useState<Manga | null>(null);
  const [isMangaLoading, setIsMangaLoading] = useState(true);
  const [mangaError, setMangaError] = useState<string | null>(null);

  const [chapter, setChapter] = useState<MangaChapter | null>(null);
  const [isChapterLoading, setIsChapterLoading] = useState(false);
  const [chapterError, setChapterError] = useState<string | null>(null);

  // ✅ review test state
  const [savingReview, setSavingReview] = useState(false);
  const [reviewSaveMsg, setReviewSaveMsg] = useState<string | null>(null);

  // ✅ logging state (direct test + count)
  const [savingLog, setSavingLog] = useState(false);
  const [logSaveMsg, setLogSaveMsg] = useState<string | null>(null);
  const [myLogCount, setMyLogCount] = useState<number | null>(null);

  // ✅ modal open/close
  const [logOpen, setLogOpen] = useState(false);

  // ✅ Force PostFeed refresh after saving review (no PostFeed changes)
  const [feedNonce, setFeedNonce] = useState(0);

  // Normalize slug and chapterNumber to strings
  const slugString = Array.isArray(slug) ? slug[0] : slug ?? "";
  const chapterNumberString = Array.isArray(chapterNumber)
    ? chapterNumber[0]
    : chapterNumber ?? "";

  const chapterNum = Number(chapterNumberString);
  const isValidChapterNumber = Number.isInteger(chapterNum) && chapterNum > 0;

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

  function handleShowActivity() {
    // must have both ids for a chapter-scoped activity view
    if (!manga?.id || !chapter?.id) return;

    // ✅ Option A (recommended): query params (easy, flexible)
    router.push({
      pathname: "/activity",
      query: {
        mangaId: manga.id,
        mangaChapterId: chapter.id,
      },
    });

    // ✅ Option B (if you already use a dedicated route pattern):
    // router.push(`/manga/${slugString}/chapter/${chapterNum}/activity`);
  }

  // ✅ TEMP: test save chapter review
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
        setReviewSaveMsg(
          String((result.error as any)?.message || "Failed to save review.")
        );
        return;
      }

      setReviewSaveMsg(`Saved ✅ (review id: ${result.data?.id})`);
      setFeedNonce((n) => n + 1);
    } finally {
      setSavingReview(false);
    }
  }

  // ✅ TEMP: test log chapter directly (INSERT ONLY)
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
        setLogSaveMsg(
          String((result.error as any)?.message || "Failed to log chapter.")
        );
        return;
      }

      setLogSaveMsg(`Logged ✅ (log id: ${result.data?.id})`);

      // refresh count
      const { count, error } = await getMyMangaChapterLogCount(chapter.id);
      if (!error) setMyLogCount(count);
    } finally {
      setSavingLog(false);
    }
  }

  if (!router.isReady) {
    return (
      <main className="min-h-screen px-4 py-8">
        <p className="text-sm text-gray-500">Loading chapter…</p>
      </main>
    );
  }

  if (!slugString || !isValidChapterNumber) {
    return (
      <main className="min-h-screen px-4 py-8">
        <h1 className="text-xl font-semibold mb-2">Invalid chapter URL</h1>
        <p className="text-sm text-gray-500">
          The chapter number or manga slug in the URL is not valid.
        </p>
      </main>
    );
  }

  const m: any = manga;

  return (
    <>
      <main className="min-h-screen px-4 py-8">
        {m?.banner_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={m.banner_image_url}
            alt={`${manga?.title ?? slugString} banner`}
            className="mb-6 h-40 w-full rounded-lg object-cover"
          />
        )}

        <header className="mb-6">
          <p className="text-sm text-gray-500 mb-1">Manga chapter page</p>
          <h1 className="text-2xl font-bold">
            {manga?.title ?? slugString} — Chapter {chapterNum}
          </h1>

          {isMangaLoading && (
            <p className="text-xs text-gray-500 mt-1">Loading manga details…</p>
          )}

          {!isMangaLoading && mangaError && (
            <p className="text-xs text-red-500 mt-1">{mangaError}</p>
          )}

          <div className="mt-4">
            <ChapterNavigator
              slug={slugString}
              totalChapters={manga?.total_chapters ?? null}
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
                  <span className="font-semibold text-gray-200">
                    {myLogCount}
                  </span>{" "}
                  time{myLogCount === 1 ? "" : "s"}
                </span>
              )}

              {reviewSaveMsg && (
                <span className="text-xs text-gray-400">{reviewSaveMsg}</span>
              )}
              {logSaveMsg && (
                <span className="text-xs text-gray-400">{logSaveMsg}</span>
              )}
            </div>
          )}

          {/* ✅ same entry point style as other pages */}
          <div className="mt-3">
            {manga?.id && chapter?.id ? (
              <MangaActionBox
                mangaId={manga.id}
                mangaChapterId={chapter.id}
                onOpenLog={() => setLogOpen(true)}
                onShowActivity={() => router.push(`/manga/${slugString}/chapter/${chapterNum}/activity`)}
              />
            ) : (
              <div className="text-xs text-gray-500">Loading actions…</div>
            )}
          </div>

        </header>

        <section className="space-y-4">
          <div className="mt-4 border-t border-gray-200 pt-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Chapter details</p>
              {isChapterLoading && (
                <p className="text-xs text-gray-500">Loading chapter…</p>
              )}
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
                    Chapter title:{" "}
                    <span className="font-medium">{chapter.title}</span>
                  </p>
                )}

                {(chapter as any).release_date && (
                  <p className="text-xs text-gray-600">
                    Release date:{" "}
                    {new Date((chapter as any).release_date).toLocaleString()}
                  </p>
                )}

                {(chapter as any).synopsis ? (
                  <p className="text-sm text-gray-700 mt-2">
                    {(chapter as any).synopsis}
                  </p>
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
        </section>
      </main>

      {/* DISCUSSION / FEED SECTION */}
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
          {manga?.id && chapter?.id ? (
            <PostFeed
              key={feedNonce}
              mangaId={manga.id}
              mangaChapterId={chapter.id}
            />
          ) : (
            <p className="text-sm text-gray-500">Loading discussion…</p>
          )}
        </div>

        <div>
          <RightSidebar />
        </div>
      </div>

      {/* ✅ Global log modal (manga chapter) */}
      <GlobalLogModal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        title={manga?.title ?? null}
        posterUrl={(manga as any)?.image_url ?? null}
        mangaId={manga?.id ?? null}
        mangaChapterId={chapter?.id ?? null}
        onSuccess={async () => {
          // ✅ refresh discussion feed immediately (same behavior as other pages)
          setFeedNonce((n) => n + 1);

          // keep your existing count refresh
          if (!chapter?.id) return;
          const { count, error } = await getMyMangaChapterLogCount(chapter.id);
          if (!error) setMyLogCount(count);
        }}
      />
    </>
  );
};

export default MangaChapterPage;
