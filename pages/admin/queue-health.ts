// pages/api/admin/queue-health.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUILD_STAMP = "queue-health-2026-01-24-01";

function requireAdmin(req: NextApiRequest) {
  const secret = req.headers["x-admin-secret"];
  if (!process.env.ADMIN_SECRET) throw new Error("ADMIN_SECRET not set");
  if (secret !== process.env.ADMIN_SECRET) throw new Error("Unauthorized");
}

function asInt(v: any, def: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    requireAdmin(req);

    const sample = Math.max(5, Math.min(100, asInt(req.query.sample, 25)));
    const stuckMinutes = Math.max(1, Math.min(1440, asInt(req.query.stuck_minutes, 30)));

    const now = new Date();
    const nowIso = now.toISOString();
    const stuckCutoffIso = new Date(now.getTime() - stuckMinutes * 60 * 1000).toISOString();

    // -------------
    // A) Status counts
    // -------------
    const { data: statusCounts, error: statusErr } = await supabaseAdmin
      .from("mangadex_update_queue")
      .select("status")
      .neq("status", null);

    if (statusErr) throw statusErr;

    const counts: Record<string, number> = {};
    for (const r of statusCounts || []) {
      const s = (r as any)?.status ?? "null";
      counts[s] = (counts[s] || 0) + 1;
    }

    // -------------
    // B) Backlog (feed newer than processed OR processed is null)
    // -------------
    // NOTE: Postgrest doesn't support column-vs-column comparisons easily,
    // so we approximate backlog as:
    // - has last_feed_updated_at
    // - and (last_processed_feed_updated_at is null OR status != done)
    //
    // This matches your current worker behavior: "done" rows should have processed_at.
    const { count: backlogCount, error: backlogErr } = await supabaseAdmin
      .from("mangadex_update_queue")
      .select("id", { count: "exact", head: true })
      .not("last_feed_updated_at", "is", null)
      .or("last_processed_feed_updated_at.is.null,status.neq.done");

    if (backlogErr) throw backlogErr;

    // -------------
    // C) Stuck locks (locked_until in the past but still status='processing')
    // -------------
    const { count: stuckLocks, error: stuckErr } = await supabaseAdmin
      .from("mangadex_update_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "processing")
      .not("locked_until", "is", null)
      .lt("locked_until", nowIso);

    if (stuckErr) throw stuckErr;

    // -------------
    // D) Error count (and recent errors)
    // -------------
    const { count: errorCount, error: errCountErr } = await supabaseAdmin
      .from("mangadex_update_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "error");

    if (errCountErr) throw errCountErr;

    const { data: recentErrors, error: recentErrsErr } = await supabaseAdmin
      .from("mangadex_update_queue")
      .select("id, mangadex_manga_id, last_error, updated_at, next_run_at")
      .eq("status", "error")
      .order("updated_at", { ascending: false })
      .limit(sample);

    if (recentErrsErr) throw recentErrsErr;

    // -------------
    // E) Recently processed (best signal that the worker is alive)
    // -------------
    const { data: recentDone, error: recentDoneErr } = await supabaseAdmin
      .from("mangadex_update_queue")
      .select("id, mangadex_manga_id, last_processed_feed_updated_at, updated_at, last_feed_updated_at")
      .eq("status", "done")
      .order("updated_at", { ascending: false })
      .limit(sample);

    if (recentDoneErr) throw recentDoneErr;

    // -------------
    // F) Old pending (pending that hasn't been touched in a while)
    // -------------
    const { data: oldPending, error: oldPendingErr } = await supabaseAdmin
      .from("mangadex_update_queue")
      .select("id, mangadex_manga_id, updated_at, next_run_at, last_feed_updated_at, last_processed_feed_updated_at")
      .eq("status", "pending")
      .lt("updated_at", stuckCutoffIso)
      .order("updated_at", { ascending: true })
      .limit(sample);

    if (oldPendingErr) throw oldPendingErr;

    return res.status(200).json({
      ok: true,
      build_stamp: BUILD_STAMP,
      now: nowIso,
      params: { sample, stuck_minutes: stuckMinutes },
      counts,
      backlog_approx: backlogCount ?? 0,
      stuck_processing_locks: stuckLocks ?? 0,
      error_count: errorCount ?? 0,
      recent_done: recentDone || [],
      recent_errors: recentErrors || [],
      old_pending: oldPending || [],
      tips: {
        healthy: [
          "recent_done should keep changing over time if the worker is running",
          "backlog_approx should go down when you run process-mangadex-activity repeatedly",
        ],
        if_backlog_grows: [
          "increase batch size (query param batch) or run the worker more frequently",
          "check recent_errors for repeated failures",
        ],
      },
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg === "Unauthorized") return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: msg });
  }
}
