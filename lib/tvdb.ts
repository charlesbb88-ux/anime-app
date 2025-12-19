// lib/tvdb.ts

type TvdbLoginResponse = {
  data?: { token?: string };
  status?: string;
};

type TvdbSearchItem = {
  tvdb_id?: number;
  id?: number;
  name?: string;
  title?: string;
  image_url?: string | null;
  year?: string | number | null;
  overview?: string | null;
  primary_language?: string | null;
  objectID?: string | null;
  type?: string | null;
};

type TvdbSearchResponse = {
  data?: TvdbSearchItem[];
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

async function tvdbGet<T>(path: string): Promise<{ data: T | null; error: string | null }> {
  try {
    const token = await getTvdbToken();

    const res = await fetch(`${TVDB_API_BASE}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("TVDB GET error:", res.status, path, text);
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

  // v4 search pattern used in the docs/tools: /search?type=series&q=...
  const path = `/search?type=series&q=${encodeURIComponent(q)}`;

  const { data, error } = await tvdbGet<TvdbSearchItem[]>(path);

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

/**
 * Series extended record.
 * We keep this as "any" friendly because TVDB returns a big shape,
 * and we only pluck what we need in the importer.
 */
export async function getTvdbSeriesExtended(seriesId: number) {
  // commonly: /series/{id}/extended
  return tvdbGet<any>(`/series/${seriesId}/extended`);
}

/**
 * Series artwork list.
 * commonly: /series/{id}/artworks
 */
export async function getTvdbSeriesArtworks(seriesId: number) {
  return tvdbGet<any>(`/series/${seriesId}/artworks`);
}

/**
 * Seasons for a series.
 * commonly: /series/{id}/seasons
 */
export async function getTvdbSeriesSeasons(seriesId: number) {
  return tvdbGet<any>(`/series/${seriesId}/seasons`);
}

/**
 * Season extended record.
 * commonly: /seasons/{id}/extended
 */
export async function getTvdbSeasonExtended(seasonId: number) {
  return tvdbGet<any>(`/seasons/${seasonId}/extended`);
}

/**
 * Season artwork list.
 * commonly: /seasons/{id}/artworks
 */
export async function getTvdbSeasonArtworks(seasonId: number) {
  return tvdbGet<any>(`/seasons/${seasonId}/artworks`);
}

/**
 * Episodes for a series by season-type.
 * TVDB supports multiple season orders; "default" is usually "Aired Order".
 * commonly referenced: /series/{id}/episodes/{season-type}
 *
 * Some installs want pagination: ?page=0,1,2...
 */
export async function getTvdbSeriesEpisodes(seriesId: number, seasonType: number, page: number = 0) {
  return tvdbGet<any>(`/series/${seriesId}/episodes/${seasonType}?page=${page}`);
}

/**
 * Episode extended record (includes overview/description fields).
 * commonly: /episodes/{id}/extended
 */
export async function getTvdbEpisodeExtended(episodeId: number) {
  return tvdbGet<any>(`/episodes/${episodeId}/extended`);
}

/**
 * Episode artwork list.
 * commonly: /episodes/{id}/artworks
 */
export async function getTvdbEpisodeArtworks(episodeId: number) {
  return tvdbGet<any>(`/episodes/${episodeId}/artworks`);
}

/**
 * Characters / cast for a series.
 * commonly: /series/{id}/characters
 */
export async function getTvdbSeriesCharacters(seriesId: number) {
  return tvdbGet<any>(`/series/${seriesId}/characters`);
}
