// lib/types.ts

// --- Anime catalog ---

export type Anime = {
  id: string;               // uuid
  title: string;
  slug: string;
  total_episodes: number | null;
  image_url: string | null;
  banner_image_url: string | null; // AniList banner

  // Extra titles from AniList
  title_english: string | null;
  title_native: string | null;
  title_preferred: string | null;

  // Rich metadata
  description: string | null;
  format: string | null;        // TV, MOVIE, OVA, etc.
  status: string | null;        // FINISHED, RELEASING, etc.
  season: string | null;        // WINTER, SPRING...
  season_year: number | null;   // e.g. 2019
  start_date: string | null;    // date (YYYY-MM-DD) as string
  end_date: string | null;      // date (YYYY-MM-DD) as string
  average_score: number | null; // 0–100
  source: string | null;        // ORIGINAL, MANGA, LIGHT_NOVEL, etc.

  genres: string[] | null;      // AniList genres

  created_at: string;           // ISO timestamp
};

// --- Manga catalog ---

export type Manga = {
  id: string;               // uuid
  title: string;
  slug: string;
  total_chapters: number | null;
  total_volumes: number | null;
  image_url: string | null;
  banner_image_url: string | null;

  // Extra titles from AniList
  title_english: string | null;
  title_native: string | null;
  title_preferred: string | null;

  // Rich metadata (mirrors Anime as much as possible)
  description: string | null;
  format: string | null;        // MANGA, NOVEL, ONE_SHOT, etc. from AniList
  status: string | null;        // FINISHED, RELEASING, etc.
  season: string | null;        // Often null/unused for manga
  season_year: number | null;
  start_date: string | null;    // date (YYYY-MM-DD) as string
  end_date: string | null;      // date (YYYY-MM-DD) as string
  average_score: number | null; // 0–100
  source: string | null;        // ORIGINAL, LIGHT_NOVEL, etc.

  genres: string[] | null;      // AniList genres/tags

  created_at: string;           // ISO timestamp
};

// --- User anime progress ---

export type UserAnimeStatus =
  | "watching"
  | "completed"
  | "paused"
  | "dropped"
  | "plan_to_watch";

export type UserAnimeProgress = {
  id: string;               // uuid
  user_id: string;          // uuid (auth.users.id)
  anime_id: string;         // uuid (anime.id)
  episodes_watched: number;
  status: UserAnimeStatus;
  score: number | null;     // 1–10, or null
  notes: string | null;
  updated_at: string;       // ISO timestamp
};

// Progress row joined with the corresponding anime record
export type UserAnimeProgressWithAnime = UserAnimeProgress & {
  // joined relation; we normalize it to a single Anime or null
  anime: Anime | null;
};

// Params for upsert helper
export type UpsertUserAnimeProgressParams = {
  userId: string;
  animeId: string;
  episodesWatched?: number;
  status?: UserAnimeStatus;
  score?: number | null;
  notes?: string | null;
};

// --- Episode-level records for each anime ---

export type AnimeEpisode = {
  id: string;               // uuid
  anime_id: string;         // uuid (anime.id)
  episode_number: number;   // 1, 2, 3, ...
  title: string | null;     // episode title (if known)
  synopsis: string | null;  // episode synopsis (if known)
  air_date: string | null;  // ISO timestamp or null
  anilist_media_id: number | null; // AniList schedule media ID if available
  created_at: string;       // ISO timestamp
  updated_at: string;       // ISO timestamp
};

// --- Chapter-level records for each manga ---

export type MangaChapter = {
  id: string;               // uuid
  manga_id: string;         // uuid (manga.id)
  chapter_number: number;   // 1, 2, 3, ...
  title: string | null;     // chapter title (if known)
  synopsis: string | null;  // chapter synopsis (if known)
  release_date: string | null;  // ISO timestamp or null
  anilist_media_id: number | null; // placeholder if we ever map chapter-level data
  created_at: string;       // ISO timestamp
  updated_at: string;       // ISO timestamp
};
