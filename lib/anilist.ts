// lib/anilist.ts

// ============ Types ============

export type AniListTitle = {
  romaji: string | null;
  english: string | null;
  native: string | null;
  userPreferred: string | null;
};

export type AniListFuzzyDate = {
  year: number | null;
  month: number | null;
  day: number | null;
};

export type AniListTag = {
  name: string;
  description: string | null;
  rank: number | null;
  isAdult: boolean | null;
  isGeneralSpoiler: boolean | null;
  isMediaSpoiler: boolean | null;
  category: string | null;
};

export type AniListTrailer = {
  id: string | null;
  site: string | null; // "youtube", etc.
  thumbnail: string | null;
};

export type AniListNextAiringEpisode = {
  id: number;
  episode: number;
  airingAt: number; // UNIX seconds
  timeUntilAiring: number; // seconds
};

export type AniListStudio = {
  id: number;
  name: string;
  isAnimationStudio: boolean;
};

export type AniListExternalLink = {
  id: number;
  url: string;
  site: string; // "Official Site", "Twitter", etc.
};

/** ✅ PageInfo type (used by paging helpers) */
export type AniListPageInfo = {
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
  hasNextPage: boolean;
};

// ---------- Anime (type: ANIME) ----------

export type AniListAnime = {
  id: number;

  /** ✅ NEW (recommended): MAL id */
  idMal?: number | null;

  title: AniListTitle;
  description: string | null;

  episodes: number | null;
  duration: number | null;
  format: string | null;
  status: string | null;
  season: string | null;
  seasonYear: number | null;

  startDate: AniListFuzzyDate | null;
  endDate: AniListFuzzyDate | null;

  coverImage: {
    extraLarge: string | null;
    large: string | null;
    medium: string | null;
  } | null;

  bannerImage: string | null;

  averageScore: number | null;
  popularity: number | null;
  source: string | null;

  genres: string[] | null;
  tags: AniListTag[] | null;

  trailer: AniListTrailer | null;
  nextAiringEpisode: AniListNextAiringEpisode | null;

  studios: AniListStudio[] | null;
  externalLinks: AniListExternalLink[] | null;
};

// ---------- Manga (type: MANGA) ----------

export type AniListManga = {
  id: number;
  title: AniListTitle;
  description: string | null;

  chapters: number | null;
  volumes: number | null;
  format: string | null; // MANGA, NOVEL, ONE_SHOT...
  status: string | null;
  season: string | null;
  seasonYear: number | null;

  startDate: AniListFuzzyDate | null;
  endDate: AniListFuzzyDate | null;

  coverImage: {
    extraLarge: string | null;
    large: string | null;
    medium: string | null;
  } | null;

  bannerImage: string | null;

  averageScore: number | null;
  popularity: number | null;
  source: string | null;

  genres: string[] | null;
  tags: AniListTag[] | null;

  trailer: AniListTrailer | null;
  externalLinks: AniListExternalLink[] | null;
};

// ---------- GraphQL response shapes ----------

type AniListSearchResult = {
  Page: {
    media: any[];
  };
};

type AniListSingleResult = {
  Media: any | null;
};

/** ✅ Page result with pageInfo */
type AniListAnimePageResult = {
  Page: {
    pageInfo: AniListPageInfo;
    media: any[];
  };
};

/** ✅ IDs-only page result with pageInfo */
type AniListAnimeIdsPageResult = {
  Page: {
    pageInfo: AniListPageInfo;
    media: any[];
  };
};

type AniListGraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

