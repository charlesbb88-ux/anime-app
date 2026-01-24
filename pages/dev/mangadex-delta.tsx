// pages/dev/mangadex-delta.tsx
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type JoinedManga = { slug: string | null; title: string | null };

type Row = {
  state_id: string;
  logged_at: string;
  mangadex_updated_at: string | null;
  mangadex_id: string;
  manga_id: string;
  action: "insert" | "update" | string | null;
  changed_fields: any | null;
  manga?: JoinedManga | JoinedManga[] | null;
};

type Item = {
  state_id: string;
  logged_at: string;
  mangadex_updated_at: string | null;
  mangadex_id: string;
  manga_id: string;
  action: string | null;
  slug: string | null;
  title: string | null;
  changed_fields: any | null;
  trigger_mode: "manga" | "chapter" | null;
  trigger_feed_id: string | null;
  trigger_feed_updated_at: string | null;
};

type StateRow = {
  id: string;
  updated_at: string | null;
  cursor_updated_at: string | null;
  cursor_last_id: string | null;
  processed_count: number | null;
  mode: string | null;
  page_limit: number | null;
};

type Props = { items: Item[]; state: StateRow | null; stateId: string };

function firstJoin(m: Row["manga"]): JoinedManga | null {
  if (!m) return null;
  if (Array.isArray(m)) return m[0] ?? null;
  return m;
}

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

function ClientOnlyAgo({ ts, tickMs = 30_000 }: { ts: string | null; tickMs?: number }) {
  const [mounted, setMounted] = useState(false);
  const [, bump] = useState(0);

  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => bump((x) => x + 1), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);

  if (!mounted) return null;

  const v = timeAgo(ts);
  if (!v) return null;

  return <span style={{ opacity: 0.85 }}>({v})</span>;
}

function normalizeAction(a: string | null) {
  if (!a) return "touch";
  const v = String(a).toLowerCase();
  if (v === "insert" || v === "update" || v === "touch") return v;
  return v;
}

function actionLabel(a: string | null) {
  const v = normalizeAction(a);
  if (v === "insert") return "NEW";
  if (v === "update") return "UPDATED";
  return v.toUpperCase();
}

function badgeColorForAction(a: string | null) {
  const v = normalizeAction(a);
  if (v === "insert") return "#1fe57a";
  if (v === "update") return "#4ea1ff";
  if (v === "touch") return "#bbb";
  return "#ffcc66";
}

function isEmptyChangedFields(obj: any) {
  if (obj == null) return true;
  if (typeof obj !== "object") return false;
  if (Array.isArray(obj)) return obj.length === 0;
  // ignore __trigger only when determining "real" diffs
  const keys = Object.keys(obj).filter((k) => k !== "__trigger");
  return keys.length === 0;
}

function extractTrigger(changed_fields: any): {
  trigger_mode: "manga" | "chapter" | null;
  trigger_feed_id: string | null;
  trigger_feed_updated_at: string | null;
} {
  const t = changed_fields?.__trigger;
  const mode = t?.mode === "chapter" ? "chapter" : t?.mode === "manga" ? "manga" : null;
  const feedId = typeof t?.feed_id === "string" ? t.feed_id : null;
  const feedUpdatedAt = typeof t?.feed_updatedAt === "string" ? t.feed_updatedAt : null;
  return { trigger_mode: mode, trigger_feed_id: feedId, trigger_feed_updated_at: feedUpdatedAt };
}

export async function getServerSideProps(ctx: any) {
  const stateId = String(ctx?.query?.state_id || "titles_delta");

  const { data: state, error: stErr } = await supabaseAdmin
    .from("mangadex_crawl_state")
    .select("id, updated_at, cursor_updated_at, cursor_last_id, processed_count, mode, page_limit")
    .eq("id", stateId)
    .maybeSingle();

  if (stErr) {
    return { props: { items: [] as Item[], state: null, stateId } };
  }

  const { data, error } = await supabaseAdmin
    .from("mangadex_delta_log")
    .select(
      `
      state_id,
      logged_at,
      mangadex_updated_at,
      mangadex_id,
      manga_id,
      action,
      changed_fields,
      manga:manga_id (slug, title)
    `
    )
    .eq("state_id", stateId)
    .order("logged_at", { ascending: false })
    .limit(400);

  if (error) {
    return { props: { items: [] as Item[], state: state ?? null, stateId } };
  }

  const rows = (data || []) as unknown as Row[];

  const items: Item[] = rows.map((r) => {
    const jm = firstJoin(r.manga);
    const trig = extractTrigger(r.changed_fields);

    return {
      state_id: r.state_id,
      logged_at: r.logged_at,
      mangadex_updated_at: r.mangadex_updated_at ?? null,
      mangadex_id: r.mangadex_id,
      manga_id: r.manga_id,
      action: r.action ?? null,
      slug: jm?.slug ?? null,
      title: jm?.title ?? null,
      changed_fields: r.changed_fields ?? null,
      trigger_mode: trig.trigger_mode,
      trigger_feed_id: trig.trigger_feed_id,
      trigger_feed_updated_at: trig.trigger_feed_updated_at,
    };
  });

  return { props: { items, state: state ?? null, stateId } };
}

