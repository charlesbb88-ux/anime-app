// scripts/get-anilist-season.ts

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

async function main() {
  const season = (process.argv[2]?.toUpperCase() || "FALL") as SeasonArg;
  const seasonYear = Number(process.argv[3] || "2025");

  const validSeasons: SeasonArg[] = ["WINTER", "SPRING", "SUMMER", "FALL"];

  if (!validSeasons.includes(season)) {
    throw new Error(
      `Invalid season "${season}". Use one of: ${validSeasons.join(", ")}`
    );
  }

  if (!Number.isInteger(seasonYear) || seasonYear < 1900) {
    throw new Error(`Invalid year "${process.argv[3]}". Use a real year.`);
  }

  const perPage = 50;
  let page = 1;
  let hasNextPage = true;

  const results: Array<{ id: number; name: string }> = [];

  while (hasNextPage) {
    const pageData = await fetchAniListPage(page, perPage, season, seasonYear);

    for (const anime of pageData.media) {
      results.push({
        id: anime.id,
        name: anime.title.english || anime.title.romaji || "",
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