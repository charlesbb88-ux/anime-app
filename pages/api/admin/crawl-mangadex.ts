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
      // keep these for cursor/debug if present
      updatedAt: (m as any)?.attributes?.updatedAt ?? null,
      createdAt: (m as any)?.attributes?.createdAt ?? null,
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

function bumpCursorBy1SecondMangaDexFormat(input: string) {
  const t = Date.parse(input);
  if (!Number.isFinite(t)) return input;

  const d = new Date(t + 1000);

  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const mm = pad(d.getUTCMonth() + 1);
  const dd = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mi = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());

  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
}

type CrawlStateRow = {
  id: string;
  cursor_offset: number | null;
  page_limit: number | null;
  total: number | null;

  mode?: "offset" | "updatedat";
  cursor_updated_at?: string | null;
  cursor_last_id?: string | null;

  processed_count?: number | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    requireAdmin(req);

    const overrideLimit = req.query.limit ? Number(req.query.limit) : null;

    // 1) load crawl state
    const { data: state, error: stErr } = await supabaseAdmin
      .from("mangadex_crawl_state")
      .select(
        "id, cursor_offset, page_limit, total, mode, cursor_updated_at, cursor_last_id, processed_count"
      )
      .eq("id", "main")
      .maybeSingle<CrawlStateRow>();

    if (stErr) throw stErr;
    if (!state) throw new Error(`Missing mangadex_crawl_state row id="main"`);

    const limit = Math.max(1, Math.min(100, Number(overrideLimit ?? state.page_limit ?? 100)));

    const mode: "offset" | "updatedat" =
      state.mode === "updatedat" ? "updatedat" : "offset";

    const offset = Math.max(0, Number(state.cursor_offset ?? 0));
    const processedCount = Number(state.processed_count ?? 0);

    // ---- MODE A: offset pagination (only valid while offset+limit <= 10000) ----
    // MangaDex hard cap is offset+limit <= 10000.
    const WINDOW_CAP = 10000;

    if (mode === "offset" && offset + limit > WINDOW_CAP) {
      // We are about to exceed window cap. Switch modes WITHOUT restarting imports.
      //
      // Resume point should be: the "last updatedAt" we've ingested so far.
      // Since we don't have it stored yet, we start cursor mode from "now minus a long time"
      // ONLY if cursor_updated_at is missing. But for your case, we can switch at the boundary
      // by setting cursor_updated_at to a very old date so it will backfill from earliest updates.
      //
      // To avoid a full restart, we *prefer* to set cursor_updated_at based on the last item we just ingested
      // on the previous successful call. So: use existing cursor_updated_at if present, else set to 1970.
      const fallback = state.cursor_updated_at ?? "1970-01-01T00:00:00.000Z";

      const { error: upErr } = await supabaseAdmin
        .from("mangadex_crawl_state")
        .update({
          mode: "updatedat",
          cursor_offset: 0,
          cursor_updated_at: fallback,
          cursor_last_id: state.cursor_last_id ?? null,
          page_limit: limit,
          updated_at: new Date().toISOString(),
        })
        .eq("id", "main");

      if (upErr) throw upErr;

      return res.status(200).json({
        ok: true,
        switchedMode: true,
        message:
          "Hit MangaDex 10k window cap. Switched crawl state to updatedAt cursor mode. Call again to continue.",
        previousMode: "offset",
        newMode: "updatedat",
        limit,
        offset,
        windowCap: WINDOW_CAP,
        processedCount,
      });
    }

    // 2) fetch one page from MangaDex (Safe + Suggestive only)
    const contentRatings: Array<"safe" | "suggestive"> = ["safe", "suggestive"];

    const page =
      mode === "offset"
        ? await listMangaDexMangaPage({
            limit,
            offset,
            contentRatings,
          })
        : await listMangaDexMangaPage({
            limit,
            offset: 0, // IMPORTANT: we will not use deep offsets in cursor mode
            contentRatings,
            updatedAtSince: state.cursor_updated_at ?? "1970-01-01T00:00:00.000Z",
            orderUpdatedAt: "asc",
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

    // 4) compute next cursor
    let finished = false;

    // Next state fields
    let nextMode: "offset" | "updatedat" = mode;
    let nextOffset: number | null = null;
    let nextCursorUpdatedAt: string | null = state.cursor_updated_at ?? null;
    let nextCursorLastId: string | null = state.cursor_last_id ?? null;

    if (mode === "offset") {
      const rawNextOffset = offset + limit;
      finished = page.total > 0 && rawNextOffset >= page.total;

      nextOffset = finished ? null : rawNextOffset;

      // Optional: stash a resume point for the moment we later switch modes.
      // Use the last item's updatedAt if it exists.
      const last = (page.data || [])[Math.max(0, (page.data || []).length - 1)];
      const lastUpdatedAt = (last as any)?.attributes?.updatedAt ?? null;
      if (lastUpdatedAt) {
        nextCursorUpdatedAt = lastUpdatedAt;
        nextCursorLastId = (last as any)?.id ?? null;
      }
    } else {
      // Cursor mode: keep paging forward by updatedAt.
      // We never deep-page past 10k because we keep offset at 0 and advance the time cursor.
      const last = (page.data || [])[Math.max(0, (page.data || []).length - 1)];
      const lastUpdatedAt = (last as any)?.attributes?.updatedAt ?? null;
      const lastId = (last as any)?.id ?? null;

      if (lastUpdatedAt) {
        // bump by 1ms so the next call doesn't re-include the last record forever
        nextCursorUpdatedAt = bumpCursorBy1SecondMangaDexFormat(lastUpdatedAt);
        nextCursorLastId = lastId;
      }

      // In cursor mode, "finished" is only true when API returns fewer than limit.
      // Realistically, MangaDex is always changing, so this may never be permanently finished.
      finished = (page.data || []).length < limit;

      nextOffset = null; // not used in cursor mode
      nextMode = "updatedat";
    }

    const newProcessedCount = processedCount + ingested.length;

    // 5) update state
    const { error: upErr } = await supabaseAdmin
      .from("mangadex_crawl_state")
      .update({
        mode: nextMode,
        cursor_offset: nextMode === "offset" ? (finished ? 0 : nextOffset ?? 0) : 0,
        page_limit: limit,
        total: page.total ?? null,
        cursor_updated_at: nextCursorUpdatedAt,
        cursor_last_id: nextCursorLastId,
        processed_count: newProcessedCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "main");

    if (upErr) throw upErr;

    return res.status(200).json({
      ok: true,
      contentRatings,
      mode: nextMode,

      // progress
      processedCount: newProcessedCount,

      // offset mode fields
      limit,
      offset: mode === "offset" ? offset : null,
      total: page.total ?? null,
      nextOffset: mode === "offset" && !finished ? nextOffset : null,

      // cursor mode fields
      cursorUpdatedAt: nextMode === "updatedat" ? nextCursorUpdatedAt : null,
      cursorLastId: nextMode === "updatedat" ? nextCursorLastId : null,

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