// ============ Internal helper ============

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseRetryAfterSeconds(h: string | null): number | null {
  if (!h) return null;
  const n = Number(h);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function callAniList<T>(
  query: string,
  variables: Record<string, any>
): Promise<{ data: T | null; error: string | null }> {
  const maxAttempts = 8;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(ANILIST_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
      });

      // ✅ Handle rate limit + temporary failures with retry
      if (!res.ok) {
        const status = res.status;
        const text = await res.text();

        // 429 Too Many Requests OR 5xx
        if (status === 429 || (status >= 500 && status <= 599)) {
          const retryAfter = parseRetryAfterSeconds(res.headers.get("retry-after"));
          const base = retryAfter ? retryAfter * 1000 : 500 * Math.pow(2, attempt - 1);
          const jitter = Math.floor(Math.random() * 200);
          const waitMs = Math.min(15000, base + jitter);

          console.warn(
            `AniList HTTP ${status} (attempt ${attempt}/${maxAttempts}) waiting ${waitMs}ms`
          );

          if (attempt === maxAttempts) {
            console.error("AniList HTTP error (final):", status, text);
            return { data: null, error: `AniList HTTP ${status} (rate limited / temporary failure)` };
          }

          await sleep(waitMs);
          continue;
        }

        // Non-retryable
        console.error("AniList HTTP error:", status, text);
        return { data: null, error: `AniList HTTP ${status}` };
      }

      const json = (await res.json()) as AniListGraphQLResponse<T>;

      if (json.errors && json.errors.length > 0) {
        // GraphQL errors sometimes include 429-like messages too
        const msg = json.errors[0]?.message ?? "AniList error";
        console.error("AniList GraphQL errors:", json.errors);

        if (msg.toLowerCase().includes("too many requests")) {
          const base = 500 * Math.pow(2, attempt - 1);
          const jitter = Math.floor(Math.random() * 200);
          const waitMs = Math.min(15000, base + jitter);

          console.warn(
            `AniList GraphQL rate limit (attempt ${attempt}/${maxAttempts}) waiting ${waitMs}ms`
          );

          if (attempt === maxAttempts) {
            return { data: null, error: "AniList rate limited (GraphQL)" };
          }

          await sleep(waitMs);
          continue;
        }

        return { data: null, error: msg };
      }

      return { data: json.data ?? null, error: null };
    } catch (err) {
      console.error("Error calling AniList:", err);

      const base = 500 * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * 200);
      const waitMs = Math.min(15000, base + jitter);

      if (attempt === maxAttempts) {
        return { data: null, error: "Failed to contact AniList" };
      }

      await sleep(waitMs);
    }
  }

  return { data: null, error: "Failed to contact AniList" };
}

// ============ Anime helpers ============

export async function searchAniListAnime(
  search: string,
  page: number = 1,
  perPage: number = 10
): Promise<{ data: AniListAnime[]; error: string | null }> {
  const query = `
    query ($search: String, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(search: $search, type: ANIME) {
          id
          idMal
          title { romaji english native userPreferred }
          description(asHtml: false)
          episodes
          duration
          format
          status
          season
          seasonYear
          startDate { year month day }
          endDate { year month day }
          coverImage { extraLarge large medium }
          bannerImage
          averageScore
          popularity
          source
          genres
          tags { name description rank isAdult isGeneralSpoiler isMediaSpoiler category }
          trailer { id site thumbnail }
          nextAiringEpisode { id episode airingAt timeUntilAiring }
          studios { nodes { id name isAnimationStudio } }
          externalLinks { id url site }
        }
      }
    }
  `;

  const { data, error } = await callAniList<AniListSearchResult>(query, {
    search,
    page,
    perPage,
  });

  if (error || !data) return { data: [], error };

  const media = data.Page.media ?? [];

  const mapped: AniListAnime[] = media.map((m) => {
    const studios: AniListStudio[] | null =
      m.studios && m.studios.nodes ? (m.studios.nodes as AniListStudio[]) : null;

    return {
      id: m.id,
      idMal: m.idMal ?? null,
      title: {
        romaji: m.title?.romaji ?? null,
        english: m.title?.english ?? null,
        native: m.title?.native ?? null,
        userPreferred: m.title?.userPreferred ?? null,
      },
      description: m.description ?? null,
      episodes: m.episodes ?? null,
      duration: m.duration ?? null,
      format: m.format ?? null,
      status: m.status ?? null,
      season: m.season ?? null,
      seasonYear: m.seasonYear ?? null,
      startDate: m.startDate ?? null,
      endDate: m.endDate ?? null,
      coverImage: m.coverImage ?? null,
      bannerImage: m.bannerImage ?? null,
      averageScore: m.averageScore ?? null,
      popularity: m.popularity ?? null,
      source: m.source ?? null,
      genres: m.genres ?? null,
      tags: m.tags ?? null,
      trailer: m.trailer ?? null,
      nextAiringEpisode: m.nextAiringEpisode ?? null,
      studios,
      externalLinks: m.externalLinks ?? null,
    };
  });

  return { data: mapped, error: null };
}

/**
 * ✅ listAniListAnimePage(page, perPage)
 * - no search
 * - includes pageInfo
 * - includes idMal
 */
