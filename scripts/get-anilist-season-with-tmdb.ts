// scripts/get-anilist-season-with-tmdb.ts

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

type AniListMedia = {
  id: number;
  title: {
    english: string | null;
    romaji: string | null;
  };
};

type AniListResponse = {
  data?: {
    Page?: {
      pageInfo: {
        hasNextPage: boolean;
        currentPage: number;
      };
      media: AniListMedia[];
    };
  };
  errors?: Array<{ message: string }>;
};

type SeasonArg = "WINTER" | "SPRING" | "SUMMER" | "FALL";

type TmdbSearchResult = {
  id: number;
  name?: string;
  original_name?: string;
  title?: string;
  original_title?: string;
  first_air_date?: string;
  release_date?: string;
};

type TmdbSearchResponse = {
  results?: TmdbSearchResult[];
};

async function fetchAniListPage(
  page: number,
  perPage: number,
  season: SeasonArg,
  seasonYear: number
) {
  const query = `
    query ($page: Int, $perPage: Int, $season: MediaSeason, $seasonYear: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          hasNextPage
          currentPage
        }
        media(
          season: $season
          seasonYear: $seasonYear
          type: ANIME
          sort: ID
        ) {
          id
          title {
            english
            romaji
          }
        }
      }
    }
  `;

  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query,
      variables: {
        page,
        perPage,
        season,
        seasonYear,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`AniList request failed with status ${res.status}`);
  }

  const json = (await res.json()) as AniListResponse;

  if (json.errors?.length) {
    throw new Error(
      `AniList errors: ${json.errors.map((e) => e.message).join(" | ")}`
    );
  }

  if (!json.data?.Page) {
    throw new Error("AniList returned no Page data");
  }

  return json.data.Page;
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSeasonMonthRange(season: SeasonArg): [number, number] {
  switch (season) {
    case "WINTER":
      return [1, 3];
    case "SPRING":
      return [4, 6];
    case "SUMMER":
      return [7, 9];
    case "FALL":
      return [10, 12];
  }
}

function isDateInSeason(
  dateStr: string | undefined,
  season: SeasonArg,
  seasonYear: number
) {
  if (!dateStr) return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);

  const [startMonth, endMonth] = getSeasonMonthRange(season);

  return year === seasonYear && month >= startMonth && month <= endMonth;
}

function scoreTmdbCandidate(
  candidate: TmdbSearchResult,
  titlesToCompare: string[],
  season: SeasonArg,
  seasonYear: number,
  mediaType: "tv" | "movie"
) {
  const normalizedTargets = titlesToCompare.map(normalizeTitle).filter(Boolean);

  const candidateTitles = [
    candidate.name,
    candidate.original_name,
    candidate.title,
    candidate.original_title,
  ]
    .filter((value): value is string => Boolean(value))
    .map(normalizeTitle);

  let score = 0;

  for (const target of normalizedTargets) {
    if (candidateTitles.includes(target)) {
      score += 100;
      continue;
    }

    if (
      candidateTitles.some(
        (candidateTitle) =>
          candidateTitle.includes(target) || target.includes(candidateTitle)
      )
    ) {
      score += 50;
    }
  }

  const dateToCheck =
    mediaType === "tv" ? candidate.first_air_date : candidate.release_date;

  if (isDateInSeason(dateToCheck, season, seasonYear)) {
    score += 25;
  }

  return score;
}

async function searchTmdb(
  query: string,
  titlesToCompare: string[],
  season: SeasonArg,
  seasonYear: number,
  mediaType: "tv" | "movie",
  tmdbToken: string
): Promise<number | null> {
  const params = new URLSearchParams({
    query,
    include_adult: "false",
    language: "en-US",
    page: "1",
  });

  if (mediaType === "tv") {
    params.set("first_air_date_year", String(seasonYear));
  } else {
    params.set("year", String(seasonYear));
    params.set("primary_release_year", String(seasonYear));
  }

  const res = await fetch(
    `https://api.themoviedb.org/3/search/${mediaType}?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tmdbToken}`,
        Accept: "application/json",
      },
    }
  );

  if (!res.ok) {
    throw new Error(`TMDB ${mediaType} search failed with status ${res.status}`);
  }

  const json = (await res.json()) as TmdbSearchResponse;
  const results = json.results || [];

  if (!results.length) {
    return null;
  }

  const ranked = results
    .map((result) => ({
      result,
      score: scoreTmdbCandidate(
        result,
        titlesToCompare,
        season,
        seasonYear,
        mediaType
      ),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];

  if (!best || best.score <= 0) {
    return null;
  }

  return best.result.id;
}

async function findTmdbIdForAnime(
  englishTitle: string | null,
  romajiTitle: string | null,
  season: SeasonArg,
  seasonYear: number,
  tmdbToken: string
): Promise<number | null> {
  const titlesToTry = [englishTitle, romajiTitle].filter(
    (value): value is string => Boolean(value && value.trim())
  );

  if (!titlesToTry.length) {
    return null;
  }

  for (const title of titlesToTry) {
    const tmdbTvId = await searchTmdb(
      title,
      titlesToTry,
      season,
      seasonYear,
      "tv",
      tmdbToken
    );

    if (tmdbTvId) {
      return tmdbTvId;
    }
  }

  for (const title of titlesToTry) {
    const tmdbMovieId = await searchTmdb(
      title,
      titlesToTry,
      season,
      seasonYear,
      "movie",
      tmdbToken
    );

    if (tmdbMovieId) {
      return tmdbMovieId;
    }
  }

  return null;
}

async function main() {
  const season = (process.argv[2]?.toUpperCase() || "FALL") as SeasonArg;
  const seasonYear = Number(process.argv[3] || "2025");
  const tmdbToken = process.env.TMDB_V4_READ_TOKEN;

  const validSeasons: SeasonArg[] = ["WINTER", "SPRING", "SUMMER", "FALL"];

  if (!validSeasons.includes(season)) {
    throw new Error(
      `Invalid season "${season}". Use one of: ${validSeasons.join(", ")}`
    );
  }

  if (!Number.isInteger(seasonYear) || seasonYear < 1900) {
    throw new Error(`Invalid year "${process.argv[3]}". Use a real year.`);
  }

  if (!tmdbToken) {
    throw new Error("Missing TMDB_V4_READ_TOKEN in .env.local");
  }

  const perPage = 50;
  let page = 1;
  let hasNextPage = true;

  const results: Array<{
    title: string;
    anilistId: number;
    tmdbId: number | null;
  }> = [];

  while (hasNextPage) {
    const pageData = await fetchAniListPage(page, perPage, season, seasonYear);

    for (const anime of pageData.media) {
      const title = anime.title.english || anime.title.romaji || "";

      const tmdbId = await findTmdbIdForAnime(
        anime.title.english,
        anime.title.romaji,
        season,
        seasonYear,
        tmdbToken
      );

      results.push({
        title,
        anilistId: anime.id,
        tmdbId,
      });
    }

    hasNextPage = pageData.pageInfo.hasNextPage;
    page += 1;
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});