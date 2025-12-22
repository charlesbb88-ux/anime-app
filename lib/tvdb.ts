// lib/tvdb.ts

type TvdbLoginResponse = {
  data?: { token?: string };
  status?: string;
};

/**
 * TheTVDB response shape is typically:
 * { status: "success", data: ... }
 */
type TvdbResponse<T> = {
  status?: string;
  data?: T;
};

type TvdbSearchItem = {
  tvdb_id?: number | string;
  id?: number | string;
  objectID?: string | null;

  name?: string;
  title?: string;

  image_url?: string | null;
  year?: string | number | null;
  overview?: string | null;

  primary_language?: string | null;
  primary_type?: string | null;
  type?: string | null;
  country?: string | null;
  status?: string | null;
  slug?: string | null;

  // ✅ these are what you’re trying to use
  aliases?: string[] | null;
  translations?: Record<string, string> | null;

  // ✅ also present in your sample
  overviews?: Record<string, string> | null;

  // optional extra stuff (present in your sample)
  first_air_time?: string | null;
  network?: string | null;
  thumbnail?: string | null;
  remote_ids?: Array<{
    id?: string | number | null;
    type?: number | null;
    sourceName?: string | null;
  }> | null;
};

const TVDB_API_BASE = "https://api4.thetvdb.com/v4";

let cachedToken: { token: string; obtainedAt: number } | null = null;

// TVDB says tokens are valid ~1 month; we’ll just refresh every 20 days to be safe.
const TOKEN_TTL_MS = 20 * 24 * 60 * 60 * 1000;

/* ======================================================
   Auth
====================================================== */

async function getTvdbToken(): Promise<string> {
  const now = Date.now();

  if (cachedToken && now - cachedToken.obtainedAt < TOKEN_TTL_MS) {
    return cachedToken.token;
  }

  const apikey = process.env.TVDB_APIKEY;
  const pin = process.env.TVDB_PIN; // optional depending on key type

  if (!apikey || !apikey.trim()) {
    throw new Error("Missing TVDB_APIKEY");
  }

  const body: Record<string, any> = { apikey: apikey.trim() };
  if (pin && pin.trim()) body.pin = pin.trim();

  const res = await fetch(`${TVDB_API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("TVDB login error:", res.status, text);
    throw new Error(`TVDB login failed (HTTP ${res.status})`);
  }

  const json = (await res.json()) as TvdbLoginResponse;
  const token = json.data?.token;

  if (!token) {
    throw new Error("TVDB login returned no token");
  }

  cachedToken = { token, obtainedAt: now };
  return token;
}

/* ======================================================
   Low-level request helper
====================================================== */

function buildUrl(path: string, params?: Record<string, string | number | boolean | null | undefined>) {
  const url = new URL(`${TVDB_API_BASE}${path}`);

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === null || v === undefined) continue;
      url.searchParams.set(k, String(v));
    }
  }

  return url.toString();
}

async function tvdbGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | null | undefined>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const token = await getTvdbToken();

    const url = buildUrl(path, params);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("TVDB GET error:", res.status, url, text);
      return { data: null, error: `TVDB HTTP ${res.status}` };
    }

    const json = (await res.json()) as TvdbResponse<T>;
    return { data: (json.data ?? null) as T | null, error: null };
  } catch (err: any) {
    console.error("TVDB GET exception:", err, path);
    return { data: null, error: err?.message || "Failed to contact TVDB" };
  }
}

/* ======================================================
   Search
====================================================== */

export async function searchTvdb(query: string) {
  const q = query.trim();
  if (!q) return { data: [], error: null as string | null };

  // /search?type=series&q=...
  const { data, error } = await tvdbGet<TvdbSearchItem[]>("/search", {
    type: "series",
    q,
  });

  if (error || !data) return { data: [], error };

  const mapped = data.map((r) => ({
    tvdb_id: r.tvdb_id ?? r.id ?? null,
    title: r.name ?? r.title ?? "Untitled",
    overview: r.overview ?? null,
    image_url: r.image_url ?? null,
    year: r.year ?? null,
    type: r.type ?? null,
    raw: r,
  }));

  return { data: mapped, error: null as string | null };
}

/* ======================================================
   Full import helpers (series / seasons / episodes / artwork / characters)
====================================================== */

export async function getTvdbSeriesExtended(seriesId: number) {
  return tvdbGet<any>(`/series/${seriesId}/extended`);
}

export async function getTvdbSeriesArtworks(seriesId: number) {
  return tvdbGet<any>(`/series/${seriesId}/artworks`);
}

/**
 * ✅ FIX: add paging (your logs show /seasons was 400 without it)
 */
export async function getTvdbSeriesSeasons(seriesId: number, page: number = 0) {
  return tvdbGet<any>(`/series/${seriesId}/seasons`, { page });
}

export async function getTvdbSeasonExtended(seasonId: number) {
  return tvdbGet<any>(`/seasons/${seasonId}/extended`);
}

export async function getTvdbSeasonArtworks(seasonId: number) {
  return tvdbGet<any>(`/seasons/${seasonId}/artworks`);
}

/**
 * Episodes for a series by season-type.
 * ✅ Keep paging explicit.
 *
 * NOTE: Some TVDB endpoints behave like page=1 is the first page.
 * So we expose the param cleanly and we’ll test 0 vs 1 from the importer if needed.
 */
export async function getTvdbSeriesEpisodes(
  seriesId: number,
  seasonType: string = "default",
  page: number = 0,
  lang: string = "eng"
) {
  return tvdbGet<any>(`/series/${seriesId}/episodes/${seasonType}/${lang}`, { page });
}

export async function getTvdbSeriesEpisodesFlat(seriesId: number, page: number = 0) {
  return tvdbGet<any>(`/series/${seriesId}/episodes`, { page });
}

export async function getTvdbEpisodeExtended(episodeId: number) {
  return tvdbGet<any>(`/episodes/${episodeId}/extended`);
}

export async function getTvdbEpisodeArtworks(episodeId: number) {
  return tvdbGet<any>(`/episodes/${episodeId}/artworks`);
}

/**
 * ✅ FIX: add paging (your logs show /characters was 400 without it)
 */
export async function getTvdbSeriesCharacters(seriesId: number, page: number = 0) {
  return tvdbGet<any>(`/series/${seriesId}/characters`, { page });
}
