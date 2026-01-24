// pages/admin/mangadex-activity/page.tsx
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type LogRow = {
  id: string;
  created_at: string | null;
  state_id: string | null;

  mangadex_id: string | null;
  manga_id: string | null;

  mangadex_updated_at: string | null;

  action: string | null; // "insert" | "update" (based on your delta sync)
  changed_fields: any | null; // jsonb
  before_row: any | null; // jsonb
  after_row: any | null; // jsonb
};

type MangaMini = {
  id: string;
  slug: string | null;
  title: string | null;
  title_english: string | null;
  title_native: string | null;
  title_preferred: string | null;
  image_url: string | null;
  cover_image_url: string | null;
};

function fmt(dt: string | null | undefined) {
  if (!dt) return "—";
  const ms = Date.parse(dt);
  if (!Number.isFinite(ms)) return dt;
  return new Date(ms).toLocaleString();
}

function pickTitle(m?: MangaMini | null) {
  if (!m) return null;
  return (
    m.title_preferred ||
    m.title_english ||
    m.title_native ||
    m.title ||
    null
  );
}

function safeKeys(obj: any): string[] {
  if (!obj || typeof obj !== "object") return [];
  return Object.keys(obj);
}

export default async function Page() {
  // Load latest logs (most recent MangaDex updated first)
  const { data: logsRaw, error } = await supabaseAdmin
    .from("mangadex_delta_log")
    .select(
      "id, created_at, state_id, mangadex_id, manga_id, mangadex_updated_at, action, changed_fields, before_row, after_row"
    )
    .order("mangadex_updated_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold">MangaDex Sync Activity</h1>
        <pre className="mt-4 text-red-600 whitespace-pre-wrap">{String(error.message)}</pre>
      </div>
    );
  }

  const logs = (logsRaw || []) as LogRow[];

  // Deduplicate by (mangadex_id + mangadex_updated_at + action)
  // This prevents spam when the same manga gets processed multiple times.
  const seen = new Set<string>();
  const deduped: LogRow[] = [];
  for (const r of logs) {
    const key = `${r.mangadex_id || ""}::${r.mangadex_updated_at || ""}::${r.action || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }

  // Fetch manga details for display
  const mangaIds = Array.from(
    new Set(deduped.map(r => r.manga_id).filter(Boolean))
  ) as string[];

  let mangaById = new Map<string, MangaMini>();

  if (mangaIds.length) {
    const { data: mangaRows, error: mErr } = await supabaseAdmin
      .from("manga")
      .select("id, slug, title, title_english, title_native, title_preferred, image_url, cover_image_url")
      .in("id", mangaIds);

    if (!mErr && mangaRows) {
      for (const m of mangaRows as any[]) {
        mangaById.set(m.id, m as MangaMini);
      }
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">MangaDex Sync Activity</h1>
        <div className="text-sm text-gray-500">
          Showing {deduped.length} (deduped) of {logs.length} latest log rows
        </div>
      </div>

      <div className="space-y-4">
        {deduped.map((row) => {
          const m = row.manga_id ? mangaById.get(row.manga_id) : null;
          const title = pickTitle(m);
          const img = m?.cover_image_url || m?.image_url || null;

          const changed = row.changed_fields || {};
          const changedKeys = safeKeys(changed).filter(k => k !== "__trigger");

          const isInsert = row.action === "insert";
          const badge = isInsert ? "Imported" : "Updated";
          const badgeCls = isInsert
            ? "bg-green-100 text-green-800"
            : "bg-blue-100 text-blue-800";

          return (
            <div key={row.id} className="border rounded-lg p-4 bg-white">
              <div className="flex gap-4">
                <div className="shrink-0">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img}
                      alt=""
                      className="w-16 h-24 object-cover rounded-md border"
                    />
                  ) : (
                    <div className="w-16 h-24 rounded-md border bg-gray-100" />
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 text-xs rounded ${badgeCls}`}>
                      {badge}
                    </span>

                    <div className="font-semibold truncate">
                      {title ? (
                        m?.slug ? (
                          <Link className="hover:underline" href={`/manga/${m.slug}`}>
                            {title}
                          </Link>
                        ) : (
                          title
                        )
                      ) : (
                        <span className="text-gray-600">Manga title unavailable</span>
                      )}
                    </div>

                    <div className="text-xs text-gray-500 truncate">
                      MangaDex ID: <span className="font-mono">{row.mangadex_id}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-gray-500 text-xs">MangaDex updated</div>
                      <div className="font-medium">{fmt(row.mangadex_updated_at)}</div>
                    </div>

                    <div>
                      <div className="text-gray-500 text-xs">Logged at</div>
                      <div className="font-medium">{fmt(row.created_at)}</div>
                    </div>

                    <div>
                      <div className="text-gray-500 text-xs">Changed fields</div>
                      <div className="font-medium">
                        {changedKeys.length ? changedKeys.length : "0"}
                      </div>
                    </div>
                  </div>

                  <details className="mt-2">
                    <summary className="cursor-pointer select-none text-sm font-medium">
                      View changed fields
                    </summary>

                    <div className="mt-2 space-y-2">
                      {changedKeys.length === 0 ? (
                        <div className="text-sm text-gray-600">No field diffs recorded.</div>
                      ) : (
                        <div className="text-sm space-y-2">
                          {changedKeys.map((k) => (
                            <div key={k} className="border rounded p-2 bg-gray-50">
                              <div className="font-mono text-xs text-gray-700">{k}</div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                                <div>
                                  <div className="text-xs text-gray-500">from</div>
                                  <pre className="text-xs whitespace-pre-wrap break-words">
                                    {JSON.stringify(changed[k]?.from ?? null, null, 2)}
                                  </pre>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500">to</div>
                                  <pre className="text-xs whitespace-pre-wrap break-words">
                                    {JSON.stringify(changed[k]?.to ?? null, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {changed?.__trigger ? (
                        <div className="border rounded p-2 bg-gray-50">
                          <div className="font-mono text-xs text-gray-700">__trigger</div>
                          <pre className="text-xs whitespace-pre-wrap break-words">
                            {JSON.stringify(changed.__trigger, null, 2)}
                          </pre>
                        </div>
                      ) : null}
                    </div>
                  </details>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
