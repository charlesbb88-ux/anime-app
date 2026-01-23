// pages/dev/mangadex-delta.tsx
import React, { useMemo, useState } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type JoinedManga = { slug: string | null; title: string | null };

type Row = {
  logged_at: string;
  mangadex_updated_at: string | null;
  mangadex_id: string;
  manga_id: string;
  action: "insert" | "update" | string | null;
  changed_fields: any | null;

  // Supabase join sometimes comes back as object OR array. Accept both.
  manga?: JoinedManga | JoinedManga[] | null;
};

type Item = {
  logged_at: string;
  mangadex_updated_at: string | null;
  mangadex_id: string;
  manga_id: string;
  action: string | null; // null => legacy rows (we show "touch")
  slug: string | null;
  title: string | null;
  changed_fields: any | null;
};

type Props = { items: Item[] };

function firstJoin(m: Row["manga"]): JoinedManga | null {
  if (!m) return null;
  if (Array.isArray(m)) return m[0] ?? null;
  return m;
}

/**
 * Formats an ISO timestamp into America/Chicago time with an explicit label.
 * Note: during daylight savings this will technically be CDT, but many people still say “CST”.
 * If you want it to show the correct abbreviation (CST/CDT), we can switch to timeZoneName: "short".
 */
function formatCST(ts: string | null) {
  if (!ts) return "-";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;

  const pretty = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(d);

  return `${pretty} CST`;
}

function timeAgo(ts: string | null) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";

  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  // Future timestamps (clock skew)
  if (diffSec < 0) return "in the future";

  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 48) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 14) return `${diffDay}d ago`;

  const diffWk = Math.floor(diffDay / 7);
  return `${diffWk}w ago`;
}

function normalizeAction(a: string | null) {
  if (!a) return "touch"; // IMPORTANT: "touch" is just UI fallback for legacy rows
  const v = String(a).toLowerCase();
  if (v === "insert" || v === "update" || v === "touch") return v;
  return v; // keep unknown values visible
}

function actionLabel(a: string | null) {
  const v = normalizeAction(a);
  if (v === "insert") return "NEW";
  if (v === "update") return "UPDATED";
  return v.toUpperCase(); // TOUCH / or unknown
}

function actionHelp(a: string | null) {
  const v = normalizeAction(a);
  if (v === "insert") return "Inserted: MangaDex ID did not exist in your DB yet, so a new row was created.";
  if (v === "update") return "Updated: MangaDex ID already existed in your DB, fields were refreshed.";
  if (v === "touch") return "Touched: legacy log row where action was null (UI fallback, not a real action).";
  return `Action: "${v}" (custom/unknown).`;
}

export async function getServerSideProps() {
  const { data, error } = await supabaseAdmin
    .from("mangadex_delta_log")
    .select(
      `
      logged_at,
      mangadex_updated_at,
      mangadex_id,
      manga_id,
      action,
      changed_fields,
      manga:manga_id (slug, title)
    `
    )
    .eq("state_id", "titles_delta")
    .order("logged_at", { ascending: false })
    .limit(400);

  if (error) {
    return { props: { items: [] as Item[] } };
  }

  const rows = (data || []) as unknown as Row[];

  const items: Item[] = rows.map((r) => {
    const jm = firstJoin(r.manga);
    return {
      logged_at: r.logged_at,
      mangadex_updated_at: r.mangadex_updated_at ?? null,
      mangadex_id: r.mangadex_id,
      manga_id: r.manga_id,
      action: r.action ?? null,
      slug: jm?.slug ?? null,
      title: jm?.title ?? null,
      changed_fields: r.changed_fields ?? null,
    };
  });

  return { props: { items } };
}