export async function listAniListAnimePage(
  page: number = 1,
  perPage: number = 50
): Promise<{
  data: AniListAnime[];
  pageInfo: AniListPageInfo | null;
  error: string | null;
}> {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total perPage currentPage lastPage hasNextPage }
        media(type: ANIME, sort: ID) {
          id
          idMal
          title { romaji english native userPreferred }
          description(asHtml: false)
          episodes
          duration
          format
          status
          season
          seasonYear
          startDate { year month day }
          endDate { year month day }
          coverImage { extraLarge large medium }
          bannerImage
          averageScore
          popularity
          source
          genres
          tags { name description rank isAdult isGeneralSpoiler isMediaSpoiler category }
          trailer { id site thumbnail }
          nextAiringEpisode { id episode airingAt timeUntilAiring }
          studios { nodes { id name isAnimationStudio } }
          externalLinks { id url site }
        }
      }
    }
  `;

  const { data, error } = await callAniList<AniListAnimePageResult>(query, {
    page,
    perPage,
  });

  if (error || !data) return { data: [], pageInfo: null, error };

  const media = data.Page.media ?? [];

  const mapped: AniListAnime[] = media.map((m: any) => {
    const studios =
      m.studios && m.studios.nodes ? (m.studios.nodes as AniListStudio[]) : null;

    return {
      id: m.id,
      idMal: m.idMal ?? null,
      title: {
        romaji: m.title?.romaji ?? null,
        english: m.title?.english ?? null,
        native: m.title?.native ?? null,
        userPreferred: m.title?.userPreferred ?? null,
      },
      description: m.description ?? null,
      episodes: m.episodes ?? null,
      duration: m.duration ?? null,
      format: m.format ?? null,
      status: m.status ?? null,
      season: m.season ?? null,
      seasonYear: m.seasonYear ?? null,
      startDate: m.startDate ?? null,
      endDate: m.endDate ?? null,
      coverImage: m.coverImage ?? null,
      bannerImage: m.bannerImage ?? null,
      averageScore: m.averageScore ?? null,
      popularity: m.popularity ?? null,
      source: m.source ?? null,
      genres: m.genres ?? null,
      tags: m.tags ?? null,
      trailer: m.trailer ?? null,
      nextAiringEpisode: m.nextAiringEpisode ?? null,
      studios,
      externalLinks: m.externalLinks ?? null,
    };
  });

  const pageInfo: AniListPageInfo | null = data.Page.pageInfo ?? null;
  return { data: mapped, pageInfo, error: null };
}

/**
 * ✅ listAniListAnimeIdsPage(page, perPage)
 * - returns ONLY ids + pageInfo (includes total)
 * - avoids fetching full payload just to know progress totals
 */
export async function listAniListAnimeIdsPage(
  page: number = 1,
  perPage: number = 50
): Promise<{ ids: number[]; pageInfo: AniListPageInfo | null; error: string | null }> {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total perPage currentPage lastPage hasNextPage }
        media(type: ANIME, sort: ID) { id }
      }
    }
  `;

  const { data, error } = await callAniList<AniListAnimeIdsPageResult>(query, {
    page,
    perPage,
  });

  if (error || !data) return { ids: [], pageInfo: null, error };

  const ids = (data.Page?.media ?? [])
    .map((m: any) => Number(m.id))
    .filter((n: any) => Number.isFinite(n));

  const pageInfo = (data.Page?.pageInfo ?? null) as AniListPageInfo | null;

  return { ids, pageInfo, error: null };
}

/**
 * ❌ REMOVED: listAniListAnimeIdsAfterId(afterId, perPage)
 * AniList does NOT support `id_greater` on Page.media, which caused HTTP 400:
 * "Unknown argument id_greater on field media..."
 *
 * Use listAniListAnimeIdsPage(page, perPage) or listAniListAnimePage(page, perPage) instead.
 */

