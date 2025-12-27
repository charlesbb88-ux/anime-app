import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { slugify } from "@/lib/slugify";
import {
  listMangaDexMangaPage,
  normalizeMangaDexTitle,
  normalizeMangaDexDescription,
  normalizeStatus,
  splitTags,
  getCreators,
  getMangaDexCoverCandidates,
  type MangaDexManga,
} from "@/lib/mangadex";

function requireAdmin(req: NextApiRequest) {
  const secret = req.headers["x-admin-secret"];
  if (!process.env.ADMIN_SECRET) throw new Error("ADMIN_SECRET not set");
  if (secret !== process.env.ADMIN_SECRET) throw new Error("Unauthorized");
}

async function ingestOneFromMangaDexObject(m: MangaDexManga) {
  const mangadexId = m.id;

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

      // ⚠️ only include this param if your RPC was updated to accept it
      // If you haven't updated the DB function yet, COMMENT THIS OUT.
      p_publication_year: publicationYear,

      p_snapshot: {
        mangadex_id: mangadexId,

        // KEEP SNAPSHOT SMALLER (recommended):
        // store only attributes + the cover/creator rels, not huge relationship trees.
        attributes: m.attributes,
        relationships: (m.relationships || [])
          .filter((r) => r.type === "author" || r.type === "artist" || r.type === "cover_art")
          .map((r) => ({
            id: r.id,
            type: r.type,
            attributes: r.attributes || null,
          })),

        normalized: {
          ...titles,
          status,
          genres,
          themes,
          coverUrl,
          authors,
          artists,
          publicationYear,
        },
      },
    }
  );

  if (error) throw error;

  // enqueue art job (idempotent)
  const { error: jobErr } = await supabaseAdmin.from("manga_art_jobs").upsert(
    {
      manga_id: mangaId,
      status: "pending",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "manga_id" }
  );

  if (jobErr) throw jobErr;

  return { manga_id: mangaId, slug, title: titles.title };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    requireAdmin(req);

    const runLimit = Math.max(1, Math.min(200, Number(req.query.limit || 50))); // how many manga to ingest this call
    const pageLimit = Math.max(25, Math.min(100, Number(req.query.page_limit || 100))); // MangaDex page size

    // 1) read crawl state
    const { data: state, error: stErr } = await supabaseAdmin
      .from("mangadex_crawl_state")
      .select("id, cursor_offset, page_limit, total")
      .eq("id", "main")
      .maybeSingle();

    if (stErr) throw stErr;

    const cursorOffset = Number(state?.cursor_offset || 0);
    const effectivePageLimit = Number(state?.page_limit || pageLimit);

    // 2) fetch page from MangaDex
    const page = await listMangaDexMangaPage(effectivePageLimit, cursorOffset);

    // 3) ingest up to runLimit from this page
    const ingested: any[] = [];
    const errors: any[] = [];

    for (const m of (page.data || []).slice(0, runLimit)) {
      try {
        const out = await ingestOneFromMangaDexObject(m);
        ingested.push(out);
      } catch (e: any) {
        errors.push({ id: m.id, error: String(e?.message || e) });
      }
    }

    // 4) advance cursor (move by page size, not by ingested count)
    let nextOffset = cursorOffset + page.limit;

    // If we know total and we reached/passed the end, wrap back to 0
    const total = Number(page.total || 0);
    if (total > 0 && nextOffset >= total) nextOffset = 0;

    const { error: upErr } = await supabaseAdmin
      .from("mangadex_crawl_state")
      .update({
        cursor_offset: nextOffset,
        total: total || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "main");

    if (upErr) throw upErr;

    return res.status(200).json({
      ok: true,
      page: { offset: page.offset, limit: page.limit, total: page.total },
      run: { requested: runLimit, ingested: ingested.length, errors: errors.length },
      nextOffset,
      ingested,
      errors,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
