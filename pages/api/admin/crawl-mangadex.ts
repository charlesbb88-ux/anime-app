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
    titles.title_preferred ||
    titles.title_english ||
    titles.title ||
    `mangadex-${m.id}`;
  const slug = slugify(base);

  // Temporary cover URL (cheap). Art-jobs will later cache all covers.
  const coverCandidates = getMangaDexCoverCandidates(m);
  const coverUrl = coverCandidates[0] || null;

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
    }
  );

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

function bumpIsoBy1ms(input: string) {
  const t = Date.parse(input);
  if (!Number.isFinite(t)) return input;
  return new Date(t + 1).toISOString();
}

type CrawlStateRow = {
  id: string;
  cursor_offset: number | null; // offset-mode OR updatedAt-bucket offset
  page_limit: number | null;
  total: number | null;

  mode?: "offset" | "updatedat";
  cursor_updated_at?: string | null;
  cursor_last_id?: string | null;

  processed_count?: number | null;
};

function clampInt(n: number, min: number, max: number) {
  const x = Number.isFinite(n) ? Math.trunc(n) : min;
  return Math.max(min, Math.min(max, x));
}

function msToEta(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return `${m}m ${r}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    requireAdmin(req);

    // ==========================
    // ✅ PROGRESS OUTPUT OPTIONS
    // ==========================
    // 1) JSON progress: always included in final response (counts, batch index, items/sec, etc.)
    // 2) Optional "heartbeat" writes: if client supports streaming, we can flush progress lines.
    //
    // In practice: PowerShell Invoke-RestMethod does NOT reliably show streaming chunks.
    // So the most useful "not frozen" solution is:
    // - keep each request bounded (maxMs)
    // - return rich progress stats each call
    //
    // If you want real-time progress in the terminal, use curl (it will show streamed chunks).
    // (still safe to keep this endpoint returning normal JSON at the end)

    // ---- tuning knobs ----
    const overrideLimit = req.query.limit ? Number(req.query.limit) : null;
    const maxBatches = req.query.maxBatches ? Number(req.query.maxBatches) : 1;
    const maxMs = req.query.maxMs ? Number(req.query.maxMs) : 45000;

    // Optional: heartbeat=1 enables streamed progress (best with curl)
    const heartbeat = req.query.heartbeat === "1" || req.query.heartbeat === "true";

    const batches = clampInt(maxBatches, 1, 200);
    const timeBudgetMs = clampInt(maxMs, 1000, 120000);

    // streaming setup (safe no-op if it doesn't stream in your client)
    const canStream = heartbeat && typeof (res as any).write === "function";
    if (canStream) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      // NOTE: we will write NDJSON-ish progress lines, then finish with a final JSON object.
      // Many clients accept this; if you prefer strict JSON only, keep heartbeat off.
    }

    const startedAt = Date.now();
    const startedIso = new Date(startedAt).toISOString();

    const writeBeat = (obj: any) => {
      if (!canStream) return;
      try {
        (res as any).write(JSON.stringify({ heartbeat: true, at: new Date().toISOString(), ...obj }) + "\n");
      } catch {}
    };

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

    const limit = clampInt(Number(overrideLimit ?? state.page_limit ?? 100), 1, 100);

    // NOTE:
    // - offset mode: cursor_offset is global offset (subject to 10k window cap)
    // - updatedAt mode: cursor_offset is bucket offset within current updatedAtSince
    let mode: "offset" | "updatedat" =
      state.mode === "updatedat" ? "updatedat" : "offset";

    let cursorOffset = Math.max(0, Number(state.cursor_offset ?? 0));
    let cursorUpdatedAt = state.cursor_updated_at ?? "1970-01-01T00:00:00.000Z";
    let cursorLastId = state.cursor_last_id ?? null;

    const startingProcessed = Number(state.processed_count ?? 0);

    const WINDOW_CAP = 10000;
    const contentRatings: Array<"safe" | "suggestive"> = ["safe", "suggestive"];

    // totals across batches
    let totalIngested = 0;
    let totalErrors = 0;

    // keep a small sample for response
    const ingestedSample: any[] = [];
    const errorsSample: any[] = [];

    // last seen API total (only meaningful in offset mode)
    let lastTotal: number | null = state.total ?? null;

    // progress metrics
    let pagesFetched = 0;
    let lastBeatAt = Date.now();
    writeBeat({
      phase: "start",
      mode,
      limit,
      batchesRequested: batches,
      timeBudgetMs,
      cursorOffset,
      cursorUpdatedAt: mode === "updatedat" ? cursorUpdatedAt : null,
      processedCountStart: startingProcessed,
    });

    // 2) run multiple pages per request
    for (let i = 0; i < batches; i++) {
      const elapsed = Date.now() - startedAt;
      if (elapsed > timeBudgetMs) {
        writeBeat({ phase: "stop", reason: "timeBudgetExceeded", elapsedMs: elapsed, batchIndex: i });
        break;
      }

      // ---- OFFSET MODE CAP HANDLING ----
      if (mode === "offset" && cursorOffset + limit > WINDOW_CAP) {
        cursorUpdatedAt = cursorUpdatedAt || "1970-01-01T00:00:00.000Z";
        mode = "updatedat";
        cursorOffset = 0;

        writeBeat({
          phase: "switchMode",
          newMode: "updatedat",
          reason: "windowCap",
          cursorUpdatedAt,
          cursorOffset,
        });
      }

      writeBeat({
        phase: "fetch",
        batchIndex: i + 1,
        batchesRequested: batches,
        mode,
        offset: mode === "offset" ? cursorOffset : null,
        bucketOffset: mode === "updatedat" ? cursorOffset : null,
        updatedAtSince: mode === "updatedat" ? cursorUpdatedAt : null,
      });

      // 3) fetch one page
      const page =
        mode === "offset"
          ? await listMangaDexMangaPage({
              limit,
              offset: cursorOffset,
              contentRatings,
            })
          : await listMangaDexMangaPage({
              limit,
              offset: cursorOffset, // ✅ bucket offset
              contentRatings,
              updatedAtSince: cursorUpdatedAt,
              orderUpdatedAt: "asc",
            });

      pagesFetched++;

      lastTotal = Number.isFinite(Number(page.total)) ? Number(page.total) : lastTotal;

      const data = page.data || [];

      // 4) ingest
      for (const m of data) {
        try {
          const out = await ingestOneFromList(m);
          totalIngested++;

          ingestedSample.push(out);
          if (ingestedSample.length > 50) ingestedSample.shift();
        } catch (e: any) {
          totalErrors++;

          const errRow = { id: (m as any)?.id, error: String(e?.message || e) };
          errorsSample.push(errRow);
          if (errorsSample.length > 50) errorsSample.shift();
        }
      }

      // periodic beat (at most ~1/sec) so streaming clients see movement
      const now = Date.now();
      if (now - lastBeatAt >= 900) {
        const elapsedMs = now - startedAt;
        const items = totalIngested + totalErrors;
        const ips = elapsedMs > 0 ? items / (elapsedMs / 1000) : null;

        // offset-mode percent only makes sense if total is known
        const offsetProgressPct =
          mode === "offset" && lastTotal && lastTotal > 0
            ? Math.min(1, (cursorOffset + limit) / lastTotal)
            : null;

        writeBeat({
          phase: "progress",
          pagesFetched,
          ingested: totalIngested,
          errors: totalErrors,
          itemsPerSec: ips ? Number(ips.toFixed(2)) : null,
          elapsedMs,
          offsetProgressPct:
            offsetProgressPct != null ? Math.round(offsetProgressPct * 1000) / 10 : null,
        });

        lastBeatAt = now;
      }

      // 5) advance cursor (NO SKIPS)
      if (mode === "offset") {
        const rawNextOffset = cursorOffset + limit;
        const finished =
          Number(page.total || 0) > 0 && rawNextOffset >= Number(page.total || 0);

        const last = data[data.length - 1];
        const lastUpdatedAt = (last as any)?.attributes?.updatedAt ?? null;
        if (lastUpdatedAt) {
          cursorUpdatedAt = lastUpdatedAt; // stash resume point
          cursorLastId = (last as any)?.id ?? cursorLastId;
        }

        if (finished) {
          cursorOffset = 0;
          writeBeat({ phase: "doneOffsetMode", reason: "finishedTotal", rawNextOffset, total: page.total });
          break;
        } else {
          cursorOffset = rawNextOffset;
        }
      } else {
        const last = data[data.length - 1];
        const lastUpdatedAt: string | null = (last as any)?.attributes?.updatedAt ?? null;
        const lastId: string | null = (last as any)?.id ?? null;

        cursorLastId = lastId ?? cursorLastId;

        if (!lastUpdatedAt) {
          cursorOffset = 0;
          writeBeat({ phase: "doneUpdatedAtMode", reason: "noDataReturned" });
          break;
        }

        const curT = Date.parse(cursorUpdatedAt);
        const lastT = Date.parse(lastUpdatedAt);
        const sameBucket = Number.isFinite(curT) && Number.isFinite(lastT) && curT === lastT;

        if (sameBucket) {
          if (data.length < limit) {
            cursorUpdatedAt = bumpIsoBy1ms(lastUpdatedAt);
            cursorOffset = 0;
          } else {
            cursorOffset = cursorOffset + limit;
          }
        } else {
          cursorUpdatedAt = bumpIsoBy1ms(lastUpdatedAt);
          cursorOffset = 0;
        }

        if (data.length < limit) {
          writeBeat({ phase: "doneUpdatedAtMode", reason: "shortPage", returned: data.length, limit });
          break;
        }
      }
    }

    const finishedAt = Date.now();
    const elapsedMs = finishedAt - startedAt;

    const newProcessedCount = startingProcessed + totalIngested;
    const items = totalIngested + totalErrors;
    const itemsPerSec = elapsedMs > 0 ? items / (elapsedMs / 1000) : null;

    // rough ETA for OFFSET MODE only (because total is finite there)
    let offsetPct: number | null = null;
    let offsetEta: string | null = null;

    if (mode === "offset" && lastTotal && lastTotal > 0) {
      offsetPct = Math.min(1, cursorOffset / lastTotal);
      if (itemsPerSec && itemsPerSec > 0) {
        const remaining = Math.max(0, lastTotal - cursorOffset);
        const etaMs = (remaining / itemsPerSec) * 1000;
        offsetEta = msToEta(etaMs);
      }
    }

    // 6) update state once
    const { error: upErr } = await supabaseAdmin
      .from("mangadex_crawl_state")
      .update({
        mode,
        cursor_offset: cursorOffset,
        page_limit: limit,
        total: lastTotal,
        cursor_updated_at: cursorUpdatedAt, // keep stashed value even in offset mode
        cursor_last_id: cursorLastId,
        processed_count: newProcessedCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "main");

    if (upErr) throw upErr;

    // final response (always)
    const finalPayload = {
      ok: true,
      startedAt: startedIso,
      finishedAt: new Date(finishedAt).toISOString(),
      elapsedMs,

      // “not frozen” proof
      pagesFetched,
      ingestedCount: totalIngested,
      errorCount: totalErrors,
      itemsPerSec: itemsPerSec ? Number(itemsPerSec.toFixed(2)) : null,

      // state
      contentRatings,
      mode,
      limit,
      cursorOffset,
      cursorUpdatedAt: mode === "updatedat" ? cursorUpdatedAt : null,
      cursorLastId: mode === "updatedat" ? cursorLastId : null,

      // progress
      processedCount: newProcessedCount,
      total: lastTotal,

      // only meaningful in offset mode
      offsetProgressPct: offsetPct != null ? Math.round(offsetPct * 1000) / 10 : null,
      offsetEta,

      // samples
      ingestedSample,
      errorsSample,
    };

    if (canStream) {
      // close out the stream with one final non-heartbeat payload line
      try {
        (res as any).write(JSON.stringify({ heartbeat: false, ...finalPayload }) + "\n");
      } catch {}
      return res.status(200).end();
    }

    return res.status(200).json(finalPayload);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