export async function getAniListAnimeById(
  id: number
): Promise<{ data: AniListAnime | null; error: string | null }> {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        idMal
        title { romaji english native userPreferred }
        description(asHtml: false)
        episodes
        duration
        format
        status
        season
        seasonYear
        startDate { year month day }
        endDate { year month day }
        coverImage { extraLarge large medium }
        bannerImage
        averageScore
        popularity
        source
        genres
        tags { name description rank isAdult isGeneralSpoiler isMediaSpoiler category }
        trailer { id site thumbnail }
        nextAiringEpisode { id episode airingAt timeUntilAiring }
        studios { nodes { id name isAnimationStudio } }
        externalLinks { id url site }
      }
    }
  `;

  const { data, error } = await callAniList<AniListSingleResult>(query, { id });

  if (error) return { data: null, error };

  const m = data?.Media;
  if (!m) return { data: null, error: null };

  const studios: AniListStudio[] | null =
    m.studios && m.studios.nodes ? (m.studios.nodes as AniListStudio[]) : null;

  const anime: AniListAnime = {
    id: m.id,
    idMal: m.idMal ?? null,
    title: {
      romaji: m.title?.romaji ?? null,
      english: m.title?.english ?? null,
      native: m.title?.native ?? null,
      userPreferred: m.title?.userPreferred ?? null,
    },
    description: m.description ?? null,
    episodes: m.episodes ?? null,
    duration: m.duration ?? null,
    format: m.format ?? null,
    status: m.status ?? null,
    season: m.season ?? null,
    seasonYear: m.seasonYear ?? null,
    startDate: m.startDate ?? null,
    endDate: m.endDate ?? null,
    coverImage: m.coverImage ?? null,
    bannerImage: m.bannerImage ?? null,
    averageScore: m.averageScore ?? null,
    popularity: m.popularity ?? null,
    source: m.source ?? null,
    genres: m.genres ?? null,
    tags: m.tags ?? null,
    trailer: m.trailer ?? null,
    nextAiringEpisode: m.nextAiringEpisode ?? null,
    studios,
    externalLinks: m.externalLinks ?? null,
  };

  return { data: anime, error: null };
}

// ============ Manga helpers ============

export async function searchAniListManga(
  search: string,
  page: number = 1,
  perPage: number = 10
): Promise<{ data: AniListManga[]; error: string | null }> {
  const query = `
    query ($search: String, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(search: $search, type: MANGA) {
          id
          title { romaji english native userPreferred }
          description(asHtml: false)
          chapters
          volumes
          format
          status
          season
          seasonYear
          startDate { year month day }
          endDate { year month day }
          coverImage { extraLarge large medium }
          bannerImage
          averageScore
          popularity
          source
          genres
          tags { name description rank isAdult isGeneralSpoiler isMediaSpoiler category }
          trailer { id site thumbnail }
          externalLinks { id url site }
        }
      }
    }
  `;

  const { data, error } = await callAniList<AniListSearchResult>(query, {
    search,
    page,
    perPage,
  });

  if (error || !data) return { data: [], error };

  const media = data.Page.media ?? [];

  const mapped: AniListManga[] = media.map((m) => {
    return {
      id: m.id,
      title: {
        romaji: m.title?.romaji ?? null,
        english: m.title?.english ?? null,
        native: m.title?.native ?? null,
        userPreferred: m.title?.userPreferred ?? null,
      },
      description: m.description ?? null,
      chapters: m.chapters ?? null,
      volumes: m.volumes ?? null,
      format: m.format ?? null,
      status: m.status ?? null,
      season: m.season ?? null,
      seasonYear: m.seasonYear ?? null,
      startDate: m.startDate ?? null,
      endDate: m.endDate ?? null,
      coverImage: m.coverImage ?? null,
      bannerImage: m.bannerImage ?? null,
      averageScore: m.averageScore ?? null,
      popularity: m.popularity ?? null,
      source: m.source ?? null,
      genres: m.genres ?? null,
      tags: m.tags ?? null,
      trailer: m.trailer ?? null,
      externalLinks: m.externalLinks ?? null,
    };
  });

  return { data: mapped, error: null };
}

export async function getAniListMangaById(
  id: number
): Promise<{ data: AniListManga | null; error: string | null }> {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: MANGA) {
        id
        title { romaji english native userPreferred }
        description(asHtml: false)
        chapters
        volumes
        format
        status
        season
        seasonYear
        startDate { year month day }
        endDate { year month day }
        coverImage { extraLarge large medium }
        bannerImage
        averageScore
        popularity
        source
        genres
        tags { name description rank isAdult isGeneralSpoiler isMediaSpoiler category }
        trailer { id site thumbnail }
        externalLinks { id url site }
      }
    }
  `;

  const { data, error } = await callAniList<AniListSingleResult>(query, { id });

  if (error) return { data: null, error };

  const m = data?.Media;
  if (!m) return { data: null, error: null };

  const manga: AniListManga = {
    id: m.id,
    title: {
      romaji: m.title?.romaji ?? null,
      english: m.title?.english ?? null,
      native: m.title?.native ?? null,
      userPreferred: m.title?.userPreferred ?? null,
    },
    description: m.description ?? null,
    chapters: m.chapters ?? null,
    volumes: m.volumes ?? null,
    format: m.format ?? null,
    status: m.status ?? null,
    season: m.season ?? null,
    seasonYear: m.seasonYear ?? null,
    startDate: m.startDate ?? null,
    endDate: m.endDate ?? null,
    coverImage: m.coverImage ?? null,
    bannerImage: m.bannerImage ?? null,
    averageScore: m.averageScore ?? null,
    popularity: m.popularity ?? null,
    source: m.source ?? null,
    genres: m.genres ?? null,
    tags: m.tags ?? null,
    trailer: m.trailer ?? null,
    externalLinks: m.externalLinks ?? null,
  };

  return { data: manga, error: null };
}
