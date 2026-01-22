// lib/mangadex_covers.ts
const BASE = "https://api.mangadex.org";

type MdCover = {
  id: string;
  attributes?: {
    fileName?: string;
    volume?: string | null;
    createdAt?: string;
  };
  relationships?: Array<{ id: string; type: string }>;
};

type MdCoverListResponse = {
  result: string;
  response: string;
  data?: MdCover[];
};

export async function fetchBestMangaDexCoverUrl(mdMangaId: string): Promise<string | null> {
  if (!mdMangaId) return null;

  const url = new URL(`${BASE}/cover`);
  url.searchParams.append("manga[]", mdMangaId);
  url.searchParams.set("limit", "10");

  // Try to bias toward “latest/best” covers
  url.searchParams.set("order[volume]", "desc");
  url.searchParams.set("order[createdAt]", "desc");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "your-app-mangadex-cover-picker" },
  });

  if (!res.ok) return null;

  const json = (await res.json()) as MdCoverListResponse;
  const covers = (json.data || []).filter((c) => c?.attributes?.fileName);

  if (!covers.length) return null;

  // Pick first after ordering (already sorted by API order params)
  const best = covers[0];
  const fileName = best.attributes!.fileName!;
  return `https://uploads.mangadex.org/covers/${mdMangaId}/${fileName}.original.jpg`;
}