export default function MangaDexDeltaPage({ items }: Props) {
  const [search, setSearch] = useState("");
  const [onlyAction, setOnlyAction] = useState<"all" | "insert" | "update" | "touch">("all");
  const [hideEmptyChanges, setHideEmptyChanges] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (items || []).filter((it) => {
      const a = normalizeAction(it.action);

      if (onlyAction !== "all" && a !== onlyAction) return false;

      if (hideEmptyChanges) {
        const obj = it.changed_fields;
        const empty =
          obj == null ||
          (typeof obj === "object" && !Array.isArray(obj) && Object.keys(obj).length === 0);
        if (empty) return false;
      }

      if (!q) return true;

      const hay = [
        it.title ?? "",
        it.slug ?? "",
        it.mangadex_id ?? "",
        it.manga_id ?? "",
        normalizeAction(it.action),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [items, search, onlyAction, hideEmptyChanges]);

  const counts = useMemo(() => {
    const c = { insert: 0, update: 0, touch: 0, other: 0 };
    for (const it of items || []) {
      const a = normalizeAction(it.action);
      if (a === "insert") c.insert += 1;
      else if (a === "update") c.update += 1;
      else if (a === "touch") c.touch += 1;
      else c.other += 1;
    }
    return c;
  }, [items]);

  return (
    <div style={{ padding: 20, maxWidth: 1150, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>MangaDex Delta</h1>

      <div style={{ opacity: 0.7, marginBottom: 14, lineHeight: 1.35 }}>
        Showing <b>{filtered.length}</b> of <b>{items.length}</b> most recent rows from{" "}
        <code>mangadex_delta_log</code> (state_id: <code>titles_delta</code>).
        <div style={{ marginTop: 6 }}>
          <span style={{ marginRight: 10 }}>
            NEW: <b>{counts.insert}</b>
          </span>
          <span style={{ marginRight: 10 }}>
            UPDATED: <b>{counts.update}</b>
          </span>
          <span style={{ marginRight: 10 }}>
            TOUCHED: <b>{counts.touch}</b>
          </span>
          {counts.other > 0 ? (
            <span style={{ marginRight: 10 }}>
              OTHER: <b>{counts.other}</b>
            </span>
          ) : null}
        </div>
      </div>

      {/* Controls */}
      <div
        style={{
          border: "1px solid #222",
          borderRadius: 12,
          padding: 12,
          marginBottom: 14,
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title / slug / ids..."
            style={{
              flex: "1 1 320px",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #333",
              background: "transparent",
              color: "inherit",
              outline: "none",
            }}
          />

          <select
            value={onlyAction}
            onChange={(e) => setOnlyAction(e.target.value as any)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #333",
              background: "transparent",
              color: "inherit",
              outline: "none",
            }}
          >
            <option value="all">All actions</option>
            <option value="insert">NEW only</option>
            <option value="update">UPDATED only</option>
            <option value="touch">TOUCHED only</option>
          </select>

          <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={hideEmptyChanges}
              onChange={(e) => setHideEmptyChanges(e.target.checked)}
            />
            Hide empty diffs
          </label>
        </div>

        <div style={{ opacity: 0.7, fontSize: 13 }}>
          <b>insert</b> = brand new manga row created. <b>update</b> = existing manga refreshed.{" "}
          <b>touch</b> = legacy row where action was null (UI fallback, not a real action).
        </div>
      </div>

      {/* List */}
      <div style={{ display: "grid", gap: 12 }}>
        {filtered.map((it) => {
          const a = normalizeAction(it.action);
          const title = it.title ?? it.slug ?? it.mangadex_id;

          const headerBadgeStyle: React.CSSProperties = {
            fontWeight: 900,
            minWidth: 96,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          };

          const badgeColor =
            a === "insert" ? "#1fe57a" : a === "update" ? "#4ea1ff" : a === "touch" ? "#bbb" : "#ffcc66";

          return (
            <details
              key={`${it.logged_at}-${it.mangadex_id}`}
              style={{
                border: "1px solid #222",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  display: "flex",
                  gap: 12,
                  alignItems: "baseline",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ ...headerBadgeStyle, color: badgeColor }}>{actionLabel(it.action)}</span>

                <span style={{ fontWeight: 750, flex: "1 1 320px" }}>{title}</span>

                <span style={{ opacity: 0.7, fontSize: 12, whiteSpace: "nowrap" }}>
                  {formatCST(it.logged_at)}{" "}
                  <span style={{ opacity: 0.85 }}>({timeAgo(it.logged_at)})</span>
                </span>
              </summary>

              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <div style={{ opacity: 0.8 }}>{actionHelp(it.action)}</div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div>
                    <b>slug:</b> {it.slug ?? "-"}
                  </div>
                  <div>
                    <b>title:</b> {it.title ?? "-"}
                  </div>
                  <div>
                    <b>mangadex_id:</b> {it.mangadex_id}
                  </div>
                  <div>
                    <b>manga_id:</b> {it.manga_id}
                  </div>
                  <div>
                    <b>logged_at:</b> {formatCST(it.logged_at)}{" "}
                    <span style={{ opacity: 0.85 }}>({timeAgo(it.logged_at)})</span>
                  </div>
                  <div>
                    <b>mangadex_updated_at:</b> {formatCST(it.mangadex_updated_at)}{" "}
                    {it.mangadex_updated_at ? (
                      <span style={{ opacity: 0.85 }}>({timeAgo(it.mangadex_updated_at)})</span>
                    ) : null}
                  </div>
                </div>

                <div style={{ marginTop: 6 }}>
                  <b>changed_fields:</b>
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      marginTop: 8,
                      marginBottom: 0,
                      padding: 10,
                      borderRadius: 10,
                      border: "1px solid #222",
                      overflowX: "auto",
                    }}
                  >
                    {JSON.stringify(it.changed_fields, null, 2)}
                  </pre>
                </div>
              </div>
            </details>
          );
        })}

        {!filtered.length ? (
          <div style={{ opacity: 0.7, padding: 14, border: "1px solid #222", borderRadius: 12 }}>
            No rows match your filters.
          </div>
        ) : null}
      </div>
    </div>
  );
}
