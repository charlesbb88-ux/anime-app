"use client";

import React, { useMemo, useState } from "react";

type BatchResponse =
  | {
      ok: true;
      done: boolean;
      processedAnime: number;
      nextCursor: string | null;
      totals: {
        mappedEpisodes: number;
        updatedEpisodeDetails: number;
        insertedEpisodeStills: number;
      };
      perAnime: Array<{
        animeId: string;
        anilistId: number | null;
        tmdbId: number | null;
        title: string | null;
        ok: boolean;
        mappedEpisodes?: number;
        mappingSkippedReason?: string | null;
        mappingLocalUnmappedCount?: number;
        mappingTmdbFlatCount?: number;
        mappingPartiallyMapped?: boolean;
        updatedEpisodeDetails?: number;
        detailsSkippedUnmappable?: number;
        insertedEpisodeStills?: number;
        stillsSkippedUnmappable?: number;
        error?: string;
        ms?: number;
      }>;
    }
  | {
      ok: false;
      error?: string;
      raw?: string;
    };

type RunLog = {
  index: number;
  response: BatchResponse;
};

function fmtMs(ms: unknown) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return String(ms ?? "");
  if (n < 1000) return `${n}ms`;
  const s = n / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${m}m ${rem.toFixed(0)}s`;
}

async function runBatch(
  adminSecret: string,
  limit: number,
  cursor: string | null
): Promise<BatchResponse> {
  const r = await fetch("/api/admin/import-tmdb-episode-metadata-batch", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-admin-secret": adminSecret,
      accept: "application/json",
    },
    body: JSON.stringify({
      limit,
      cursor,
    }),
  });

  const text = await r.text();

  let payload: BatchResponse | { raw: string };
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text?.slice(0, 4000) };
  }

  if (!r.ok) {
    throw new Error((payload as any)?.error || (payload as any)?.raw || `HTTP ${r.status}`);
  }

  return payload as BatchResponse;
}

export default function ImportTmdbEpisodeMetadataBatchPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [limit, setLimit] = useState(10);
  const [cursor, setCursor] = useState<string>("");
  const [autoLoop, setAutoLoop] = useState(true);
  const [maxBatches, setMaxBatches] = useState(25);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [lastCursor, setLastCursor] = useState<string | null>(null);

  const totals = useMemo(() => {
    let processedAnime = 0;
    let mappedEpisodes = 0;
    let updatedEpisodeDetails = 0;
    let insertedEpisodeStills = 0;
    let okAnime = 0;
    let failedAnime = 0;

    for (const log of logs) {
      if (!("ok" in log.response) || log.response.ok !== true) continue;
      processedAnime += log.response.processedAnime || 0;
      mappedEpisodes += log.response.totals?.mappedEpisodes || 0;
      updatedEpisodeDetails += log.response.totals?.updatedEpisodeDetails || 0;
      insertedEpisodeStills += log.response.totals?.insertedEpisodeStills || 0;

      for (const item of log.response.perAnime || []) {
        if (item.ok) okAnime += 1;
        else failedAnime += 1;
      }
    }

    return {
      processedAnime,
      mappedEpisodes,
      updatedEpisodeDetails,
      insertedEpisodeStills,
      okAnime,
      failedAnime,
    };
  }, [logs]);

  const trimmedSecret = adminSecret.trim();
  const parsedLimit = Math.max(1, Math.min(50, Number(limit || 10)));
  const parsedMaxBatches = Math.max(1, Math.min(500, Number(maxBatches || 25)));
  const canRun = trimmedSecret.length > 0 && !running;

  async function runOnce() {
    if (!canRun) return;

    setRunning(true);
    setError(null);

    try {
      const response = await runBatch(
        trimmedSecret,
        parsedLimit,
        cursor.trim() === "" ? null : cursor.trim()
      );

      setLogs((prev) => [...prev, { index: prev.length + 1, response }]);

      if ("ok" in response && response.ok === true) {
        setLastCursor(response.nextCursor ?? null);
        setCursor(response.nextCursor ?? "");
      }
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setRunning(false);
    }
  }

  async function runLoop() {
    if (!canRun) return;

    setRunning(true);
    setError(null);

    let currentCursor = cursor.trim() === "" ? null : cursor.trim();
    const newLogs: RunLog[] = [];

    try {
      for (let i = 0; i < parsedMaxBatches; i++) {
        const response = await runBatch(trimmedSecret, parsedLimit, currentCursor);
        newLogs.push({ index: logs.length + newLogs.length + 1, response });

        if (!("ok" in response) || response.ok !== true) {
          break;
        }

        currentCursor = response.nextCursor ?? null;
        setLastCursor(currentCursor);
        setCursor(currentCursor ?? "");

        if (response.done) {
          break;
        }
      }

      if (newLogs.length > 0) {
        setLogs((prev) => [...prev, ...newLogs]);
      }
    } catch (err: any) {
      setError(String(err?.message || err));
      if (newLogs.length > 0) {
        setLogs((prev) => [...prev, ...newLogs]);
      }
    } finally {
      setRunning(false);
    }
  }

  function clearRuns() {
    setLogs([]);
    setError(null);
    setLastCursor(null);
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
        TMDB Episode Metadata Batch Import
      </h1>

      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 14 }}>
        This batch job scans anime rows that have both anilist_id and tmdb_id, then
        conservatively imports episode mapping, missing titles, missing synopsis, missing
        air dates, and missing episode stills.
      </div>

      <div
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 14,
          padding: 12,
          background: "white",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              x-admin-secret / ADMIN_SECRET
            </label>
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
            <label style={{ fontSize: 12, fontWeight: 700 }}>Batch size</label>
            <input
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value || 10))}
              type="number"
              min={1}
              max={50}
              style={{
                width: 120,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.15)",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700 }}>Start cursor (optional)</label>
            <input
              value={cursor}
              onChange={(e) => setCursor(e.target.value)}
              placeholder="leave blank to start at beginning"
              style={{
                width: 300,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.15)",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700 }}>Max batches</label>
            <input
              value={maxBatches}
              onChange={(e) => setMaxBatches(Number(e.target.value || 25))}
              type="number"
              min={1}
              max={500}
              style={{
                width: 120,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.15)",
              }}
            />
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "white",
              fontSize: 13,
              fontWeight: 700,
              minHeight: 42,
            }}
          >
            <input
              type="checkbox"
              checked={autoLoop}
              onChange={(e) => setAutoLoop(e.target.checked)}
            />
            Auto loop
          </label>

          <button
            onClick={autoLoop ? runLoop : runOnce}
            disabled={!canRun}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.15)",
              background: running ? "rgba(0,0,0,0.05)" : "white",
              fontWeight: 800,
              cursor: !canRun ? "not-allowed" : "pointer",
            }}
          >
            {running ? "Running..." : autoLoop ? "Run batch loop" : "Run one batch"}
          </button>

          <button
            onClick={clearRuns}
            disabled={running}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "white",
              fontWeight: 800,
              cursor: running ? "not-allowed" : "pointer",
            }}
          >
            Clear log
          </button>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          Last cursor: {lastCursor ?? "—"}
        </div>
      </div>

      {error ? (
        <div
          style={{
            marginTop: 14,
            marginBottom: 14,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(255,0,0,0.25)",
            background: "rgba(255,0,0,0.06)",
            fontWeight: 700,
          }}
        >
          Error: {error}
        </div>
      ) : null}

      <div
        style={{
          marginBottom: 14,
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
        <div>Batches: {logs.length}</div>
        <div>Anime processed: {totals.processedAnime}</div>
        <div>Anime ok: {totals.okAnime}</div>
        <div>Anime failed: {totals.failedAnime}</div>
        <div>Episodes mapped: {totals.mappedEpisodes}</div>
        <div>Details updated: {totals.updatedEpisodeDetails}</div>
        <div>Stills inserted: {totals.insertedEpisodeStills}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {logs.map((log) => {
          const response = log.response;
          const isSuccess = "ok" in response && response.ok === true;

          return (
            <details
              key={log.index}
              style={{
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: 14,
                padding: 12,
                background: "white",
              }}
            >
              <summary style={{ cursor: "pointer", display: "flex", gap: 12, alignItems: "center" }}>
                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: isSuccess ? "rgba(0,128,0,0.08)" : "rgba(255,0,0,0.08)",
                    fontWeight: 900,
                    fontSize: 12,
                    whiteSpace: "nowrap",
                  }}
                >
                  Batch #{log.index}
                </div>

                <div style={{ fontWeight: 900, fontSize: 13 }}>
                  {isSuccess
                    ? `${response.processedAnime} anime processed`
                    : `Failed batch`}
                </div>

                <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.8 }}>
                  {isSuccess
                    ? `nextCursor=${response.nextCursor ?? "null"}`
                    : "error"}
                </div>
              </summary>

              {isSuccess ? (
                <>
                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      gap: 16,
                      flexWrap: "wrap",
                      fontSize: 13,
                    }}
                  >
                    <div><b>Processed anime</b>: {response.processedAnime}</div>
                    <div><b>Mapped episodes</b>: {response.totals.mappedEpisodes}</div>
                    <div><b>Updated details</b>: {response.totals.updatedEpisodeDetails}</div>
                    <div><b>Inserted stills</b>: {response.totals.insertedEpisodeStills}</div>
                    <div><b>Done</b>: {String(response.done)}</div>
                  </div>

                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    {response.perAnime.map((item, idx) => (
                      <details
                        key={`${log.index}-${item.animeId}-${idx}`}
                        style={{
                          border: "1px solid rgba(0,0,0,0.1)",
                          borderRadius: 12,
                          padding: 10,
                          background: item.ok ? "rgba(0,128,0,0.03)" : "rgba(255,0,0,0.03)",
                        }}
                      >
                        <summary style={{ cursor: "pointer", display: "flex", gap: 12, alignItems: "center" }}>
                          <div
                            style={{
                              padding: "5px 8px",
                              borderRadius: 999,
                              border: "1px solid rgba(0,0,0,0.1)",
                              background: item.ok ? "rgba(0,128,0,0.08)" : "rgba(255,0,0,0.08)",
                              fontWeight: 900,
                              fontSize: 12,
                            }}
                          >
                            {item.ok ? "OK" : "ERROR"}
                          </div>

                          <div style={{ fontWeight: 900, fontSize: 13 }}>
                            {item.title || "Untitled"}
                          </div>

                          <div style={{ fontSize: 12, opacity: 0.8 }}>
                            AniList {item.anilistId ?? "—"} • TMDB {item.tmdbId ?? "—"}
                          </div>

                          <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.8 }}>
                            {fmtMs(item.ms)}
                          </div>
                        </summary>

                        <div style={{ marginTop: 10, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
                          <div><b>Mapped episodes</b>: {item.mappedEpisodes ?? 0}</div>
                          <div><b>Updated details</b>: {item.updatedEpisodeDetails ?? 0}</div>
                          <div><b>Inserted stills</b>: {item.insertedEpisodeStills ?? 0}</div>
                          <div><b>Partially mapped</b>: {String(item.mappingPartiallyMapped ?? false)}</div>
                        </div>

                        {item.mappingSkippedReason ? (
                          <div style={{ marginTop: 8, fontSize: 12 }}>
                            <b>Mapping note:</b> {item.mappingSkippedReason}
                          </div>
                        ) : null}

                        {item.error ? (
                          <div style={{ marginTop: 8, fontSize: 12, color: "#b00020", fontWeight: 700 }}>
                            {item.error}
                          </div>
                        ) : null}
                      </details>
                    ))}
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75, marginBottom: 6 }}>
                      Raw batch response
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
                      {JSON.stringify(response, null, 2)}
                    </pre>
                  </div>
                </>
              ) : (
                <div style={{ marginTop: 10, fontSize: 14, fontWeight: 700 }}>
                  {response.error || "Unknown error"}
                </div>
              )}
            </details>
          );
        })}
      </div>
    </div>
  );
}