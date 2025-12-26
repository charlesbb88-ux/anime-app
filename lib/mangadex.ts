// lib/mangadex.ts

type MangaDexTitleMap = Record<string, string>;

export type MangaDexManga = {
  id: string;
  attributes: {
    title?: MangaDexTitleMap;
    altTitles?: MangaDexTitleMap[];
    description?: MangaDexTitleMap;
    status?: string | null;
    originalLanguage?: string | null;
    publicationDemographic?: string | null;
    year?: number | null;
    tags?: Array<{
      id: string;
      attributes?: {
        name?: MangaDexTitleMap;
        group?: string | null; // usually "genre", "theme", "format", etc.
      };
    }>;
  };
  relationships?: Array<{
    id: string;
    type: string; // "author" | "artist" | "cover_art" | ...
    attributes?: any;
  }>;
};

export type MangaDexSearchResponse = {
  result: string;
  response: string;
  data: MangaDexManga[];
  total: number;
};

export type MangaDexAuthor = {
  id: string;
  attributes?: {
    name?: string;
  };
};

const BASE = "https://api.mangadex.org";

function pickLang(map: MangaDexTitleMap | undefined, preferred: string[] = ["en"]): string | null {
  if (!map) return null;
  for (const lang of preferred) {
    if (map[lang]) return map[lang];
  }
  // fallback: first entry
  const firstKey = Object.keys(map)[0];
  return firstKey ? map[firstKey] : null;
}

export function normalizeMangaDexTitle(m: MangaDexManga) {
  const titleEn = pickLang(m.attributes.title, ["en"]);
  const titleJa = pickLang(m.attributes.title, ["ja", "jp"]);
  const titleAny = pickLang(m.attributes.title, ["en"]) || pickLang(m.attributes.title, ["ja", "jp"]) || pickLang(m.attributes.title, []);

  const altEn =
    (m.attributes.altTitles || [])
      .map((t) => pickLang(t, ["en"]))
      .find((x) => !!x) || null;

  const preferred = titleEn || altEn || titleAny || titleJa || null;

  return {
    title: titleAny || preferred || "Untitled",
    title_english: titleEn || altEn || null,
    title_native: titleJa || null,
    title_preferred: preferred || null,
  };
}

export function normalizeMangaDexDescription(m: MangaDexManga) {
  const desc =
    pickLang(m.attributes.description, ["en"]) ||
    pickLang(m.attributes.description, ["ja", "jp"]) ||
    pickLang(m.attributes.description, []);
  return desc || null;
}

export function splitTags(m: MangaDexManga): { genres: string[]; themes: string[] } {
  const tags = m.attributes.tags || [];
  const genres: string[] = [];
  const themes: string[] = [];

  for (const t of tags) {
    const group = (t.attributes?.group || "").toLowerCase();
    const name = pickLang(t.attributes?.name, ["en"]) || pickLang(t.attributes?.name, []) || null;
    if (!name) continue;

    // MangaDex tag groups vary; we keep a conservative mapping.
    if (group === "genre") genres.push(name);
    else if (group === "theme") themes.push(name);
    else {
      // if group missing/unknown, we can choose to treat as genre or ignore.
      // I recommend: ignore to stay conservative / clean.
    }
  }

  // de-dupe + stable sort
  const uniq = (arr: string[]) => Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b));
  return { genres: uniq(genres), themes: uniq(themes) };
}

export function normalizeStatus(m: MangaDexManga): string | null {
  const s = (m.attributes.status || "").toLowerCase().trim();
  if (!s) return null;
  // MangaDex commonly: ongoing, completed, hiatus, cancelled
  return s;
}

export async function searchMangaDexByTitle(query: string, limit = 10): Promise<MangaDexManga[]> {
  const url = new URL(`${BASE}/manga`);
  url.searchParams.set("title", query);
  url.searchParams.set("limit", String(limit));
  // include relationships so we can find cover_art id and author/artist ids
  url.searchParams.append("includes[]", "author");
  url.searchParams.append("includes[]", "artist");
  url.searchParams.append("includes[]", "cover_art");
  // we are NOT requesting chapters anywhere.

  const res = await fetch(url.toString(), { headers: { "User-Agent": "your-app-metadata-ingestor" } });
  if (!res.ok) throw new Error(`MangaDex search failed: ${res.status}`);
  const json = (await res.json()) as MangaDexSearchResponse;
  return json.data || [];
}

export async function getMangaDexMangaById(id: string): Promise<MangaDexManga> {
  const url = new URL(`${BASE}/manga/${id}`);
  url.searchParams.append("includes[]", "author");
  url.searchParams.append("includes[]", "artist");
  url.searchParams.append("includes[]", "cover_art");

  const res = await fetch(url.toString(), { headers: { "User-Agent": "your-app-metadata-ingestor" } });
  if (!res.ok) throw new Error(`MangaDex fetch failed: ${res.status}`);
  const json = await res.json();
  return json.data as MangaDexManga;
}

// Cover URL builder (still points to MangaDex CDN). We'll optionally proxy/cache later.
export function getMangaDexCoverBase(m: MangaDexManga): { mangaId: string; fileName: string } | null {
  const rel = (m.relationships || []).find((r) => r.type === "cover_art");
  const fileName = rel?.attributes?.fileName;
  if (!fileName) return null;
  return { mangaId: m.id, fileName };
}

export function getMangaDexCoverCandidates(m: MangaDexManga): string[] {
  const base = getMangaDexCoverBase(m);
  if (!base) return [];
  const { mangaId, fileName } = base;

  // best → worst
  return [
    `https://uploads.mangadex.org/covers/${mangaId}/${fileName}.original.jpg`,
    `https://uploads.mangadex.org/covers/${mangaId}/${fileName}.1024.jpg`,
    `https://uploads.mangadex.org/covers/${mangaId}/${fileName}.512.jpg`,
    `https://uploads.mangadex.org/covers/${mangaId}/${fileName}.256.jpg`,
  ];
}

export function getCreators(m: MangaDexManga): { authors: any[]; artists: any[] } {
  const rels = m.relationships || [];

  const authors = rels
    .filter((r) => r.type === "author")
    .map((r) => ({ id: r.id, name: r.attributes?.name || null }))
    .filter((x) => x.name);

  const artists = rels
    .filter((r) => r.type === "artist")
    .map((r) => ({ id: r.id, name: r.attributes?.name || null }))
    .filter((x) => x.name);

  // de-dupe by name
  const uniqByName = (arr: any[]) => {
    const seen = new Set<string>();
    return arr.filter((a) => {
      const key = String(a.name || "").toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  return { authors: uniqByName(authors), artists: uniqByName(artists) };
}
