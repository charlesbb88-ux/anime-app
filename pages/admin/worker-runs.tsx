"use client";

import React, { useEffect, useMemo, useState } from "react";

type RunRow = {
  id: number;
  created_at: string;

  build_stamp: string;
  enqueue_window: number;
  unique_ids: number;
  enqueued_rows: number;
  bumped_pending: number;
  claimed: number;
  processed: number;

  ok_count: number;
  error_count: number;

  duration_ms: number;

  sample_results: any[] | null;
};

function fmtMs(ms: number) {
  if (!Number.isFinite(ms)) return String(ms);
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${m}m ${rem.toFixed(0)}s`;
}

function fmtAgo(iso: string) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const d = Date.now() - t;
  const s = Math.floor(d / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

async function fetchRuns(adminSecret: string, limit: number) {
  const r = await fetch(`/api/admin/worker-runs?limit=${encodeURIComponent(String(limit))}`, {
    method: "GET",
    headers: {
      "x-admin-secret": adminSecret,
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

  if (!r.ok) {
    throw new Error(payload?.error || `HTTP ${r.status}`);
  }

  return (payload?.runs || []) as RunRow[];
}

export default function WorkerRunsPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [limit, setLimit] = useState(60);
  const [refreshSeconds, setRefreshSeconds] = useState(10);

  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const canLoad = adminSecret.trim().length > 0;

  const totals = useMemo(() => {
    const t = {
      runs: runs.length,
      processed: 0,
      ok: 0,
      err: 0,
      bumped: 0,
    };
    for (const r of runs) {
      t.processed += Number(r.processed || 0);
      t.ok += Number(r.ok_count || 0);
      t.err += Number(r.error_count || 0);
      t.bumped += Number(r.bumped_pending || 0);
    }
    return t;
  }, [runs]);

  async function load() {
    if (!canLoad) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchRuns(adminSecret.trim(), limit);
      setRuns(data);
      setLastUpdatedAt(new Date().toISOString());
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // initial load once secret exists
    if (!canLoad) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoad, limit]);

  useEffect(() => {
    if (!canLoad) return;
    const sec = Math.max(3, Math.min(120, refreshSeconds));
    const t = setInterval(() => {
      load();
    }, sec * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoad, refreshSeconds, limit]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
        MangaDex Worker Feed
      </h1>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>x-admin-secret</label>
          <input
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            placeholder="paste ADMIN_SECRET"
            type="password"
            style={{
              width: 360,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.15)",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>Rows</label>
          <input
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value || 60))}
            type="number"
            min={10}
            max={200}
            style={{
              width: 120,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.15)",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>Refresh (sec)</label>
          <input
            value={refreshSeconds}
            onChange={(e) => setRefreshSeconds(Number(e.target.value || 10))}
            type="number"
            min={3}
            max={120}
            style={{
              width: 140,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.15)",
            }}
          />
        </div>

        <button
          onClick={load}
          disabled={!canLoad || loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.15)",
            background: loading ? "rgba(0,0,0,0.05)" : "white",
            fontWeight: 800,
            cursor: !canLoad || loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Loading..." : "Refresh now"}
        </button>

        <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.8 }}>
          {lastUpdatedAt ? `Last updated ${fmtAgo(lastUpdatedAt)}` : ""}
        </div>
      </div>

      {err ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(255,0,0,0.3)",
            background: "rgba(255,0,0,0.06)",
            fontWeight: 700,
          }}
        >
          Error: {err}
        </div>
      ) : null}

      <div
        style={{
          marginTop: 14,
          padding: 12,
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.12)",
          background: "rgba(0,0,0,0.03)",
          display: "flex",
          gap: 18,
          flexWrap: "wrap",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        <div>Runs: {totals.runs}</div>
        <div>Total processed: {totals.processed}</div>
        <div>Total ok: {totals.ok}</div>
        <div>Total errors: {totals.err}</div>
        <div>Total bumped: {totals.bumped}</div>
      </div>

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {runs.map((r) => {
          const ok = Number(r.ok_count || 0);
          const er = Number(r.error_count || 0);
          const badgeBg =
            er > 0 ? "rgba(255,0,0,0.08)" : ok > 0 ? "rgba(0,128,0,0.08)" : "rgba(0,0,0,0.06)";
          const badgeBorder =
            er > 0 ? "rgba(255,0,0,0.25)" : ok > 0 ? "rgba(0,128,0,0.25)" : "rgba(0,0,0,0.12)";

          return (
            <details
              key={r.id}
              style={{
                padding: 12,
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "white",
              }}
            >
              <summary style={{ cursor: "pointer", display: "flex", gap: 12, alignItems: "center" }}>
                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: `1px solid ${badgeBorder}`,
                    background: badgeBg,
                    fontWeight: 900,
                    fontSize: 12,
                    whiteSpace: "nowrap",
                  }}
                >
                  {er > 0 ? `ERRORS ${er}` : `OK ${ok}`}
                </div>

                <div style={{ fontWeight: 900, fontSize: 13 }}>
                  {fmtAgo(r.created_at)} • {new Date(r.created_at).toLocaleString()}
                </div>

                <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.8 }}>
                  {fmtMs(Number(r.duration_ms || 0))} • {r.build_stamp}
                </div>
              </summary>

              <div style={{ marginTop: 10, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
                <div><b>unique_ids</b>: {r.unique_ids}</div>
                <div><b>enqueued</b>: {r.enqueued_rows}</div>
                <div><b>bumped</b>: {r.bumped_pending}</div>
                <div><b>claimed</b>: {r.claimed}</div>
                <div><b>processed</b>: {r.processed}</div>
                <div><b>ok</b>: {r.ok_count}</div>
                <div><b>errors</b>: {r.error_count}</div>
              </div>

              {Array.isArray(r.sample_results) && r.sample_results.length > 0 ? (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75, marginBottom: 6 }}>
                    Sample results (first {r.sample_results.length})
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.12)",
                      background: "rgba(0,0,0,0.03)",
                      overflowX: "auto",
                      fontSize: 12,
                      lineHeight: 1.35,
                    }}
                  >
                    {JSON.stringify(r.sample_results, null, 2)}
                  </pre>
                </div>
              ) : (
                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                  No sample_results stored for this run.
                </div>
              )}
            </details>
          );
        })}
      </div>

      <div style={{ marginTop: 14, fontSize: 12, opacity: 0.75 }}>
        Tip: This page stores the secret only in memory (not saved). Refreshing the page will clear it.
      </div>
    </div>
  );
}
