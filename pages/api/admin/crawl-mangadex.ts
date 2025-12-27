// pages/api/admin/crawl-mangadex.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { slugify } from "@/lib/slugify";
import {
  listMangaDexMangaPage,
  normalizeMangaDexDescription,
  normalizeMangaDexTitle,
  splitTags,
  normalizeStatus,
  getMangaDexCoverCandidates,
  type MangaDexManga,
} from "@/lib/mangadex";

function requireAdmin(req: NextApiRequest) {
  const secret = req.headers["x-admin-secret"];
  if (!process.env.ADMIN_SECRET) throw new Error("ADMIN_SECRET not set");
  if (secret !== process.env.ADMIN_SECRET) throw new Error("Unauthorized");
}

// ✅ keep snapshots small (no giant relationships/biographies/etc)
function slimSnapshot(m: MangaDexManga) {
  const tags = (m.attributes?.tags || []).map((t) => ({
    id: t.id,
    group: t.attributes?.group || null,
    name: t.attributes?.name || {},
  }));

  return {
    mangadex_id: m.id,
    attributes: {
      title: m.attributes?.title || {},
      altTitles: m.attributes?.altTitles || [],
      description: m.attributes?.description || {},
      status: m.attributes?.status || null,
      year: m.attributes?.year ?? null,
      originalLanguage: m.attributes?.originalLanguage || null,
      publicationDemographic: m.attributes?.publicationDemographic || null,
      tags,
    },
  };
}

async function ingestOneFromList(m: MangaDexManga) {
  const titles = normalizeMangaDexTitle(m);
  const description = normalizeMangaDexDescription(m);
  const status = normalizeStatus(m);
  const publicationYear = m.attributes?.year ?? null;

  const { genres, themes } = splitTags(m);
  const mergedGenres = Array.from(new Set([...genres, ...themes])).sort((a, b) =>
    a.localeCompare(b)
  );

  const base =
    titles.title_preferred || titles.title_english || titles.title || `mangadex-${m.id}`;
  const slug = slugify(base);

  // We can set a temporary cover URL (cheap). Art-jobs will later cache all covers + pick earliest vol.
  const coverCandidates = getMangaDexCoverCandidates(m);
  const coverUrl = coverCandidates[0] || null;

  const { data: mangaId, error } = await supabaseAdmin.rpc("upsert_manga_from_mangadex", {
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
    p_external_id: m.id,
    p_publication_year: publicationYear,
    p_snapshot: {
      ...slimSnapshot(m),
      normalized: {
        ...titles,
        status,
        genres,
        themes,
        coverUrl,
      },
    },
  });

  if (error) throw error;

  // ✅ enqueue art job (idempotent)
  const { error: jobErr } = await supabaseAdmin
    .from("manga_art_jobs")
    .upsert(
      { manga_id: mangaId, status: "pending", updated_at: new Date().toISOString() },
      { onConflict: "manga_id" }
    );

  if (jobErr) throw jobErr;

  return { manga_id: mangaId, slug, title: titles.title };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    requireAdmin(req);

    // You can override these per-call if you want:
    const overrideLimit = req.query.limit ? Number(req.query.limit) : null;

    // 1) load crawl state
    const { data: state, error: stErr } = await supabaseAdmin
      .from("mangadex_crawl_state")
      .select("id, cursor_offset, page_limit, total")
      .eq("id", "main")
      .maybeSingle();

    if (stErr) throw stErr;
    if (!state) throw new Error(`Missing mangadex_crawl_state row id="main"`);

    const limit = Math.max(1, Math.min(100, Number(overrideLimit ?? state.page_limit ?? 100)));
    const offset = Math.max(0, Number(state.cursor_offset ?? 0));

    // 2) fetch one page from MangaDex (Safe + Suggestive only)
    const page = await listMangaDexMangaPage({
      limit,
      offset,
      contentRatings: ["safe", "suggestive"],
    });

    // 3) ingest + enqueue jobs
    const ingested: any[] = [];
    const errors: any[] = [];

    for (const m of page.data || []) {
      try {
        const out = await ingestOneFromList(m);
        ingested.push(out);
      } catch (e: any) {
        errors.push({ id: (m as any)?.id, error: String(e?.message || e) });
      }
    }

    // 4) update cursor
    const nextOffset = offset + limit;
    const finished = page.total > 0 && nextOffset >= page.total;

    const { error: upErr } = await supabaseAdmin
      .from("mangadex_crawl_state")
      .update({
        cursor_offset: finished ? 0 : nextOffset,
        page_limit: limit,
        total: page.total,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "main");

    if (upErr) throw upErr;

    return res.status(200).json({
      ok: true,
      contentRatings: ["safe", "suggestive"],
      limit,
      offset,
      total: page.total,
      nextOffset: finished ? null : nextOffset,
      finished,
      ingestedCount: ingested.length,
      errorCount: errors.length,
      ingested,
      errors,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
