// lib/mangadexCovers.ts
export type MangaDexCover = {
    id: string;
    attributes: {
        volume: string | null;
        locale: string | null;
        fileName: string;
    };
};

export async function listMangaDexCovers(params: {
    mangadexMangaId: string;
    limit?: number;
    offset?: number;
}): Promise<{ covers: MangaDexCover[]; total: number; limit: number; offset: number }> {
    const limit = params.limit ?? 100;
    const offset = params.offset ?? 0;

    const base = "https://api.mangadex.org/cover";
    const q = new URLSearchParams();

    q.set("limit", String(limit));
    q.set("offset", String(offset));
    q.set("order[volume]", "asc");
    q.append("manga[]", params.mangadexMangaId);

    const url = `${base}?${q.toString()}`;

    const res = await fetch(url, {
        headers: {
            "User-Agent": "your-app-mangadex-cover-list",
        },
    });

    if (!res.ok) {
        throw new Error(`MangaDex cover list failed: ${res.status}`);
    }

    const json = await res.json();

    return {
        covers: (json.data || []) as MangaDexCover[],
        total: Number(json.total || 0),
        limit: Number(json.limit || limit),
        offset: Number(json.offset || offset),
    };
}

export function coverCandidates(mangadexMangaId: string, fileName: string): string[] {
  const base = `https://uploads.mangadex.org/covers/${mangadexMangaId}/${fileName}`;

  return [
    base,                // sometimes ONLY this exists
    `${base}.original.jpg`,
    `${base}.1024.jpg`,
    `${base}.512.jpg`,
    `${base}.256.jpg`,
  ];
}


