// pages/dev/mangadex-delta.tsx
import React from "react";
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
  action: string | null;
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
    .limit(200);

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
  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, marginBottom: 10 }}>MangaDex Delta (local)</h1>

      <div style={{ opacity: 0.7, marginBottom: 16 }}>
        Showing {items.length} most recent touches from <code>mangadex_delta_log</code>.
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {items.map((it) => (
          <details
            key={`${it.logged_at}-${it.mangadex_id}`}
            style={{ border: "1px solid #222", borderRadius: 10, padding: 12 }}
          >
            <summary
              style={{
                cursor: "pointer",
                display: "flex",
                gap: 12,
                alignItems: "baseline",
              }}
            >
              <span style={{ fontWeight: 800, minWidth: 70 }}>{it.action ?? "touch"}</span>
              <span style={{ fontWeight: 700 }}>{it.title ?? it.slug ?? it.mangadex_id}</span>
              <span style={{ opacity: 0.7, fontSize: 12 }}>{it.logged_at}</span>
            </summary>

            <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
              <div>
                <b>slug:</b> {it.slug ?? "-"}
              </div>
              <div>
                <b>mangadex_id:</b> {it.mangadex_id}
              </div>
              <div>
                <b>mangadex_updated_at:</b> {it.mangadex_updated_at ?? "-"}
              </div>

              <div style={{ marginTop: 8 }}>
                <b>changed_fields:</b>
                <pre style={{ whiteSpace: "pre-wrap", marginTop: 6, marginBottom: 0 }}>
                  {JSON.stringify(it.changed_fields, null, 2)}
                </pre>
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
