// count-anilist-manga.js
// Finds the REAL total number of AniList MANGA using binary search.
// ~10 requests total. Very rate-limit friendly.

const ANILIST_URL = "https://graphql.anilist.co";
const PER_PAGE = 50;

async function fetchPage(page) {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "anilist-count/1.0",
    },
    body: JSON.stringify({
      query: `
        query ($page: Int!, $perPage: Int!) {
          Page(page: $page, perPage: $perPage) {
            pageInfo { hasNextPage }
            media(type: MANGA) { id }
          }
        }
      `,
      variables: { page, perPage: PER_PAGE },
    }),
  });

  const json = await res.json();
  if (!json.data) throw new Error("AniList error");
  return json.data.Page;
}

async function run() {
  // 1) Find an upper bound
  let low = 1;
  let high = 1;

  while (true) {
    const page = await fetchPage(high);
    if (!page.pageInfo.hasNextPage) break;
    high *= 2;
  }

  // 2) Binary search for last page
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const page = await fetchPage(mid);

    if (page.pageInfo.hasNextPage) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  // 3) Count items on last page
  const lastPage = await fetchPage(low);
  const total =
    (low - 1) * PER_PAGE + lastPage.media.length;

  console.log("\n✅ REAL AniList manga count:", total);
}

run().catch((e) => {
  console.error("Failed:", e.message);
});
