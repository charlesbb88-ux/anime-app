// pages/api/admin/process-mangadex-activity.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUILD_STAMP = "processor-queue-2026-01-24-03";

function requireAdmin(req: NextApiRequest) {
  const secret = req.headers["x-admin-secret"];
  if (!process.env.ADMIN_SECRET) throw new Error("ADMIN_SECRET not set");
  if (secret !== process.env.ADMIN_SECRET) throw new Error("Unauthorized");
}

function getBaseUrl(req: NextApiRequest) {
  const envBase =
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_URL ||
    null;

  if (envBase) {
    const b = envBase.startsWith("http") ? envBase : `https://${envBase}`;
    return b.replace(/\/+$/, "");
  }

  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function asInt(v: any, def: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Step 2 — Make your worker write one summary row per run
  const t0 = Date.now();

  try {
    requireAdmin(req);
    const baseUrl = getBaseUrl(req);

    const enqueueWindow = Math.max(50, Math.min(500, asInt(req.query.window, 300)));
    const batchSize = Math.max(1, Math.min(50, asInt(req.query.batch, 15)));
    const lockSeconds = Math.max(30, Math.min(600, asInt(req.query.lock_seconds, 180)));

    const nowIso = new Date().toISOString();

    // -------------------------------------------------
    // A) ENQUEUE: collect recent feed activity
    // -------------------------------------------------
    const { data: rows, error } = await supabaseAdmin
      .from("mangadex_recent_chapters")
      .select("mangadex_manga_id, mangadex_updated_at")
      .order("mangadex_updated_at", { ascending: false })
      .limit(enqueueWindow);

    if (error) throw error;

    // compute newest timestamp per manga
    const newestByManga = new Map<string, string>();

    for (const r of rows || []) {
      const id = r?.mangadex_manga_id;
      const ts = r?.mangadex_updated_at;
      if (!id || !ts) continue;

      const prev = newestByManga.get(id);
      if (!prev || Date.parse(ts) > Date.parse(prev)) {
        newestByManga.set(id, ts);
      }
    }

    const enqueueRows = Array.from(newestByManga.entries()).map(([mdId, feedTs]) => ({
      mangadex_manga_id: mdId,
      last_seen_at: nowIso,
      next_run_at: nowIso,
      updated_at: nowIso,
      last_feed_updated_at: feedTs,
    }));

    let enqueuedRows = 0;

    if (enqueueRows.length > 0) {
      const { data: upData, error: upErr } = await supabaseAdmin
        .from("mangadex_update_queue")
        .upsert(enqueueRows, { onConflict: "mangadex_manga_id" })
        .select("mangadex_manga_id");

      if (upErr) throw upErr;
      enqueuedRows = upData?.length ?? enqueueRows.length;
    }

    // -------------------------------------------------
    // NEW: bump done → pending only if feed is newer
    // -------------------------------------------------
    const { data: bumped, error: bumpErr } =
      await supabaseAdmin.rpc("mdq_bump_pending_if_new_feed");

    if (bumpErr) throw bumpErr;

    // -------------------------------------------------
    // B) CLAIM
    // -------------------------------------------------
    const { data: claimed, error: claimErr } = await supabaseAdmin.rpc("mdq_claim_batch", {
      p_batch: batchSize,
      p_lock_seconds: lockSeconds,
    });

    if (claimErr) throw claimErr;

    const claimedRows = (claimed || []) as Array<{
      id: number;
      mangadex_manga_id: string;
    }>;

    // -------------------------------------------------
    // C) PROCESS
    // -------------------------------------------------
    const results: Array<{
      queue_id: number;
      mangadex_id: string;
      ok: boolean;
      status: number;
      response: any;
    }> = [];

    for (const item of claimedRows) {
      const mdId = item.mangadex_manga_id;

      const url =
        `${baseUrl}/api/admin/mangadex-delta-sync` +
        `?md_manga_id=${encodeURIComponent(mdId)}` +
        `&force=1` +
        `&mode=chapter` +
        `&state_id=activity_chapter_feed` +
        `&max_pages=1` +
        `&hard_cap=1`;

      try {
        const r = await fetch(url, {
          method: "GET",
          headers: {
            "x-admin-secret": process.env.ADMIN_SECRET!,
            accept: "application/json",
          },
        });

        const text = await r.text();
        let payload: any;
        try {
          payload = JSON.parse(text);
        } catch {
          payload = { raw: text?.slice(0, 1000) };
        }

        results.push({
          queue_id: item.id,
          mangadex_id: mdId,
          ok: r.ok,
          status: r.status,
          response: payload,
        });

        if (r.ok) {
          // fetch current last_feed_updated_at so we can mark it processed
          const { data: row, error: fetchErr } = await supabaseAdmin
            .from("mangadex_update_queue")
            .select("last_feed_updated_at")
            .eq("id", item.id)
            .single();

          if (fetchErr) throw fetchErr;

          const { error: doneErr } = await supabaseAdmin
            .from("mangadex_update_queue")
            .update({
              status: "done",
              locked_until: null,
              lock_token: null,
              last_error: null,
              last_processed_feed_updated_at: row?.last_feed_updated_at ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);

          if (doneErr) throw doneErr;
        } else {
          const retryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

          const { error: errErr } = await supabaseAdmin
            .from("mangadex_update_queue")
            .update({
              status: "error",
              next_run_at: retryAt,
              locked_until: null,
              lock_token: null,
              last_error: `HTTP ${r.status}`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);

          if (errErr) throw errErr;
        }
      } catch (e: any) {
        results.push({
          queue_id: item.id,
          mangadex_id: mdId,
          ok: false,
          status: 0,
          response: { error: e?.message || "fetch failed" },
        });

        const retryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

        const { error: errErr } = await supabaseAdmin
          .from("mangadex_update_queue")
          .update({
            status: "error",
            next_run_at: retryAt,
            locked_until: null,
            lock_token: null,
            last_error: e?.message || "fetch failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        if (errErr) throw errErr;
      }
    }

    // After processing finishes compute summary stats
    const okCount = results.filter((r) => r.ok).length;
    const errCount = results.length - okCount;
    const durationMs = Date.now() - t0;

    // store a small sample so the log isn't huge
    const sampleResults = results.slice(0, 20);

    // Insert the run row (breadcrumb)
    const { error: logErr } = await supabaseAdmin.from("mangadex_worker_runs").insert({
      build_stamp: BUILD_STAMP,
      enqueue_window: enqueueWindow,
      unique_ids: newestByManga.size,
      enqueued_rows: enqueuedRows,
      bumped_pending: Number(bumped ?? 0),
      claimed: claimedRows.length,
      processed: results.length,
      ok_count: okCount,
      error_count: errCount,
      duration_ms: durationMs,
      sample_results: sampleResults,
    });

    if (logErr) throw logErr;

    return res.status(200).json({
      ok: true,
      build_stamp: BUILD_STAMP,
      baseUrl,
      enqueue_window: enqueueWindow,
      unique_ids: newestByManga.size,
      enqueued_rows: enqueuedRows,
      bumped_pending: bumped ?? 0,
      claimed: claimedRows.length,
      processed: results.length,
      ok_count: okCount,
      error_count: errCount,
      duration_ms: durationMs,
      sample_results: sampleResults,
      results,
      note: "Queue now reprocesses only when feed is newer. No more dead queues.",
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg === "Unauthorized") return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: msg });
  }
}
