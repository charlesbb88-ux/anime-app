// pages/api/admin/import-anime.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getTmdbTvDetails,
  getTmdbTvImages,
  getTmdbSeasonDetails,
  getTmdbSeasonImages,
  getTmdbEpisodeImages,
  tmdbImageUrl,
} from "@/lib/tmdb";
import {
  getTvdbSeriesExtended,
  getTvdbSeriesArtworks,
  getTvdbSeriesSeasons,
  getTvdbSeasonExtended,
  getTvdbSeasonArtworks,
  getTvdbSeriesEpisodes,
  getTvdbEpisodeExtended,
  getTvdbEpisodeArtworks,
  getTvdbSeriesCharacters,
} from "@/lib/tvdb";

/* ---------------------- helpers ---------------------- */

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toDateOnly(s: string | null): string | null {
  if (!s || s.length < 10) return null;
  return s.slice(0, 10);
}

function safeIntYear(s: any): number | null {
  if (typeof s === "number" && Number.isFinite(s)) return s;
  if (typeof s === "string" && s.length >= 4) {
    const n = parseInt(s.slice(0, 4), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeTvdbImageUrl(u: any): string | null {
  if (!u || typeof u !== "string") return null;
  const s = u.trim();
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return `https://artworks.thetvdb.com${s}`;
  return s;
}

function tvdbArtworkKind(raw: any): string {
  const t =
    raw?.typeName ||
    raw?.type ||
    raw?.artworkType ||
    raw?.artwork_type ||
    raw?.tag ||
    raw?.name ||
    "artwork";

  const k = String(t).toLowerCase();

  if (k.includes("poster")) return "poster";
  if (k.includes("background") || k.includes("backdrop")) return "backdrop";
  if (k.includes("banner")) return "banner";
  if (k.includes("logo")) return "logo";
  if (k.includes("character")) return "character";
  if (k.includes("still") || k.includes("screencap")) return "still";

  return k.replace(/\s+/g, "_");
}

/**
 * NOTE:
 * We keep these helpers deliberately loosely typed, because your Supabase
 * generated types / GenericStringError unions can cause TS to think `data`
 * is an error-shaped object. At runtime, Supabase returns `data` rows or null.
 */
async function updateAnimeById(
  animeId: string,
  payload: Record<string, any>,
  selectCols: string
): Promise<{ data: any; error: any }> {
  const { data, error } = await supabaseAdmin
    .from("anime")
    .update(payload)
    .eq("id", animeId)
    .select(selectCols)
    .single();

  return { data, error };
}

async function upsertAnimeBySlug(
  payload: Record<string, any>,
  selectCols: string
): Promise<{ data: any; error: any }> {
  // IMPORTANT:
  // We ONLY use slug for onConflict because slug should be UNIQUE.
  // We do NOT use tmdb_id/tvdb_id in onConflict unless you add UNIQUE constraints.
  const { data, error } = await supabaseAdmin
    .from("anime")
    .upsert(payload, { onConflict: "slug" })
    .select(selectCols)
    .single();

  return { data, error };
}

async function findExistingAnimeIdByTmdb(tmdbId: number): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("anime")
    .select("id")
    .eq("tmdb_id", tmdbId)
    .maybeSingle();

  if (error) console.error("existingByTmdb lookup error:", error);

  const id = (data as any)?.id;
  return typeof id === "string" ? id : null;
}

async function findExistingAnimeIdByTvdb(tvdbId: number): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("anime")
    .select("id")
    .eq("tvdb_id", tvdbId)
    .maybeSingle();

  if (error) console.error("existingByTvdb lookup error:", error);

  const id = (data as any)?.id;
  return typeof id === "string" ? id : null;
}

function mustId(row: any, label: string): string | null {
  const id = row?.id;
  if (typeof id === "string" && id.length) return id;
  console.error(`${label}: missing id on row`, row);
  return null;
}

const ADMIN_IMPORT_SECRET = process.env.ANIME_IMPORT_SECRET || "";

type Body = {
  source?: "tmdb" | "tvdb";
  sourceId?: number | string;
  secret?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (ADMIN_IMPORT_SECRET) {
    const token =
      (req.headers["x-import-secret"] as string | undefined) ||
      (req.body && (req.body.secret as string | undefined));

    if (!token || token !== ADMIN_IMPORT_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const { source, sourceId } = req.body as Body;

  if (!source || !sourceId) return res.status(400).json({ error: "Missing source or sourceId" });

  const idNum = typeof sourceId === "string" ? parseInt(sourceId, 10) : sourceId;
  if (!idNum || Number.isNaN(idNum)) return res.status(400).json({ error: "Invalid sourceId" });

  if (source === "tmdb") return importFromTmdb(idNum, res);
  if (source === "tvdb") return importFromTvdb(idNum, res);

  return res.status(400).json({ error: "Invalid source" });
}

/* ======================================================
   TMDB import (full: series + seasons + episodes + artwork)
====================================================== */

async function importFromTmdb(tmdbId: number, res: NextApiResponse) {
  const { data: tv, error: tvErr } = await getTmdbTvDetails(tmdbId);
  if (tvErr || !tv) {
    console.error("TMDB details error:", tvErr);
    return res.status(500).json({ error: tvErr || "Failed to fetch TMDB TV details" });
  }

  const { data: tvImages, error: imgErr } = await getTmdbTvImages(tmdbId);
  if (imgErr) console.error("TMDB images error:", imgErr);

  const title = tv.name || tv.original_name || "Untitled";
  const slug = slugifyTitle(title);

  const totalEpisodes = typeof tv.number_of_episodes === "number" ? tv.number_of_episodes : null;

  const posterUrl = tmdbImageUrl(tv.poster_path, "original");
  const backdropUrl = tmdbImageUrl(tv.backdrop_path, "original");

  const genres = (tv.genres ?? []).map((g) => g.name).filter(Boolean);
  const averageScore =
    typeof tv.vote_average === "number" ? Math.round(tv.vote_average * 10) : null; // 0..100

  const existingAnimeId = await findExistingAnimeIdByTmdb(tmdbId);

  const animePayload = {
    title,
    slug,
    total_episodes: totalEpisodes,
    image_url: posterUrl,
    banner_image_url: backdropUrl,
    description: tv.overview ?? null,
    format: "TV",
    status: tv.status ?? null,
    season: null,
    season_year: tv.first_air_date ? parseInt(tv.first_air_date.slice(0, 4), 10) : null,
    start_date: toDateOnly(tv.first_air_date),
    end_date: toDateOnly(tv.last_air_date),
    average_score: averageScore,
    source: null,
    genres: genres.length ? genres : null,
    tmdb_id: tmdbId,
  };

  const selectCols = "id, title, slug, tmdb_id, total_episodes";

  const { data: upserted, error: upsertErr } = existingAnimeId
    ? await updateAnimeById(existingAnimeId, animePayload, selectCols)
    : await upsertAnimeBySlug(animePayload, selectCols);

  if (upsertErr || !upserted) {
    console.error("TMDB anime write error:", upsertErr);
    return res.status(500).json({
      error: `Failed to upsert anime (TMDB): ${upsertErr?.message || "unknown"}`,
    });
  }

  const animeId = mustId(upserted, "TMDB anime upsert");
  if (!animeId) return res.status(500).json({ error: "TMDB upsert returned no anime id" });

  // 4) Insert ALL series artwork into anime_artwork
  try {
    const posters = tvImages?.posters ?? [];
    const backdrops = tvImages?.backdrops ?? [];
    const logos = tvImages?.logos ?? [];

    const seriesArtworkRows = [
      ...posters.map((p, idx) => ({
        anime_id: animeId,
        source: "tmdb",
        kind: "poster",
        url: tmdbImageUrl(p.file_path, "original")!,
        lang: p.iso_639_1 ?? null,
        width: p.width ?? null,
        height: p.height ?? null,
        vote: p.vote_average ?? null,
        is_primary: idx === 0,
      })),
      ...backdrops.map((b, idx) => ({
        anime_id: animeId,
        source: "tmdb",
        kind: "backdrop",
        url: tmdbImageUrl(b.file_path, "original")!,
        lang: b.iso_639_1 ?? null,
        width: b.width ?? null,
        height: b.height ?? null,
        vote: b.vote_average ?? null,
        is_primary: idx === 0,
      })),
      ...logos.map((l, idx) => ({
        anime_id: animeId,
        source: "tmdb",
        kind: "logo",
        url: tmdbImageUrl(l.file_path, "original")!,
        lang: l.iso_639_1 ?? null,
        width: l.width ?? null,
        height: l.height ?? null,
        vote: l.vote_average ?? null,
        is_primary: idx === 0,
      })),
    ].filter((r) => !!r.url);

    if (seriesArtworkRows.length) {
      await supabaseAdmin.from("anime_artwork").upsert(seriesArtworkRows, {
        onConflict: "anime_id,source,kind,url",
      });
    }
  } catch (e) {
    console.error("Series artwork insert error:", e);
  }

  // 5) Seasons + season artwork + episodes + episode artwork
  const seasons = (tv.seasons ?? []).filter((s) => typeof s.season_number === "number");
  let globalEpisodeCounter = 0;

  for (const s of seasons) {
    const seasonNumber = s.season_number;

    const { data: seasonRow, error: seasonUpErr } = await supabaseAdmin
      .from("anime_seasons")
      .upsert(
        {
          anime_id: animeId,
          season_number: seasonNumber,
          title: s.name ?? null,
          description: s.overview ?? null,
          air_date: s.air_date ? toDateOnly(s.air_date) : null,
          tmdb_season_id: s.id ?? null,
        },
        { onConflict: "anime_id,season_number" }
      )
      .select("id")
      .single();

    if (seasonUpErr || !seasonRow) {
      console.error("Season upsert error:", seasonUpErr);
      continue;
    }

    const animeSeasonId = mustId(seasonRow, "TMDB season upsert");
    if (!animeSeasonId) continue;

    try {
      const { data: seasonImages } = await getTmdbSeasonImages(tmdbId, seasonNumber);
      const posters = seasonImages?.posters ?? [];
      const backdrops = seasonImages?.backdrops ?? [];
      const logos = seasonImages?.logos ?? [];

      const seasonArtworkRows = [
        ...posters.map((p, idx) => ({
          anime_season_id: animeSeasonId,
          source: "tmdb",
          kind: "poster",
          url: tmdbImageUrl(p.file_path, "original")!,
          lang: p.iso_639_1 ?? null,
          width: p.width ?? null,
          height: p.height ?? null,
          vote: p.vote_average ?? null,
          is_primary: idx === 0,
        })),
        ...backdrops.map((b, idx) => ({
          anime_season_id: animeSeasonId,
          source: "tmdb",
          kind: "backdrop",
          url: tmdbImageUrl(b.file_path, "original")!,
          lang: b.iso_639_1 ?? null,
          width: b.width ?? null,
          height: b.height ?? null,
          vote: b.vote_average ?? null,
          is_primary: idx === 0,
        })),
        ...logos.map((l, idx) => ({
          anime_season_id: animeSeasonId,
          source: "tmdb",
          kind: "logo",
          url: tmdbImageUrl(l.file_path, "original")!,
          lang: l.iso_639_1 ?? null,
          width: l.width ?? null,
          height: l.height ?? null,
          vote: l.vote_average ?? null,
          is_primary: idx === 0,
        })),
      ].filter((r) => !!r.url);

      if (seasonArtworkRows.length) {
        await supabaseAdmin.from("anime_season_artwork").upsert(seasonArtworkRows, {
          onConflict: "anime_season_id,source,kind,url",
        });
      }
    } catch (e) {
      console.error("Season artwork insert error:", e);
    }

    const { data: seasonDetails, error: seasonDetErr } = await getTmdbSeasonDetails(
      tmdbId,
      seasonNumber
    );
    if (seasonDetErr || !seasonDetails) {
      console.error("Season details error:", seasonDetErr);
      continue;
    }

    for (const ep of seasonDetails.episodes ?? []) {
      globalEpisodeCounter += 1;

      const { data: episodeRow, error: epErr } = await supabaseAdmin
        .from("anime_episodes")
        .upsert(
          {
            anime_id: animeId,
            episode_number: globalEpisodeCounter,
            season_number: seasonNumber,
            season_episode_number: ep.episode_number,
            title: ep.name ?? null,
            synopsis: ep.overview ?? null,
            air_date: ep.air_date ? toDateOnly(ep.air_date) : null,
            tmdb_episode_id: ep.id ?? null,
          },
          { onConflict: "anime_id,episode_number" }
        )
        .select("id")
        .single();

      if (epErr || !episodeRow) {
        console.error("Episode upsert error:", epErr);
        continue;
      }

      const animeEpisodeId = mustId(episodeRow, "TMDB episode upsert");
      if (!animeEpisodeId) continue;

      if (ep.still_path) {
        try {
          await supabaseAdmin.from("anime_episode_artwork").upsert(
            [
              {
                anime_episode_id: animeEpisodeId,
                source: "tmdb",
                kind: "still",
                url: tmdbImageUrl(ep.still_path, "original")!,
                lang: null,
                width: null,
                height: null,
                vote: null,
                is_primary: true,
              },
            ],
            { onConflict: "anime_episode_id,source,kind,url" }
          );
        } catch (e) {
          console.error("Episode still insert error:", e);
        }
      }

      try {
        const { data: epImages } = await getTmdbEpisodeImages(
          tmdbId,
          seasonNumber,
          ep.episode_number
        );
        const stills = epImages?.stills ?? [];

        const rows = stills.map((s, idx) => ({
          anime_episode_id: animeEpisodeId,
          source: "tmdb",
          kind: "still",
          url: tmdbImageUrl(s.file_path, "original")!,
          lang: s.iso_639_1 ?? null,
          width: s.width ?? null,
          height: s.height ?? null,
          vote: s.vote_average ?? null,
          is_primary: idx === 0 && !ep.still_path,
        }));

        if (rows.length) {
          await supabaseAdmin.from("anime_episode_artwork").upsert(rows, {
            onConflict: "anime_episode_id,source,kind,url",
          });
        }
      } catch (e) {
        console.error("Episode images fetch/insert error:", e);
      }
    }
  }

  return res.status(200).json({
    success: true,
    source: "tmdb",
    anime_id: animeId,
    tmdb_id: tmdbId,
  });
}

/* ======================================================
   TVDB import (series + seasons + episodes + artwork + characters)
====================================================== */

async function importFromTvdb(tvdbId: number, res: NextApiResponse) {
  const { data: series, error: seriesErr } = await getTvdbSeriesExtended(tvdbId);
  if (seriesErr || !series) {
    console.error("TVDB series extended error:", seriesErr);
    return res.status(500).json({ error: seriesErr || "Failed to fetch TVDB series" });
  }

  const title: string =
    series?.name ||
    series?.seriesName ||
    series?.title ||
    series?.translations?.name ||
    "Untitled";

  const slug = slugifyTitle(title);

  const overview: string | null =
    series?.overview ||
    series?.overviewTranslations?.[0]?.overview ||
    series?.translations?.overview ||
    null;

  const startDate: string | null = toDateOnly(series?.firstAired ?? null);
  const year: number | null = safeIntYear(series?.year ?? (startDate ? startDate.slice(0, 4) : null));

  const genres: string[] = Array.isArray(series?.genres) ? series.genres.filter(Boolean) : [];
  const status: string | null = series?.status?.name || series?.status || null;

  const primaryPoster = normalizeTvdbImageUrl(
    series?.image || series?.poster || series?.artwork?.poster || null
  );

  const primaryBanner = normalizeTvdbImageUrl(
    series?.banner || series?.artwork?.background || series?.background || null
  );

  const existingAnimeId = await findExistingAnimeIdByTvdb(tvdbId);

  const animePayload = {
    title,
    slug,
    total_episodes: null,
    image_url: primaryPoster,
    banner_image_url: primaryBanner,
    description: overview,
    format: "TV",
    status,
    season: null,
    season_year: year,
    start_date: startDate,
    end_date: toDateOnly(series?.lastAired ?? null),
    average_score: null,
    source: null,
    genres: genres.length ? genres : null,
    tvdb_id: tvdbId,
  };

  const selectCols = "id, title, slug, tvdb_id";

  const { data: upserted, error: upsertErr } = existingAnimeId
    ? await updateAnimeById(existingAnimeId, animePayload, selectCols)
    : await upsertAnimeBySlug(animePayload, selectCols);

  if (upsertErr || !upserted) {
    console.error("TVDB anime write error:", upsertErr);
    return res.status(500).json({
      error: `Failed to upsert anime (TVDB): ${upsertErr?.message || "unknown"}`,
    });
  }

  const animeId = mustId(upserted, "TVDB anime upsert");
  if (!animeId) return res.status(500).json({ error: "TVDB upsert returned no anime id" });

  // 3) series artworks -> anime_artwork
  try {
    const { data: artworks, error: awErr } = await getTvdbSeriesArtworks(tvdbId);
    if (awErr) console.error("TVDB series artworks error:", awErr);

    const list = (artworks as any)?.artworks ?? artworks ?? [];
    const arr: any[] = Array.isArray(list) ? list : [];

    const rows = arr
      .map((a, idx) => {
        const url = normalizeTvdbImageUrl(a?.image || a?.url || a?.thumbnail || null);
        if (!url) return null;

        return {
          anime_id: animeId,
          source: "tvdb",
          kind: tvdbArtworkKind(a),
          url,
          lang: a?.language ?? a?.lang ?? null,
          width: a?.width ?? null,
          height: a?.height ?? null,
          vote: a?.score ?? a?.rating ?? null,
          is_primary: idx === 0,
        };
      })
      .filter(Boolean);

    if (rows.length) {
      await supabaseAdmin.from("anime_artwork").upsert(rows as any[], {
        onConflict: "anime_id,source,kind,url",
      });
    }
  } catch (e) {
    console.error("TVDB series artwork insert error:", e);
  }

  // 4) seasons
  const { data: seasonsData, error: seasonsErr } = await getTvdbSeriesSeasons(tvdbId);
  if (seasonsErr) console.error("TVDB seasons error:", seasonsErr);

  const seasonsList: any[] = Array.isArray((seasonsData as any)?.seasons)
    ? (seasonsData as any).seasons
    : Array.isArray(seasonsData)
    ? (seasonsData as any)
    : [];

  const SEASON_TYPE_AIRED_ORDER = 1;

  let globalEpisodeCounter = 0;

  for (const s of seasonsList) {
    const tvdbSeasonId: number | null = typeof s?.id === "number" ? s.id : null;

    const seasonNumber: number | null =
      typeof s?.number === "number"
        ? s.number
        : typeof s?.seasonNumber === "number"
        ? s.seasonNumber
        : typeof s?.season_number === "number"
        ? s.season_number
        : null;

    if (seasonNumber === null) continue;

    let seasonTitle: string | null = s?.name ?? s?.title ?? null;
    let seasonOverview: string | null = s?.overview ?? null;
    let seasonAirDate: string | null = toDateOnly(s?.firstAired ?? s?.airDate ?? null);

    if (tvdbSeasonId) {
      const { data: seasonExt } = await getTvdbSeasonExtended(tvdbSeasonId);
      if (seasonExt) {
        seasonTitle = seasonTitle ?? seasonExt?.name ?? null;
        seasonOverview = seasonOverview ?? seasonExt?.overview ?? null;
        seasonAirDate = seasonAirDate ?? toDateOnly(seasonExt?.firstAired ?? null);
      }
    }

    const { data: seasonRow, error: seasonUpErr } = await supabaseAdmin
      .from("anime_seasons")
      .upsert(
        {
          anime_id: animeId,
          season_number: seasonNumber,
          title: seasonTitle,
          description: seasonOverview,
          air_date: seasonAirDate,
          tvdb_season_id: tvdbSeasonId,
        },
        { onConflict: "anime_id,season_number" }
      )
      .select("id")
      .single();

    if (seasonUpErr || !seasonRow) {
      console.error("TVDB season upsert error:", seasonUpErr);
      continue;
    }

    const animeSeasonId = mustId(seasonRow, "TVDB season upsert");
    if (!animeSeasonId) continue;

    if (tvdbSeasonId) {
      try {
        const { data: sArt } = await getTvdbSeasonArtworks(tvdbSeasonId);
        const list = (sArt as any)?.artworks ?? sArt ?? [];
        const arr: any[] = Array.isArray(list) ? list : [];

        const rows = arr
          .map((a, idx) => {
            const url = normalizeTvdbImageUrl(a?.image || a?.url || a?.thumbnail || null);
            if (!url) return null;

            return {
              anime_season_id: animeSeasonId,
              source: "tvdb",
              kind: tvdbArtworkKind(a),
              url,
              lang: a?.language ?? a?.lang ?? null,
              width: a?.width ?? null,
              height: a?.height ?? null,
              vote: a?.score ?? a?.rating ?? null,
              is_primary: idx === 0,
            };
          })
          .filter(Boolean);

        if (rows.length) {
          await supabaseAdmin.from("anime_season_artwork").upsert(rows as any[], {
            onConflict: "anime_season_id,source,kind,url",
          });
        }
      } catch (e) {
        console.error("TVDB season artwork insert error:", e);
      }
    }
  }

  // 5) episodes pages
  let page = 0;
  const maxPagesSafety = 200;

  while (page < maxPagesSafety) {
    const { data: pageData, error: epPageErr } = await getTvdbSeriesEpisodes(
      tvdbId,
      SEASON_TYPE_AIRED_ORDER,
      page
    );

    if (epPageErr) {
      console.error("TVDB episodes page error:", page, epPageErr);
      break;
    }

    const episodes: any[] = Array.isArray((pageData as any)?.episodes)
      ? (pageData as any).episodes
      : Array.isArray((pageData as any)?.data)
      ? (pageData as any).data
      : Array.isArray(pageData)
      ? (pageData as any)
      : [];

    if (!episodes.length) break;

    for (const ep of episodes) {
      const tvdbEpisodeId: number | null = typeof ep?.id === "number" ? ep.id : null;

      const seasonNumber: number | null =
        typeof ep?.seasonNumber === "number"
          ? ep.seasonNumber
          : typeof ep?.season_number === "number"
          ? ep.season_number
          : typeof ep?.season === "number"
          ? ep.season
          : null;

      const seasonEpisodeNumber: number | null =
        typeof ep?.number === "number"
          ? ep.number
          : typeof ep?.episodeNumber === "number"
          ? ep.episodeNumber
          : typeof ep?.episode_number === "number"
          ? ep.episode_number
          : null;

      globalEpisodeCounter += 1;

      let epTitle: string | null = ep?.name ?? ep?.title ?? null;
      let synopsis: string | null = ep?.overview ?? null;
      let airDate: string | null = toDateOnly(ep?.aired ?? ep?.airDate ?? ep?.firstAired ?? null);

      if (tvdbEpisodeId) {
        const { data: epExt } = await getTvdbEpisodeExtended(tvdbEpisodeId);
        if (epExt) {
          epTitle = epTitle ?? epExt?.name ?? epExt?.title ?? null;
          synopsis = synopsis ?? epExt?.overview ?? epExt?.description ?? null;
          airDate = airDate ?? toDateOnly(epExt?.aired ?? epExt?.firstAired ?? null);
        }
      }

      const { data: episodeRow, error: upErr } = await supabaseAdmin
        .from("anime_episodes")
        .upsert(
          {
            anime_id: animeId,
            episode_number: globalEpisodeCounter,
            season_number: seasonNumber,
            season_episode_number: seasonEpisodeNumber,
            title: epTitle,
            synopsis,
            air_date: airDate,
            tvdb_episode_id: tvdbEpisodeId,
          },
          { onConflict: "anime_id,episode_number" }
        )
        .select("id")
        .single();

      if (upErr || !episodeRow) {
        console.error("TVDB episode upsert error:", upErr);
        continue;
      }

      const animeEpisodeId = mustId(episodeRow, "TVDB episode upsert");
      if (!animeEpisodeId) continue;

      if (tvdbEpisodeId) {
        try {
          const { data: eArt } = await getTvdbEpisodeArtworks(tvdbEpisodeId);
          const list = (eArt as any)?.artworks ?? eArt ?? [];
          const arr: any[] = Array.isArray(list) ? list : [];

          const rows = arr
            .map((a, idx) => {
              const url = normalizeTvdbImageUrl(a?.image || a?.url || a?.thumbnail || null);
              if (!url) return null;

              return {
                anime_episode_id: animeEpisodeId,
                source: "tvdb",
                kind: tvdbArtworkKind(a),
                url,
                lang: a?.language ?? a?.lang ?? null,
                width: a?.width ?? null,
                height: a?.height ?? null,
                vote: a?.score ?? a?.rating ?? null,
                is_primary: idx === 0,
              };
            })
            .filter(Boolean);

          if (rows.length) {
            await supabaseAdmin.from("anime_episode_artwork").upsert(rows as any[], {
              onConflict: "anime_episode_id,source,kind,url",
            });
          }
        } catch (e) {
          console.error("TVDB episode artwork insert error:", e);
        }
      }
    }

    page += 1;
  }

  // 6) characters/cast -> anime_characters (YOUR schema)
  try {
    const { data: chars, error: charErr } = await getTvdbSeriesCharacters(tvdbId);
    if (charErr) console.error("TVDB characters error:", charErr);

    const list: any[] = Array.isArray((chars as any)?.characters)
      ? (chars as any).characters
      : Array.isArray(chars)
      ? (chars as any)
      : [];

    if (list.length) {
      // wipe old TVDB rows so reruns are clean
      await supabaseAdmin
        .from("anime_characters")
        .delete()
        .eq("anime_id", animeId)
        .eq("source", "tvdb");

      const rows = list
        .map((c, idx) => {
          const tvdbCharacterId: number | null = typeof c?.id === "number" ? c.id : null;

          const characterName: string | null =
            c?.name ?? c?.characterName ?? c?.character_name ?? null;

          const personName: string | null =
            c?.personName ?? c?.peopleName ?? c?.person_name ?? null;

          const characterImageUrl = normalizeTvdbImageUrl(
            c?.image ?? c?.image_url ?? c?.characterImage ?? null
          );

          const personImageUrl = normalizeTvdbImageUrl(
            c?.personImgURL ?? c?.person_image_url ?? c?.personImage ?? null
          );

          const role: string | null = c?.role ?? c?.type ?? null;

          const sortOrder: number =
            typeof c?.sortOrder === "number"
              ? c.sortOrder
              : typeof c?.sort_order === "number"
              ? c.sort_order
              : idx;

          if (!characterName && !personName) return null;

          return {
            anime_id: animeId,
            source: "tvdb",
            tvdb_character_id: tvdbCharacterId,
            character_name: characterName ?? personName ?? "Unknown",
            character_image_url: characterImageUrl ?? null,
            person_name: personName ?? null,
            person_image_url: personImageUrl ?? null,
            role,
            sort_order: sortOrder,
          };
        })
        .filter(Boolean);

      if (rows.length) {
        const { error: insErr } = await supabaseAdmin.from("anime_characters").insert(rows as any[]);
        if (insErr) console.error("TVDB characters insert error:", insErr);
      }
    }
  } catch (e) {
    console.error("TVDB character insert error:", e);
  }

  // 7) update total_episodes (best-effort)
  try {
    if (globalEpisodeCounter > 0) {
      await supabaseAdmin
        .from("anime")
        .update({ total_episodes: globalEpisodeCounter })
        .eq("id", animeId);
    }
  } catch (e) {
    console.error("TVDB total_episodes update error:", e);
  }

  return res.status(200).json({
    success: true,
    source: "tvdb",
    anime_id: animeId,
    tvdb_id: tvdbId,
    imported_episode_count: globalEpisodeCounter,
  });
}
