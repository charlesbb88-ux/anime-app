import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { searchMangaDexByTitle } from "@/lib/mangadex";
import { slugify } from "@/lib/slugify";
import {
  getCreators,
  getMangaDexCoverCandidates,
  getMangaDexMangaById,
  normalizeMangaDexDescription,
  normalizeMangaDexTitle,
  splitTags,
  normalizeStatus,
} from "@/lib/mangadex";

function requireAdmin(req: NextApiRequest) {
  const secret = req.headers["x-admin-secret"];
  if (!process.env.ADMIN_SECRET) throw new Error("ADMIN_SECRET not set");
  if (secret !== process.env.ADMIN_SECRET) throw new Error("Unauthorized");
}

/**
 * Reuse your existing ingest logic for ONE MangaDex id.
 * This keeps everything consistent (snapshots, covers, job queue, etc.)
 */
async function ingestOneMangaDexId(mangadexId: string) {
  const m = await getMangaDexMangaById(mangadexId);

  const publicationYear = m.attributes?.year ?? null;

  const titles = normalizeMangaDexTitle(m);
  const description = normalizeMangaDexDescription(m);
  const status = normalizeStatus(m);
  const { genres, themes } = splitTags(m);

  const coverCandidates = getMangaDexCoverCandidates(m);
  const coverUrl = coverCandidates[0] || null;

  const { authors, artists } = getCreators(m);

  const mergedGenres = Array.from(new Set([...genres, ...themes])).sort((a, b) =>
    a.localeCompare(b)
  );

  const base =
    titles.title_preferred ||
    titles.title_english ||
    titles.title ||
    `mangadex-${mangadexId}`;
  const slug = slugify(base);

  const { data: mangaId, error } = await supabaseAdmin.rpc(
    "upsert_manga_from_mangadex",
    {
      p_slug: slug,
      p_title: titles.title,
      p_title_english: titles.title_english,
      p_title_native: titles.title_native,
      p_title_preferred: titles.title_preferred,
      p_description: description,
      p_status: status,
      p_format: null,
      p_source: "mangadex",
      p_genres: mergedGenres,
      p_total_chapters: null,
      p_total_volumes: null,
      p_cover_image_url: coverUrl,
      p_external_id: mangadexId,
      p_publication_year: publicationYear,
      p_snapshot: {
        mangadex_id: mangadexId,
        attributes: m.attributes,
        relationships: m.relationships,
        normalized: {
          ...titles,
          status,
          genres,
          themes,
          coverUrl,
          coverCandidates,
          authors,
          artists,
        },
      },
    }
  );

  if (error) throw error;

  // ✅ enqueue art job (idempotent)
  const { error: jobErr } = await supabaseAdmin.from("manga_art_jobs").upsert(
    {
      manga_id: mangaId,
      status: "pending",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "manga_id" }
  );

  if (jobErr) throw jobErr;

  return { manga_id: mangaId, slug, title: titles.title, coverUrl };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    requireAdmin(req);

    /**
     * Example:
     * /api/admin/bulk-ingest-mangadex?query=romance&limit=10&offset=0
     */
    const query = String(req.query.query || "").trim();
    if (!query) return res.status(400).json({ error: "Missing query" });

    const limit = Math.max(1, Math.min(25, Number(req.query.limit || 10)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    // ✅ IMPORTANT: pass offset into the search helper
    const results = await searchMangaDexByTitle(query, limit, offset);

    const ingested: any[] = [];
    const errors: any[] = [];

    for (const r of results) {
      try {
        const out = await ingestOneMangaDexId(r.id);
        ingested.push(out);
      } catch (e: any) {
        errors.push({ id: r.id, error: String(e?.message || e) });
      }
    }

    // ✅ if we got a full page, assume there might be more
    const nextOffset = results.length < limit ? null : offset + limit;

    return res.status(200).json({
      ok: true,
      query,
      requested: limit,
      offset,
      found: results.length,
      nextOffset,
      ingestedCount: ingested.length,
      errorCount: errors.length,
      ingested,
      errors,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
