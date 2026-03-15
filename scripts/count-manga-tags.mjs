const query = `
  query GetMangaPage($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        currentPage
        hasNextPage
      }
      media(type: MANGA) {
        id
        tags {
          name
        }
      }
    }
  }
`;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(page, perPage) {
  while (true) {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        query,
        variables: { page, perPage }
      })
    });

    if (res.status === 429) {
      console.log(`Rate limited on page ${page}. Waiting 10 seconds...`);
      await sleep(10000);
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    const json = await res.json();

    if (json.errors) {
      console.log(json.errors);
      throw new Error("AniList returned an error");
    }

    return json.data.Page;
  }
}

async function countMangaWithTags() {
  let page = 1;
  const perPage = 50;

  let totalMangaChecked = 0;
  let mangaWithTags = 0;
  let mangaWithoutTags = 0;

  while (true) {
    const pageData = await fetchPage(page, perPage);
    const media = pageData.media || [];

    for (const manga of media) {
      totalMangaChecked++;

      if (Array.isArray(manga.tags) && manga.tags.length > 0) {
        mangaWithTags++;
      } else {
        mangaWithoutTags++;
      }
    }

    console.log(
      `Finished page ${page}. Checked: ${totalMangaChecked}, with tags: ${mangaWithTags}, without tags: ${mangaWithoutTags}`
    );

    if (!pageData.pageInfo.hasNextPage) {
      break;
    }

    await sleep(1000);
    page++;
  }

  console.log("FINAL ANSWER");
  console.log("Total manga checked:", totalMangaChecked);
  console.log("Manga with tags:", mangaWithTags);
  console.log("Manga without tags:", mangaWithoutTags);
  console.log(
    "Percent with tags:",
    totalMangaChecked
      ? ((mangaWithTags / totalMangaChecked) * 100).toFixed(2) + "%"
      : "0%"
  );
}

countMangaWithTags().catch(console.error);