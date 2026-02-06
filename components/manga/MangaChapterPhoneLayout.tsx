// components/manga/MangaChapterPhoneLayout.tsx

"use client";

import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import Image from "next/image";

import MangaActionBoxMobile from "@/components/actions/MangaActionBoxMobile";
import MangaQuickLogBoxMobile from "@/components/manga/MangaQuickLogBoxMobile";
import ChapterNavigatorMobile from "@/components/ChapterNavigatorMobile";
import FeedShell from "@/components/FeedShell";
import PostFeed from "@/components/PostFeed";

import EnglishTitle from "@/components/EnglishTitle";
import MangaChapterSummary from "@/components/manga/MangaChapterSummary";
import MangaInfoDropdownMobile from "@/components/manga/MangaInfoDropdownMobile";

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

type MangaChapter = {
  id: string;
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

export default function MangaChapterPhoneLayout(props: {
  slug: string;
  chapterNum: number;

  manga: Manga;
  chapter: MangaChapter | null;

  backdropUrl: string | null;
  chapterPosterUrl: string | null;

  tags: MangaTag[];
  tagsLoading: boolean;
  showSpoilers: boolean;
  setShowSpoilers: Dispatch<SetStateAction<boolean>>;

  actionBoxNonce: number;
  chapterLogsNonce: number;

  onOpenLog: () => void;
  onShowActivity: () => void;
  onOpenLogForChapter: (chapterId: string | null) => void;

  feedNonce: number;

  communityTopSummary: { content: string; contains_spoilers: boolean } | null;
  setCommunityTopSummary: Dispatch<
    SetStateAction<{ content: string; contains_spoilers: boolean } | null>
  >;

  chapterError: string | null;
  cleanSynopsis: (raw: string) => string;
}) {
  const {
    slug,
    chapterNum,
    manga,
    chapter,
    backdropUrl,
    chapterPosterUrl,
    tags,
    tagsLoading,
    showSpoilers,
    setShowSpoilers,
    actionBoxNonce,
    chapterLogsNonce,
    onOpenLog,
    onShowActivity,
    onOpenLogForChapter,
    feedNonce,
    communityTopSummary,
    setCommunityTopSummary,
    chapterError,
  } = props;

  const POSTER_W = 110;
  const POSTER_H = 165;

  return (
    <>
      {/* Backdrop */}
      {backdropUrl && (
        <div className="relative h-[420px] w-screen overflow-hidden">
          <Image
            src={backdropUrl}
            alt=""
            fill
            priority
            unoptimized
            sizes="100vw"
            className="object-cover object-[50%_25%]"
          />
          <img
            src="/overlays/my-overlay.png"
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 pb-8">
        <div className="-mt-4 relative z-10">
          {/* Poster + title block */}
          <div className="flex items-start gap-4">
            <div
              className="shrink-0 overflow-hidden rounded-md border-3 border-black/100 bg-gray-800"
              style={{ width: POSTER_W, height: POSTER_H }}
            >
              {chapterPosterUrl || manga.image_url ? (
                <img
                  src={chapterPosterUrl ?? manga.image_url ?? ""}
                  alt={manga.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-gray-200">
                  {manga.title?.[0] ?? "?"}
                </div>
              )}
            </div>

            {/* Title + Chapter + Summary */}
            <div className="min-w-0 flex-1">
              <EnglishTitle
                as="h1"
                className="text-[22px] font-bold leading-tight"
                titles={{
                  title_english: manga.title_english,
                  title_preferred: manga.title_preferred,
                  title: manga.title,
                  title_native: manga.title_native,
                }}
                fallback={manga.title ?? manga.title_native ?? "Untitled"}
              />

              {/* ✅ Chapter number directly under title */}
              <h2 className="mt-0 text-[17px] font-semibold text-black/80">
                Chapter {chapterNum}
              </h2>

              {chapterError && (
                <p className="mt-1 text-xs text-red-500">{chapterError}</p>
              )}

              {/* Chapter summary (replaces series description slot) */}
              <div className="mt-2 min-h-[55px]">
                {chapter && (
                  <>
                    {communityTopSummary ? (
                      <div>
                        {communityTopSummary.contains_spoilers && (
                          <div className="mb-2 inline-flex rounded-full bg-red-900/40 px-2 py-0.5 text-[11px] font-semibold text-red-200">
                            Spoilers
                          </div>
                        )}

                        <p className="whitespace-pre-line text-sm text-black">
                          {communityTopSummary.content}
                          <span className="inline-flex align-baseline ml-2">
                            <MangaChapterSummary
                              chapterId={chapter.id}
                              onTopSummary={setCommunityTopSummary}
                              mode="icon"
                            />
                          </span>
                        </p>
                      </div>
                    ) : (
                      <MangaChapterSummary
                        chapterId={chapter.id}
                        onTopSummary={setCommunityTopSummary}
                        className="mt-1"
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Chapter nav */}
          <div className="mt-4 w-full min-w-0 overflow-hidden">
            <ChapterNavigatorMobile
              slug={slug}
              totalChapters={manga.total_chapters}
              currentChapterNumber={chapterNum}
            />
          </div>

          <div className="mt-1">
            <Link href={`/manga/${slug}`} className="text-xs text-black hover:underline">
              ← Back to manga main page
            </Link>
          </div>

          {/* Actions */}
          <div className="mt-4 w-full">
            <div className="flex flex-col gap-2">
              <MangaActionBoxMobile
                key={actionBoxNonce}
                mangaId={manga.id}
                mangaChapterId={chapter?.id ?? null}
                onOpenLog={onOpenLog}
                onShowActivity={onShowActivity}
              />

              <MangaQuickLogBoxMobile
                mangaId={manga.id}
                totalChapters={manga.total_chapters}
                refreshToken={chapterLogsNonce}
                onOpenLog={(chapterId) => onOpenLogForChapter(chapterId ?? null)}
              />
            </div>
          </div>

          <MangaInfoDropdownMobile
            manga={manga}
            tags={tags}
            tagsLoading={tagsLoading}
            showSpoilers={showSpoilers}
            setShowSpoilers={setShowSpoilers}
          />

          {/* Feed */}
          <div className="mt-6 -mx-4 border-y border-black">
            <FeedShell>
              {manga.id && chapter?.id ? (
                <PostFeed key={feedNonce} mangaId={manga.id} mangaChapterId={chapter.id} />
              ) : (
                <p className="text-sm text-gray-500">Loading discussion…</p>
              )}
            </FeedShell>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <Link href={`/manga/${slug}/art`} className="text-sm text-blue-500 hover:underline">
              Art
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
