// pages/manga/[slug]/chapter/[chapterNumber].tsx

import { useRouter } from "next/router";
import type { NextPage } from "next";
import { useEffect, useState } from "react";
import type { Manga, MangaChapter } from "@/lib/types";
import { getMangaBySlug, getMangaChapter } from "@/lib/manga";

// ⭐ ADD
import LeftSidebar from "../../../../components/LeftSidebar";
import RightSidebar from "../../../../components/RightSidebar";
import PostFeed from "../../../../components/PostFeed";

const MangaChapterPage: NextPage = () => {
  const router = useRouter();
  const { slug, chapterNumber } = router.query;

  const [manga, setManga] = useState<Manga | null>(null);
  const [isMangaLoading, setIsMangaLoading] = useState(true);
  const [mangaError, setMangaError] = useState<string | null>(null);

  const [chapter, setChapter] = useState<MangaChapter | null>(null);
  const [isChapterLoading, setIsChapterLoading] = useState(false);
  const [chapterError, setChapterError] = useState<string | null>(null);

  // Normalize slug and chapterNumber to strings
  const slugString = Array.isArray(slug) ? slug[0] : slug ?? "";
  const chapterNumberString = Array.isArray(chapterNumber)
    ? chapterNumber[0]
    : chapterNumber ?? "";

  const chapterNum = Number(chapterNumberString);
  const isValidChapterNumber = Number.isInteger(chapterNum) && chapterNum > 0;

  // Load manga by slug once the router is ready and slug is valid
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

  // Load chapter once we know the manga (to get manga.id) and have a valid chapter number
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

  return (
    <>
      {/* TOP SECTION (your existing content) */}
      <main className="min-h-screen px-4 py-8">
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
        </header>

        <section className="space-y-4">
          <div>
            <p className="text-sm text-gray-600">
              This is still an early version of the manga chapter page.
            </p>
            <p className="text-xs text-gray-500">
              slug: <code className="font-mono">{slugString}</code>
            </p>
            <p className="text-xs text-gray-500">
              chapterNumber: <code className="font-mono">{chapterNum}</code>
            </p>
          </div>

          {manga && (
            <div className="mt-2 border-t border-gray-200 pt-4 space-y-1">
              <p className="text-sm font-semibold">Manga details</p>
              <p className="text-sm text-gray-700">
                Title: <span className="font-medium">{manga.title}</span>
              </p>
              {manga.title_english && (
                <p className="text-xs text-gray-600">
                  English: {manga.title_english}
                </p>
              )}
              {manga.title_native && (
                <p className="text-xs text-gray-600">
                  Native: {manga.title_native}
                </p>
              )}
              {typeof manga.total_chapters === "number" && (
                <p className="text-xs text-gray-600">
                  Total chapters: {manga.total_chapters}
                </p>
              )}
            </div>
          )}

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

                {chapter.release_date && (
                  <p className="text-xs text-gray-600">
                    Release date:{" "}
                    {new Date(chapter.release_date).toLocaleString()}
                  </p>
                )}

                {chapter.synopsis && (
                  <p className="text-sm text-gray-700 mt-2">
                    {chapter.synopsis}
                  </p>
                )}

                {!chapter.title && !chapter.synopsis && (
                  <p className="text-xs text-gray-500">
                    No title or synopsis has been added for this chapter yet.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* DISCUSSION / FEED SECTION (same layout style as anime pages) */}
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
          {/* Only render the feed once we have the chapter id */}
          {manga?.id && chapter?.id ? (
            <PostFeed mangaId={manga.id} mangaChapterId={chapter.id} />
          ) : (
            <p className="text-sm text-gray-500">Loading discussion…</p>
          )}
        </div>

        <div>
          <RightSidebar />
        </div>
      </div>
    </>
  );
};

export default MangaChapterPage;
