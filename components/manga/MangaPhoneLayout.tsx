"use client";

import Link from "next/link";
import FeedShell from "@/components/FeedShell";
import MangaMetaBox from "@/components/manga/MangaMetaBox";
import MangaQuickLogBox from "@/components/manga/MangaQuickLogBox";
import MangaActionBox from "@/components/actions/MangaActionBox";
import ChapterNavigator from "@/components/ChapterNavigator";
import PostFeed from "@/components/PostFeed";
import EnglishTitle from "@/components/EnglishTitle";

type Manga = {
  id: string;
  title: string;
  slug: string;
  total_chapters: number | null;
  total_volumes: number | null;
  image_url: string | null;

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

export default function MangaPhoneLayout(props: {
  slug: string | null;
  manga: Manga;
  tags: MangaTag[];
  tagsLoading: boolean;

  showSpoilers: boolean;
  setShowSpoilers: (v: boolean | ((p: boolean) => boolean)) => void;

  secondaryTitle: string | null;
  showSecondaryTitle: boolean;

  cleanSynopsis: (raw: string) => string;

  // action/log behavior stays identical
  actionBoxNonce: number;
  chapterLogsNonce: number;
  onOpenLog: () => void;
  onShowActivity: () => void;
  onOpenLogForChapter: (chapterId: string | null) => void;

  feedNonce: number;
}) {
  const { manga } = props;

  const m: any = manga;
  const hasGenres = Array.isArray(m.genres) && m.genres.length > 0;
  const genres: string[] = m.genres || [];

  const spoilerTags = props.tags.filter(
    (t) => t.is_general_spoiler === true || t.is_media_spoiler === true
  );
  const spoilerCount = spoilerTags.length;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-0 pb-8">
      {/* PHONE HEADER: poster + title stack */}
      <div className="pt-3">
        <div className="flex items-start gap-3">
          {/* Poster */}
          {manga.image_url ? (
            <img
              src={manga.image_url}
              alt={manga.title}
              className="h-[150px] w-[110px] rounded-md object-cover border-2 border-black"
            />
          ) : (
            <div className="flex h-[150px] w-[110px] items-center justify-center rounded-md bg-gray-800 text-3xl font-bold text-gray-200">
              {manga.title?.[0] ?? "?"}
            </div>
          )}

          {/* Titles */}
          <div className="min-w-0 flex-1">
            <EnglishTitle
              as="h1"
              className="text-2xl font-bold leading-tight"
              titles={{
                title_english: manga.title_english,
                title_preferred: manga.title_preferred,
                title: manga.title,
                title_native: manga.title_native,
              }}
              fallback={manga.title ?? manga.title_native ?? "Untitled"}
            />

            {props.showSecondaryTitle && props.secondaryTitle && (
              <h2 className="mt-1 text-sm font-semibold leading-snug text-gray-500">
                {props.secondaryTitle}
              </h2>
            )}

            {/* Actions: NOT pinned; stacked under title on phone */}
            <div className="mt-3 flex flex-col gap-2">
              <MangaActionBox
                key={props.actionBoxNonce}
                mangaId={manga.id}
                onOpenLog={props.onOpenLog}
                onShowActivity={props.onShowActivity}
              />
              <MangaQuickLogBox
                mangaId={manga.id}
                totalChapters={manga.total_chapters}
                refreshToken={props.chapterLogsNonce}
                onOpenLog={(chapterId) => props.onOpenLogForChapter(chapterId ?? null)}
              />
            </div>
          </div>
        </div>

        {/* Synopsis */}
        {typeof m.description === "string" && m.description.trim() && (
          <div className="mt-5">
            <p className="whitespace-pre-line text-base text-black">
              {props.cleanSynopsis(m.description)}
            </p>
          </div>
        )}

        {/* Chapter nav */}
        {props.slug && (
          <div className="mt-6 min-w-0 overflow-hidden">
            <ChapterNavigator
              slug={props.slug}
              totalChapters={manga.total_chapters}
              currentChapterNumber={null}
            />
          </div>
        )}

        {/* Meta box (moved below synopsis on phone) */}
        <div className="mt-6">
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

        {/* Genres */}
        {hasGenres && (
          <div className="mt-5">
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

        {/* Tags (same behavior) */}
        {props.tags.length > 0 && (
          <div className="mt-5">
            <div className="mb-1 flex items-center gap-2">
              <h2 className="text-base font-semibold text-black-300">Tags</h2>
              {props.tagsLoading && (
                <span className="text-[10px] uppercase tracking-wide text-gray-500">
                  Loading…
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              {props.tags.map((tag) => {
                const isSpoiler =
                  tag.is_general_spoiler === true || tag.is_media_spoiler === true;

                if (isSpoiler && !props.showSpoilers) return null;

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
                        className={`relative ${isSpoiler ? "text-red-400" : "text-gray-100"}`}
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

            {spoilerCount > 0 && (
              <button
                type="button"
                onClick={() => props.setShowSpoilers((prev) => !prev)}
                className="mt-2 text-sm font-medium text-blue-400 hover:text-blue-300"
              >
                {props.showSpoilers
                  ? `Hide ${spoilerCount} spoiler tag${spoilerCount === 1 ? "" : "s"}`
                  : `Show ${spoilerCount} spoiler tag${spoilerCount === 1 ? "" : "s"}`}
              </button>
            )}
          </div>
        )}

        {/* Feed */}
        <div className="mt-6">
          <FeedShell>
            <PostFeed key={props.feedNonce} mangaId={manga.id} />
          </FeedShell>
        </div>

        {/* Footer links */}
        <div className="mt-4 flex items-center gap-4">
          <Link
            href={`/manga/${props.slug}/art`}
            className="text-sm text-blue-500 hover:underline"
          >
            Art
          </Link>

          <Link href="/" className="text-xs text-blue-400 hover:text-blue-300">
            ← Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