function StatePicker({ stateId }: { stateId: string }) {
  const router = useRouter();
  const [val, setVal] = useState(stateId);

  useEffect(() => setVal(stateId), [stateId]);

  function go(next: string) {
    // full reload server-side (SSR) so we see new state/logs immediately
    router.push({ pathname: router.pathname, query: { ...router.query, state_id: next } });
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <b>state:</b>
      <select
        value={val}
        onChange={(e) => {
          const next = e.target.value;
          setVal(next);
          go(next);
        }}
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #333",
          background: "transparent",
          color: "inherit",
          outline: "none",
          minWidth: 220,
        }}
      >
        <option value="titles_delta">titles_delta (manga metadata feed)</option>
        <option value="chapters_delta">chapters_delta (chapter activity feed)</option>
      </select>

      <div style={{ opacity: 0.75 }}>
        Tip: bookmark
        {" "}
        <code style={{ padding: "2px 6px", border: "1px solid #222", borderRadius: 8 }}>
          /dev/mangadex-delta?state_id=chapters_delta
        </code>
      </div>
    </div>
  );
}

export default function MangaDexDeltaPage({ items, state, stateId }: Props) {
  const [search, setSearch] = useState("");
  const [onlyAction, setOnlyAction] = useState<"all" | "insert" | "update" | "touch">("all");
  const [hideEmptyChanges, setHideEmptyChanges] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (items || []).filter((it) => {
      const a = normalizeAction(it.action);

      if (onlyAction !== "all" && a !== onlyAction) return false;

      if (hideEmptyChanges) {
        if (isEmptyChangedFields(it.changed_fields)) return false;
      }

      if (!q) return true;

      const hay = [
        it.title ?? "",
        it.slug ?? "",
        it.mangadex_id ?? "",
        it.manga_id ?? "",
        a,
        it.trigger_mode ?? "",
        it.trigger_feed_id ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [items, search, onlyAction, hideEmptyChanges]);

  const counts = useMemo(() => {
    const c = { insert: 0, update: 0, touch: 0, other: 0, empty_diffs: 0, chapter_triggered: 0 };
    for (const it of items || []) {
      const a = normalizeAction(it.action);
      if (a === "insert") c.insert += 1;
      else if (a === "update") c.update += 1;
      else if (a === "touch") c.touch += 1;
      else c.other += 1;

      if (isEmptyChangedFields(it.changed_fields)) c.empty_diffs += 1;
      if (it.trigger_mode === "chapter") c.chapter_triggered += 1;
    }
    return c;
  }, [items]);

  return (
    <div style={{ padding: 20, maxWidth: 1150, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, marginBottom: 6 }}>MangaDex Delta</h1>
        <div style={{ opacity: 0.8, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/dev" style={{ opacity: 0.9 }}>
            /dev
          </Link>
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <StatePicker stateId={stateId} />
      </div>

      <div
        style={{
          border: "1px solid #222",
          borderRadius: 12,
          padding: 12,
          marginBottom: 14,
          background: "rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <div>
            <b>last checked (state.updated_at):</b>{" "}
            {formatCST(state?.updated_at ?? null)} <ClientOnlyAgo ts={state?.updated_at ?? null} />
          </div>
          <div>
            <b>cursor_updated_at:</b> {formatCST(state?.cursor_updated_at ?? null)}
          </div>
          <div>
            <b>cursor_last_id:</b> {state?.cursor_last_id ?? "-"}
          </div>
          <div>
            <b>processed_count (lifetime):</b> {state?.processed_count ?? 0}
          </div>
          <div>
            <b>state.mode (db):</b> {state?.mode ?? "-"} &nbsp;&nbsp; <b>page_limit:</b>{" "}
            {state?.page_limit ?? "-"}
          </div>

          <div style={{ opacity: 0.8, marginTop: 6, lineHeight: 1.35 }}>
            {stateId === "titles_delta" ? (
              <>
                You are viewing <b>manga metadata</b> activity (MangaDex <code>/manga</code> updatedAt).
                This often goes quiet for long stretches.
              </>
            ) : (
              <>
                You are viewing <b>homepage-style chapter activity</b> (MangaDex <code>/chapter</code> updatedAt).
                Many rows will be <b>UPDATED</b> with <b>empty diffs</b> because it refreshed the manga but fields didn’t change.
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ opacity: 0.7, marginBottom: 14, lineHeight: 1.35 }}>
        Showing <b>{filtered.length}</b> of <b>{items.length}</b> most recent rows from{" "}
        <code>mangadex_delta_log</code>.
        <div style={{ marginTop: 6, display: "flex", gap: 14, flexWrap: "wrap" }}>
          <span>
            NEW: <b>{counts.insert}</b>
          </span>
          <span>
            UPDATED: <b>{counts.update}</b>
          </span>
          <span>
            TOUCHED: <b>{counts.touch}</b>
          </span>
          {counts.other > 0 ? (
            <span>
              OTHER: <b>{counts.other}</b>
            </span>
          ) : null}
          <span>
            EMPTY DIFFS: <b>{counts.empty_diffs}</b>
          </span>
          {stateId === "chapters_delta" ? (
            <span>
              CHAPTER-TRIGGERED: <b>{counts.chapter_triggered}</b>
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
            Hide empty diffs (ignores __trigger)
          </label>
        </div>
      </div>

      {/* List */}
      <div style={{ display: "grid", gap: 12 }}>
        {filtered.map((it) => {
          const a = normalizeAction(it.action);
          const title = it.title ?? it.slug ?? it.mangadex_id;
          const badgeColor = badgeColorForAction(it.action);

          const emptyDiff = isEmptyChangedFields(it.changed_fields);
          const isChapterTriggered = it.trigger_mode === "chapter";

          return (
            <details
              key={`${it.logged_at}-${it.mangadex_id}-${it.state_id}`}
              style={{
                border: "1px solid #222",
                borderRadius: 12,
                padding: 12,
                background: emptyDiff ? "rgba(255,255,255,0.02)" : "transparent",
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
                <span style={{ fontWeight: 900, minWidth: 96, color: badgeColor }}>
                  {actionLabel(it.action)}
                </span>

                <span style={{ fontWeight: 750, flex: "1 1 320px" }}>{title}</span>

                {isChapterTriggered ? (
                  <span
                    style={{
                      fontSize: 12,
                      padding: "2px 8px",
                      borderRadius: 999,
                      border: "1px solid #333",
                      opacity: 0.85,
                    }}
                  >
                    chapter-trigger
                  </span>
                ) : null}

                {emptyDiff ? (
                  <span style={{ fontSize: 12, opacity: 0.7 }}>
                    (no field diffs)
                  </span>
                ) : null}

                <span style={{ opacity: 0.7, fontSize: 12, whiteSpace: "nowrap" }}>
                  {formatCST(it.logged_at)} <ClientOnlyAgo ts={it.logged_at} />
                </span>
              </summary>

              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div>
                    <b>state_id:</b> {it.state_id}
                  </div>
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
                    <b>logged_at:</b> {formatCST(it.logged_at)} <ClientOnlyAgo ts={it.logged_at} />
                  </div>
                  <div>
                    <b>mangadex_updated_at:</b> {formatCST(it.mangadex_updated_at)}{" "}
                    <ClientOnlyAgo ts={it.mangadex_updated_at} />
                  </div>

                  {it.trigger_mode ? (
                    <div
                      style={{
                        marginTop: 6,
                        padding: 10,
                        borderRadius: 10,
                        border: "1px solid #222",
                        background: "rgba(0,0,0,0.03)",
                      }}
                    >
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>Trigger</div>
                      <div style={{ display: "grid", gap: 4 }}>
                        <div>
                          <b>trigger_mode:</b> {it.trigger_mode}
                        </div>
                        <div>
                          <b>trigger_feed_id:</b> {it.trigger_feed_id ?? "-"}
                        </div>
                        <div>
                          <b>trigger_feed_updated_at:</b> {formatCST(it.trigger_feed_updated_at)}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div>
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
