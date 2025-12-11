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
  site: string | null;      // "youtube", etc.
  thumbnail: string | null;
};

export type AniListNextAiringEpisode = {
  id: number;
  episode: number;
  airingAt: number;         // UNIX timestamp (seconds)
  timeUntilAiring: number;  // seconds
};

export type AniListStudio = {
  id: number;
  name: string;
  isAnimationStudio: boolean;
};

export type AniListExternalLink = {
  id: number;
  url: string;
  site: string;             // "Official Site", "Twitter", "Crunchyroll", etc.
};

export type AniListAnime = {
  id: number;
  title: AniListTitle;
  description: string | null;

  episodes: number | null;
  duration: number | null;  // mins per ep
  format: string | null;    // TV, MOVIE, OVA...
  status: string | null;    // FINISHED, RELEASING...
  season: string | null;    // WINTER, SPRING...
  seasonYear: number | null;

  startDate: AniListFuzzyDate | null;
  endDate: AniListFuzzyDate | null;

  coverImage: {
    large: string | null;
    medium: string | null;
  } | null;

  bannerImage: string | null;

  averageScore: number | null;
  popularity: number | null;
  source: string | null;    // ORIGINAL, MANGA, etc.

  genres: string[] | null;
  tags: AniListTag[] | null;

  trailer: AniListTrailer | null;
  nextAiringEpisode: AniListNextAiringEpisode | null;

  studios: AniListStudio[] | null;
  externalLinks: AniListExternalLink[] | null;
};

type AniListSearchResult = {
  Page: {
    media: any[];
  };
};

type AniListSingleResult = {
  Media: any | null;
};

type AniListGraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

// ============ Internal helper ============

async function callAniList<T>(
  query: string,
  variables: Record<string, any>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("AniList HTTP error:", res.status, text);
      return { data: null, error: `AniList HTTP ${res.status}` };
    }

    const json = (await res.json()) as AniListGraphQLResponse<T>;

    if (json.errors && json.errors.length > 0) {
      console.error("AniList GraphQL errors:", json.errors);
      return {
        data: null,
        error: json.errors[0]?.message ?? "AniList error",
      };
    }

    if (!json.data) {
      return { data: null, error: null };
    }

    return { data: json.data, error: null };
  } catch (err) {
    console.error("Error calling AniList:", err);
    return { data: null, error: "Failed to contact AniList" };
  }
}

// ============ Public helpers ============

/**
 * Search AniList for anime by title text.
 * Used by your dev search page.
 */
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
          title {
            romaji
            english
            native
            userPreferred
          }
          description(asHtml: false)
          episodes
          duration
          format
          status
          season
          seasonYear
          startDate { year month day }
          endDate { year month day }
          coverImage {
            large
            medium
          }
          bannerImage
          averageScore
          popularity
          source
          genres
          tags {
            name
            description
            rank
            isAdult
            isGeneralSpoiler
            isMediaSpoiler
            category
          }
          trailer {
            id
            site
            thumbnail
          }
          nextAiringEpisode {
            id
            episode
            airingAt
            timeUntilAiring
          }
          studios {
            nodes {
              id
              name
              isAnimationStudio
            }
          }
          externalLinks {
            id
            url
            site
          }
        }
      }
    }
  `;

  const { data, error } = await callAniList<AniListSearchResult>(query, {
    search,
    page,
    perPage,
  });

  if (error || !data) {
    return { data: [], error };
  }

  const media = data.Page.media ?? [];

  const mapped: AniListAnime[] = media.map((m) => {
    const studios: AniListStudio[] | null =
      m.studios && m.studios.nodes ? (m.studios.nodes as AniListStudio[]) : null;

    return {
      id: m.id,
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
 * Fetch a single AniList anime by its ID.
 * Used by your import API (/api/admin/import-anime-from-anilist).
 */
export async function getAniListAnimeById(
  id: number
): Promise<{ data: AniListAnime | null; error: string | null }> {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        title {
          romaji
          english
          native
          userPreferred
        }
        description(asHtml: false)
        episodes
        duration
        format
        status
        season
        seasonYear
        startDate { year month day }
        endDate { year month day }
        coverImage {
          large
          medium
        }
        bannerImage
        averageScore
        popularity
        source
        genres
        tags {
          name
          description
          rank
          isAdult
          isGeneralSpoiler
          isMediaSpoiler
          category
        }
        trailer {
          id
          site
          thumbnail
        }
        nextAiringEpisode {
          id
          episode
          airingAt
          timeUntilAiring
        }
        studios {
          nodes {
            id
            name
            isAnimationStudio
          }
        }
        externalLinks {
          id
          url
          site
        }
      }
    }
  `;

  const { data, error } = await callAniList<AniListSingleResult>(query, { id });

  if (error) {
    return { data: null, error };
  }

  const m = data?.Media;
  if (!m) {
    return { data: null, error: null };
  }

  const studios: AniListStudio[] | null =
    m.studios && m.studios.nodes ? (m.studios.nodes as AniListStudio[]) : null;

  const anime: AniListAnime = {
    id: m.id,
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
