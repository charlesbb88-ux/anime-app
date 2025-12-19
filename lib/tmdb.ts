// lib/tmdb.ts

/* ======================================================
   TMDB helpers (TV)
   - Search TV
   - Get TV details
   - Get TV images (posters/backdrops/logos)
   - Get Season details (includes episodes with overview + still_path)
   - Get Season images
   - Get Episode images
====================================================== */

type TmdbSearchTvResult = {
  id: number;
  name: string;
  original_name: string;
  overview: string | null;
  first_air_date: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
};

type TmdbSearchTvResponse = {
  results: TmdbSearchTvResult[];
};

type TmdbGenre = { id: number; name: string };

export type TmdbTvSeasonStub = {
  id: number;
  season_number: number;
  name: string;
  overview: string | null;
  air_date: string | null;
  poster_path: string | null;
  episode_count: number | null;
};

export type TmdbTvDetails = {
  id: number;
  name: string;
  original_name: string | null;
  overview: string | null;

  first_air_date: string | null;
  last_air_date: string | null;

  number_of_episodes: number | null;
  number_of_seasons: number | null;

  status: string | null; // Ended, Returning Series, etc.
  type: string | null; // Scripted, etc.

  vote_average: number | null; // 0..10
  genres: TmdbGenre[] | null;

  poster_path: string | null;
  backdrop_path: string | null;

  seasons: TmdbTvSeasonStub[] | null;
};

type TmdbImageItem = {
  aspect_ratio: number | null;
  height: number | null;
  width: number | null;
  iso_639_1: string | null;
  file_path: string;
  vote_average: number | null;
  vote_count: number | null;
};

export type TmdbImagesResponse = {
  id: number;
  posters?: TmdbImageItem[];
  backdrops?: TmdbImageItem[];
  logos?: TmdbImageItem[];
  stills?: TmdbImageItem[]; // used by episode images endpoint
};

export type TmdbSeasonEpisode = {
  id: number; // tmdb episode id
  episode_number: number;
  name: string;
  overview: string | null;
  air_date: string | null;
  still_path: string | null;
};

export type TmdbSeasonDetails = {
  id: number; // tmdb season id
  name: string;
  overview: string | null;
  air_date: string | null;
  poster_path: string | null;
  season_number: number;
  episodes: TmdbSeasonEpisode[];
};

const TMDB_API_BASE = "https://api.themoviedb.org/3";

/* ----------------- Auth headers -----------------
   TMDB v3 endpoints accept either:
   - v3 api_key query param, OR
   - v4 read token as Bearer (recommended)
-------------------------------------------------- */
function tmdbHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const token = process.env.TMDB_V4_READ_TOKEN;
  if (token && token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  return headers;
}

function tmdbKeyQuery() {
  const key = process.env.TMDB_API_KEY;
  return key && key.trim() ? `&api_key=${encodeURIComponent(key)}` : "";
}

/* ----------------- Images -----------------
   TMDB image URLs are base_url + size + file_path. :contentReference[oaicite:1]{index=1}
   For simplicity we use the standard CDN base.
------------------------------------------- */
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export function tmdbImageUrl(
  path: string | null,
  size: "w185" | "w342" | "w500" | "w780" | "original" = "w500"
) {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

function toYear(date: string | null): number | null {
  if (!date || date.length < 4) return null;
  const y = parseInt(date.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

async function tmdbGet<T>(path: string): Promise<{ data: T | null; error: string | null }> {
  const url = `${TMDB_API_BASE}${path}${path.includes("?") ? "" : "?"}${
    path.includes("?") ? "" : ""
  }${tmdbKeyQuery()}`;

  // If path already has ?, tmdbKeyQuery() already starts with &
  // If path has no ?, we added ? above; tmdbKeyQuery begins with &
  const finalUrl = url.replace("?&", "?");

  try {
    const res = await fetch(finalUrl, {
      method: "GET",
      headers: tmdbHeaders(),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("TMDB HTTP error:", res.status, text);
      return { data: null, error: `TMDB HTTP ${res.status}` };
    }

    const json = (await res.json()) as T;
    return { data: json, error: null };
  } catch (err) {
    console.error("TMDB exception:", err);
    return { data: null, error: "Failed to contact TMDB" };
  }
}

/* ======================================================
   Search
====================================================== */

export async function searchTmdbTv(query: string) {
  const q = query.trim();
  if (!q) return { data: [], error: null as string | null };

  const path =
    `/search/tv?query=${encodeURIComponent(q)}` +
    `&include_adult=false&language=en-US&page=1`;

  const { data, error } = await tmdbGet<TmdbSearchTvResponse>(path);

  if (error || !data) return { data: [], error };

  const mapped = (data.results ?? []).map((r) => ({
    tmdb_id: r.id,
    title: r.name ?? r.original_name ?? "Untitled",
    overview: r.overview ?? null,
    year: toYear(r.first_air_date),
    first_air_date: r.first_air_date ?? null,
    poster_url: tmdbImageUrl(r.poster_path, "w500"),
    backdrop_url: tmdbImageUrl(r.backdrop_path, "w780"),
    raw: r,
  }));

  return { data: mapped, error: null as string | null };
}

/* ======================================================
   Details + images
====================================================== */

export async function getTmdbTvDetails(tvId: number) {
  // TV series details endpoint :contentReference[oaicite:2]{index=2}
  const path = `/tv/${tvId}?language=en-US`;
  return tmdbGet<TmdbTvDetails>(path);
}

export async function getTmdbTvImages(tvId: number) {
  // TV series images endpoint :contentReference[oaicite:3]{index=3}
  const path = `/tv/${tvId}/images`;
  return tmdbGet<TmdbImagesResponse>(path);
}

export async function getTmdbSeasonDetails(tvId: number, seasonNumber: number) {
  // TV season details endpoint :contentReference[oaicite:4]{index=4}
  const path = `/tv/${tvId}/season/${seasonNumber}?language=en-US`;
  return tmdbGet<TmdbSeasonDetails>(path);
}

export async function getTmdbSeasonImages(tvId: number, seasonNumber: number) {
  const path = `/tv/${tvId}/season/${seasonNumber}/images`;
  return tmdbGet<TmdbImagesResponse>(path);
}

export async function getTmdbEpisodeImages(tvId: number, seasonNumber: number, episodeNumber: number) {
  const path = `/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}/images`;
  return tmdbGet<TmdbImagesResponse>(path);
}
