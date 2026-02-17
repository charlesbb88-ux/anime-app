// components/discover/discoverTypes.ts

export type DiscoverHeroItem = {
  id: string;
  kind: "anime" | "manga";
  slug: string;
  title: string;
  posterUrl: string | null;
  score: number;
};

export type DiscoverReviewItem = {
  id: string;
  kind: "anime" | "manga";
  title: string;
  posterUrl: string | null;

  username: string;
  avatarUrl: string | null; // ✅ add this

  createdAtLabel: string;
  snippet: string;

  animeEpisodeId?: string | null;
  mangaChapterId?: string | null;

  animeEpisodeNumber?: number | null;
  mangaChapterNumber?: number | null;

  postId: string | null;

  rating?: number | null;
};

/** Row coming from top_review_weekly */
export type TopReviewWeeklyRow = {
  review_id: string;

  author_id: string;
  author_username: string;
  author_avatar_url: string | null;

  anime_id: string | null;
  anime_slug: string | null;
  anime_title: string | null;
  anime_image_url: string | null;

  manga_id: string | null;
  manga_slug: string | null;
  manga_title: string | null;
  manga_image_url: string | null;

  content: string;
  created_at: string;

  replies_count: number;
  likes_count: number;
  score: number;
};

/** What /discover “Popular reviews this week” wants to render */
export type DiscoverPopularReview = {
  reviewId: string;

  kind: "anime" | "manga";
  mediaSlug: string | null;
  mediaTitle: string;
  mediaPosterUrl: string | null;

  authorUsername: string;
  authorAvatarUrl: string | null;

  createdAt: string;
  snippet: string;

  repliesCount: number;
  likesCount: number;
  score: number;
};

export type LatestReviewRow = {
  review_id: string;
  content: string;
  created_at: string;

  author_id: string;
  author_username: string;
  author_avatar_url: string | null;

  anime_id: string | null;
  anime_slug: string | null;
  anime_title: string | null;
  anime_image_url: string | null;

  manga_id: string | null;
  manga_slug: string | null;
  manga_title: string | null;
  manga_image_url: string | null;

  anime_episode_id: string | null;
  manga_chapter_id: string | null;

  anime_episode_number: number | null;
  manga_chapter_number: number | string | null;

  post_id: string | null;

  rating: number | null;
};