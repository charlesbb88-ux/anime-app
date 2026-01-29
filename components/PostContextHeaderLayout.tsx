"use client";

import React, { useMemo } from "react";
import Header from "@/components/Header";

import AnimeSeriesHeaderBackdrop from "@/components/overlays/AnimeSeriesHeaderBackdrop";
import AnimeEpisodeHeaderBackdrop from "@/components/overlays/AnimeEpisodeHeaderBackdrop";
import MangaSeriesHeaderBackdrop from "@/components/overlays/MangaSeriesHeaderBackdrop";
import MangaChapterHeaderBackdrop from "@/components/overlays/MangaChapterHeaderBackdrop";

type PostLike = {
  anime_id: string | null;
  anime_episode_id: string | null; // text: could be "12" OR "uuid-string"
  manga_id: string | null;
  manga_chapter_id: string | null;
  review_id: string | null;
};

type ReviewLike = {
  anime_id: string | null;
  anime_episode_id: string | null; // text: could be "12" OR "uuid-string"
  manga_id: string | null;
  manga_chapter_id: string | null;
} | null;

type Props = {
  post: PostLike | null;
  review: ReviewLike;
  children: React.ReactNode;

  pageMaxWidthClassName?: string; // default matches MediaHeaderLayout: max-w-6xl
  overlaySrc?: string | null;
};

type Target =
  | { kind: "anime_series"; animeId: string }
  | { kind: "anime_episode"; animeId: string; episodeRefText: string }
  | { kind: "manga_series"; mangaId: string }
  | { kind: "manga_chapter"; mangaId: string; chapterId: string }
  | { kind: "none" };

function nonEmptyString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length > 0 ? s : null;
}

export default function PostContextHeaderLayout({
  post,
  review,
  children,
  pageMaxWidthClassName = "max-w-6xl",
  overlaySrc = "/overlays/my-overlay4.png",
}: Props) {
  const target: Target = useMemo(() => {
    if (!post) return { kind: "none" };

    const animeId = nonEmptyString(review?.anime_id) ?? nonEmptyString(post.anime_id);
    const animeEpisodeText =
      nonEmptyString(review?.anime_episode_id) ?? nonEmptyString(post.anime_episode_id);

    const mangaId = nonEmptyString(review?.manga_id) ?? nonEmptyString(post.manga_id);
    const mangaChapterId =
      nonEmptyString(review?.manga_chapter_id) ?? nonEmptyString(post.manga_chapter_id);

    if (animeId && animeEpisodeText) {
      return { kind: "anime_episode", animeId, episodeRefText: animeEpisodeText };
    }

    if (animeId) return { kind: "anime_series", animeId };

    if (mangaId && mangaChapterId) {
      return { kind: "manga_chapter", mangaId, chapterId: mangaChapterId };
    }

    if (mangaId) return { kind: "manga_series", mangaId };

    return { kind: "none" };
  }, [post, review]);

  // ✅ hero for anime series, anime episode, manga series, AND manga chapter
  const wantsHero =
    target.kind === "anime_series" ||
    target.kind === "anime_episode" ||
    target.kind === "manga_series" ||
    target.kind === "manga_chapter";

  return (
    <>
      <Header transparent={wantsHero} />

      {!wantsHero ? (
        <>{children}</>
      ) : (
        <div className={`mx-auto ${pageMaxWidthClassName} px-4 pt-0 pb-8`}>
          {target.kind === "anime_series" ? (
            <AnimeSeriesHeaderBackdrop animeId={target.animeId} overlaySrc={overlaySrc} />
          ) : target.kind === "anime_episode" ? (
            <AnimeEpisodeHeaderBackdrop
              animeId={target.animeId}
              episodeRefText={target.episodeRefText}
              overlaySrc={overlaySrc}
            />
          ) : target.kind === "manga_series" ? (
            <MangaSeriesHeaderBackdrop mangaId={target.mangaId} overlaySrc={overlaySrc} />
          ) : target.kind === "manga_chapter" ? (
            <MangaChapterHeaderBackdrop
              mangaId={target.mangaId}
              overlaySrc={overlaySrc}
            />
          ) : null}

          <div className="-mt-35 relative z-10 px-3">{children}</div>
        </div>
      )}
    </>
  );
}
