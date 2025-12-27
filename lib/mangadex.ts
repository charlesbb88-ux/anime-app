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

export type MangaDexListPage = {
  data: MangaDexManga[];
  total: number;
  limit: number;
  offset: number;
};

const BASE = "https://api.mangadex.org";

function pickLang(
    map: MangaDexTitleMap | undefined,
    preferred: string[] = ["en"],
    opts?: { strict?: boolean }
): string | null {
    if (!map) return null;

    for (const lang of preferred) {
        if (map[lang]) return map[lang];
    }

    // ✅ if strict, do NOT fall back to random language
    if (opts?.strict) return null;

    // fallback: first entry
    const firstKey = Object.keys(map)[0];
    return firstKey ? map[firstKey] : null;
}

export function normalizeMangaDexTitle(m: MangaDexManga) {
    const norm = (s: any) => String(s ?? "").trim().toLowerCase();

    // ✅ strict: ONLY return if that language exists
    const titleEnMain = pickLang(m.attributes.title, ["en"], { strict: true });
    const titleJaMain = pickLang(m.attributes.title, ["ja", "jp"], { strict: true });

    const altEn =
        (m.attributes.altTitles || [])
            .map((t) => pickLang(t, ["en"], { strict: true }))
            .find((x) => !!x) || null;

    const altJa =
        (m.attributes.altTitles || [])
            .map((t) => pickLang(t, ["ja", "jp"], { strict: true }))
            .find((x) => !!x) || null;

    // ✅ “any title” for your main display fallback
    const titleAny =
        pickLang(m.attributes.title, ["en"], { strict: false }) ||
        pickLang(m.attributes.title, ["ja", "jp"], { strict: false }) ||
        pickLang(m.attributes.title, [], { strict: false });

    // ✅ pick true English when available
    let titleEnglish: string | null = null;
    if (altEn && titleEnMain && norm(altEn) !== norm(titleEnMain)) titleEnglish = altEn;
    else titleEnglish = titleEnMain || altEn || null;

    const titleNative = titleJaMain || altJa || null;

    const preferred = titleAny || titleEnglish || titleNative || null;

    return {
        title: titleAny || preferred || "Untitled",
        title_english: titleEnglish,
        title_native: titleNative,
        title_preferred: preferred,
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

export async function searchMangaDexByTitle(
    query: string,
    limit = 10,
    offset = 0
): Promise<MangaDexManga[]> {
    const url = new URL("https://api.mangadex.org/manga");

    url.searchParams.set("title", query);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));

    const res = await fetch(url.toString(), {
        headers: { "User-Agent": "your-app-mangadex-search" },
    });

    if (!res.ok) throw new Error(`MangaDex search failed: ${res.status}`);

    const json = await res.json();

    // force TS to treat the returned array as MangaDexManga[]
    return (json.data || []) as MangaDexManga[];
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

    const isPng = fileName.toLowerCase().endsWith(".png");
    const isJpg = fileName.toLowerCase().endsWith(".jpg") || fileName.toLowerCase().endsWith(".jpeg");

    // MangaDex CDN behavior:
    // - PNG covers: usually only the raw .png URL works (no .original.jpg / .1024.jpg variants)
    // - JPG covers: the .original.jpg / .1024.jpg / .512.jpg / .256.jpg variants work
    if (isPng) {
        return [
            `https://uploads.mangadex.org/covers/${mangaId}/${fileName}`,          // ✅ best/only reliable for png
            `https://uploads.mangadex.org/covers/${mangaId}/${fileName}.512.jpg`,  // sometimes exists
            `https://uploads.mangadex.org/covers/${mangaId}/${fileName}.256.jpg`,  // sometimes exists
        ];
    }

    if (isJpg) {
        return [
            `https://uploads.mangadex.org/covers/${mangaId}/${fileName}.original.jpg`,
            `https://uploads.mangadex.org/covers/${mangaId}/${fileName}.1024.jpg`,
            `https://uploads.mangadex.org/covers/${mangaId}/${fileName}.512.jpg`,
            `https://uploads.mangadex.org/covers/${mangaId}/${fileName}.256.jpg`,
        ];
    }

    // fallback for weird extensions
    return [`https://uploads.mangadex.org/covers/${mangaId}/${fileName}`];
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

export async function listMangaDexMangaPage(opts: {
  limit: number;
  offset: number;
  contentRatings?: Array<"safe" | "suggestive" | "erotica" | "pornographic">;
}): Promise<MangaDexListPage> {
  const { limit, offset, contentRatings = ["safe", "suggestive"] } = opts;

  const url = new URL(`${BASE}/manga`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  // ✅ filter rating (no porn)
  for (const r of contentRatings) url.searchParams.append("contentRating[]", r);

  // ❌ REMOVE ordering (this is the likely 400 cause)
  // url.searchParams.set("order[createdAt]", "asc");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "your-app-mangadex-crawler" },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`MangaDex list failed: ${res.status} ${body.slice(0, 300)}`);
  }

  const json = await res.json();

  return {
    data: (json.data || []) as MangaDexManga[],
    total: Number(json.total || 0),
    limit: Number(json.limit || limit),
    offset: Number(json.offset || offset),
  };
}
