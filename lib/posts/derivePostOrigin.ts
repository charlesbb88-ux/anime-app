// lib/posts/derivePostOrigin.ts
export type Post = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;

  anime_id: string | null;
  anime_episode_id: string | null;

  manga_id: string | null;
  manga_chapter_id: string | null;

  review_id: string | null;
};

export type DerivedOrigin = {
  originLabel?: string;
  originHref?: string;
  episodeLabel?: string;
  episodeHref?: string;
  posterUrl?: string | null;
};

type AnimeMeta = {
  title?: string | null;
  titleEnglish?: string | null;
  slug?: string | null;
  imageUrl?: string | null;
};

type EpisodeMeta = {
  episodeNumber?: number | null;
};

type MangaMeta = {
  title?: string | null;
  titleEnglish?: string | null;
  slug?: string | null;
  imageUrl?: string | null;
};

type ChapterMeta = {
  chapterNumber?: number | null;
};

export function derivePostOrigin(args: {
  post: Post;

  animeMetaById: Record<string, AnimeMeta | undefined>;
  episodeMetaById: Record<string, EpisodeMeta | undefined>;

  mangaMetaById: Record<string, MangaMeta | undefined>;
  chapterMetaById: Record<string, ChapterMeta | undefined>;
}): DerivedOrigin {
  const { post: p, animeMetaById, episodeMetaById, mangaMetaById, chapterMetaById } = args;

  let originLabel: string | undefined;
  let originHref: string | undefined;
  let episodeLabel: string | undefined;
  let episodeHref: string | undefined;
  let posterUrl: string | null | undefined;

  if (p.anime_id) {
    const meta = animeMetaById[p.anime_id];
    if (meta) {
      const english = meta.titleEnglish?.trim();
      originLabel = english && english.length > 0 ? english : meta.title || undefined;

      if (meta.slug) originHref = `/anime/${meta.slug}`;
      posterUrl = meta.imageUrl ?? null;

      if (p.anime_episode_id) {
        const epMeta = episodeMetaById[p.anime_episode_id];
        if (epMeta && epMeta.episodeNumber != null) {
          episodeLabel = `Ep ${epMeta.episodeNumber}`;
          if (meta.slug) episodeHref = `/anime/${meta.slug}/episode/${epMeta.episodeNumber}`;
        }
      }
    }
  }

  if (!p.anime_id && p.manga_id) {
    const meta = mangaMetaById[p.manga_id];
    if (meta) {
      const english = meta.titleEnglish?.trim();
      originLabel = english && english.length > 0 ? english : meta.title || undefined;

      if (meta.slug) originHref = `/manga/${meta.slug}`;
      posterUrl = meta.imageUrl ?? null;

      if (p.manga_chapter_id) {
        const chMeta = chapterMetaById[p.manga_chapter_id];
        if (chMeta && chMeta.chapterNumber != null) {
          episodeLabel = `Ch ${chMeta.chapterNumber}`;
          if (meta.slug) episodeHref = `/manga/${meta.slug}/chapter/${chMeta.chapterNumber}`;
        }
      }
    }
  }

  return { originLabel, originHref, episodeLabel, episodeHref, posterUrl: posterUrl ?? null };
}