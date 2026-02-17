"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import FeedShell from "@/components/FeedShell";
import {
  JournalEntryRow,
  listJournalEntriesByUserId,
} from "@/lib/journal";

type Props = {
  /** profileId (this is the user_id used by user_journal_items.user_id) */
  profileId: string;

  /** optional: show a title or not */
  title?: string;

  /** how many rows to show */
  limit?: number;
};

function timeAgo(iso: string) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";

  const now = Date.now();
  const s = Math.max(0, Math.floor((now - t) / 1000));

  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;

  // fallback: month/day
  const dt = new Date(iso);
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function entryHref(row: JournalEntryRow) {
  // Prefer explicit slugs you already hydrate onto the journal row
  const slug = row.media_slug?.trim();
  if (!slug) return null;

  // Route by type
  if (row.kind.startsWith("anime_")) return `/anime/${slug}`;
  if (row.kind.startsWith("manga_")) return `/manga/${slug}`;

  return null;
}

function displayTitle(row: JournalEntryRow) {
  return row.media_title?.trim() || "Untitled";
}

function displayAction(row: JournalEntryRow) {
  // Uses hydrated label if you have it
  if (row.entry_label?.trim()) return row.entry_label.trim();

  // Safe fallback labels if entry_label isn't populated
  switch (row.kind) {
    case "anime_episode":
      return "Watched an episode";
    case "anime_series":
      return "Updated anime";
    case "manga_chapter":
      return "Read a chapter";
    case "manga_series":
      return "Updated manga";
    default:
      return "Activity";
  }
}

export default function ProfileUserLeftSidebarRecentActivity({
  profileId,
  title = "Recent Activity",
  limit = 5,
}: Props) {
  const [rows, setRows] = useState<JournalEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canLoad = useMemo(() => !!profileId, [profileId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!canLoad) return;

      setLoading(true);
      setError(null);

      try {
        const { rows, error } = await listJournalEntriesByUserId(profileId, {
          limit,
        });

        if (error) throw error;

        if (!cancelled) {
          setRows(rows ?? []);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load recent activity.");
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [profileId, limit, canLoad]);

  return (
    <aside style={{ width: "100%" }}>
      <FeedShell>
        <div style={{ padding: "0.9rem 1rem" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>{title}</div>
          </div>

          <div style={{ height: 10 }} />

          {loading && <div style={{ fontSize: "0.9rem", color: "#777" }}>Loading…</div>}

          {!loading && error && (
            <div style={{ fontSize: "0.9rem", color: "#b00000" }}>{error}</div>
          )}

          {!loading && !error && rows.length === 0 && (
            <div style={{ fontSize: "0.9rem", color: "#777" }}>No recent activity.</div>
          )}

          {!loading && !error && rows.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
              {rows.map((row) => {
                const href = entryHref(row);
                const action = displayAction(row);
                const title = displayTitle(row);
                const when = timeAgo(row.logged_at || row.created_at);

                const inner = (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "6px 6px",
                      borderRadius: 10,
                      border: "1px solid #eee",
                      background: "#fafafa",
                    }}
                  >
                    {/* poster */}
                    <div
                      style={{
                        width: 38,
                        height: 54,
                        borderRadius: 8,
                        background: "#eaeaea",
                        border: "1px solid #ddd",
                        overflow: "hidden",
                        flexShrink: 0,
                      }}
                    >
                      {row.poster_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.poster_url}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                      ) : null}
                    </div>

                    {/* text */}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: "0.78rem", color: "#666", fontWeight: 600 }}>
                        {action}
                        {when ? <span style={{ marginLeft: 8, color: "#999", fontWeight: 500 }}>{when}</span> : null}
                      </div>

                      <div
                        style={{
                          marginTop: 2,
                          fontSize: "0.95rem",
                          fontWeight: 650,
                          lineHeight: 1.2,
                          display: "-webkit-box",
                          WebkitLineClamp: 2 as any,
                          WebkitBoxOrient: "vertical" as any,
                          overflow: "hidden",
                          whiteSpace: "normal",
                          wordBreak: "break-word",
                        }}
                        title={title}
                      >
                        {title}
                      </div>
                    </div>
                  </div>
                );

                if (!href) {
                  return (
                    <div key={row.log_id}>
                      {inner}
                    </div>
                  );
                }

                return (
                  <Link
                    key={row.log_id}
                    href={href}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <div
                      onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(0.98)")}
                      onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
                    >
                      {inner}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </FeedShell>
    </aside>
  );
}