import { useEffect, useMemo, useState } from "react";
import type { NextPage } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type RecentChapterRow = {
  id: string;
  mangadex_manga_id: string | null;
  chapter: string | null;
  volume: string | null;
  title: string | null;
  translated_language: string | null;
  mangadex_updated_at: string | null;
  group_name: string | null;
  raw_json: any | null;
};

type FeedItem = {
  mangadex_manga_id: string;
  title: string;
  cover_url: string | null;
  chapter: string | null;
  volume: string | null;
  chapter_title: string | null;
  lang: string | null;
  group: string | null;
  updated_at: string;

  ink_manga_id: string | null;
  ink_slug: string | null;
};

const COLS = 4;
const ROWS_PER_COL = 6;
const PAGE_SIZE = COLS * ROWS_PER_COL; // 24
const CHAPTER_SCAN_WINDOW = 1500;

const MANGA_ROUTE_PREFIX = "/manga";

function safeStr(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function pickMangaTitleFromRawJson(raw: any): string | null {
  try {
    const rels = raw?.relationships;
    if (!Array.isArray(rels)) return null;
    const mangaRel = rels.find((r: any) => r?.type === "manga");
    const titleObj = mangaRel?.attributes?.title;
    if (titleObj && typeof titleObj === "object") {
      const keys = ["en", "ja", "ko", "zh", "zh-hk"];
      for (const k of keys) {
        const t = safeStr((titleObj as any)[k]);
        if (t) return t;
      }
      const first = safeStr(Object.values(titleObj)[0]);
      if (first) return first;
    }
    return null;
  } catch {
    return null;
  }
}

function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const diff = Math.max(0, Date.now() - t);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function formatVolCh(vol: string | null, ch: string | null) {
  const v = safeStr(vol);
  const c = safeStr(ch);
  if (v && c) return `Vol. ${v} Ch. ${c}`;
  if (c) return `Ch. ${c}`;
  if (v) return `Vol. ${v}`;
  return "Chapter";
}

type MapResponse = {
  ok: boolean;
  received: number;
  matched: number;
  map: Record<string, { manga_id: string; slug: string | null }>;
};

async function fetchInkMap(mdMangaIds: string[]) {
  const ids = mdMangaIds.map(safeStr).filter((x): x is string => !!x);
  const out = new Map<string, { manga_id: string; slug: string | null }>();
  if (ids.length === 0) return out;

  const r = await fetch("/api/admin/mangadex-manga-map", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids }),
  });

  const j = (await r.json().catch(() => null)) as MapResponse | null;
  if (!r.ok) throw new Error((j as any)?.error || `Mapping failed (${r.status})`);

  for (const [ext, v] of Object.entries(j?.map || {})) {
    const mid = safeStr(v?.manga_id);
    const slug = safeStr(v?.slug);
    if (mid) out.set(ext, { manga_id: mid, slug: slug || null });
  }

  return out;
}

/**
 * ✅ ONLY job: ink_manga_id -> cached_url from manga_covers
 * No timestamps. No extra columns.
 *
 * Assumes manga_covers has:
 * - manga_id (FK to manga.id)
 * - cached_url (the image)
 *
 * If your FK column is NOT "manga_id", change FK_COLUMN below.
 */
type MangaCoversRow = {
  manga_id: string | null;
  cached_url: string | null;
};

async function fetchCoverMapFromMangaCovers(inkIds: string[]) {
  const ids = inkIds.map(safeStr).filter((x): x is string => !!x);
  const out = new Map<string, string | null>();
  if (ids.length === 0) return out;

  const FK_COLUMN = "manga_id"; // <- change ONLY if your column is named differently

  const { data, error } = await supabase
    .from("manga_covers")
    .select(`${FK_COLUMN}, cached_url`)
    .in(FK_COLUMN, ids);

  if (error) throw error;

  const rows = (data as any as MangaCoversRow[]) || [];

  // pick first non-null cached_url per manga_id
  for (const r of rows) {
    const mid = safeStr((r as any)[FK_COLUMN]);
    const url = safeStr(r.cached_url);
    if (!mid || !url) continue;
    if (!out.has(mid)) out.set(mid, url);
  }

  return out;
}

const MangadexStyleFeed: NextPage = () => {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [mappedCount, setMappedCount] = useState(0);

  async function fetchPage(pageIndex: number, mode: "replace" | "append") {
    const from = pageIndex * CHAPTER_SCAN_WINDOW;
    const to = from + CHAPTER_SCAN_WINDOW - 1;

    const { data, error } = await supabase
      .from("mangadex_recent_chapters")
      .select(
        `
          id,
          mangadex_manga_id,
          chapter,
          volume,
          title,
          translated_language,
          mangadex_updated_at,
          group_name,
          raw_json
        `
      )
      .order("mangadex_updated_at", { ascending: false, nullsFirst: false })
      .range(from, to);

    if (error) throw error;

    const rows = (data as RecentChapterRow[]) || [];
    const byManga = new Map<string, FeedItem>();

    for (const r of rows) {
      const mdMangaId = safeStr(r?.mangadex_manga_id);
      const updatedAt = safeStr(r?.mangadex_updated_at);
      if (!mdMangaId || !updatedAt) continue;

      const existing = byManga.get(mdMangaId);
      if (existing && Date.parse(existing.updated_at) >= Date.parse(updatedAt)) continue;

      const title = pickMangaTitleFromRawJson(r?.raw_json) || mdMangaId;

      byManga.set(mdMangaId, {
        mangadex_manga_id: mdMangaId,
        title,
        cover_url: null, // filled from manga_covers.cached_url
        chapter: safeStr(r?.chapter),
        volume: safeStr(r?.volume),
        chapter_title: safeStr(r?.title),
        lang: safeStr(r?.translated_language),
        group: safeStr(r?.group_name),
        updated_at: updatedAt,
        ink_manga_id: null,
        ink_slug: null,
      });
    }

    const unique = Array.from(byManga.values()).sort(
      (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)
    );
    const pageItems = unique.slice(0, PAGE_SIZE);

    // 1) map mangadex -> ink id + ink slug (same as before)
    const map = await fetchInkMap(pageItems.map((x) => x.mangadex_manga_id));
    const withInk = pageItems.map((it) => {
      const hit = map.get(it.mangadex_manga_id);
      return {
        ...it,
        ink_manga_id: hit?.manga_id || null,
        ink_slug: hit?.slug || null,
      };
    });

    // 2) fetch cover images from manga_covers using ink_manga_id
    const inkIds = withInk.map((x) => x.ink_manga_id).filter((x): x is string => !!x);
    const coverMap = await fetchCoverMapFromMangaCovers(inkIds);

    const final = withInk.map((it) => ({
      ...it,
      cover_url: it.ink_manga_id ? coverMap.get(it.ink_manga_id) || null : null,
    }));

    setMappedCount(final.filter((x) => !!x.ink_manga_id).length);

    if (mode === "replace") setItems(final);
    else setItems((prev) => [...prev, ...final]);

    setHasMore(rows.length === CHAPTER_SCAN_WINDOW);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        await fetchPage(0, "replace");
        if (!cancelled) setPage(0);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) {
          setError(e?.message || "Failed to load latest updates.");
          setItems([]);
          setHasMore(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onLoadMore() {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    setError(null);
    const next = page + 1;
    try {
      await fetchPage(next, "append");
      setPage(next);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to load more.");
    } finally {
      setLoadingMore(false);
    }
  }

  const cols = useMemo(() => {
    const out: FeedItem[][] = Array.from({ length: COLS }, () => []);
    const slice = items.slice(0, PAGE_SIZE);
    for (let c = 0; c < COLS; c++) {
      const start = c * ROWS_PER_COL;
      out[c] = slice.slice(start, start + ROWS_PER_COL);
    }
    return out;
  }, [items]);

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Latest Updates</h1>
            <p className="mt-1 text-sm text-gray-500">
              From <span className="font-mono">mangadex_recent_chapters</span> • newest{" "}
              <span className="font-mono">mangadex_updated_at</span> first • mapped {mappedCount}/{PAGE_SIZE}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              onClick={onLoadMore}
              disabled={!hasMore || loadingMore || loading}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? "Loading…" : loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        </header>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        {loading && <p className="text-sm text-gray-500">Loading…</p>}

        {!loading && items.length === 0 && <p className="text-sm text-gray-500">No recent updates found.</p>}

        {!loading && items.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {cols.map((col, colIdx) => (
              <div key={colIdx} className="space-y-2">
                {col.map((it) => {
                  const href = it.ink_slug ? `${MANGA_ROUTE_PREFIX}/${it.ink_slug}` : null;

                  const Card = (
                    <div className="group flex items-start gap-3 rounded-md bg-gray-50 px-2.5 py-2 hover:bg-gray-100">
                      <div className="h-[52px] w-[40px] flex-none overflow-hidden rounded bg-gray-200">
                        {it.cover_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={it.cover_url}
                            alt={it.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-gray-500">
                            {it.title?.[0]?.toUpperCase() || "?"}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-semibold text-gray-900">{it.title}</div>
                            <div className="mt-0.5 truncate text-[12px] text-gray-600">
                              {formatVolCh(it.volume, it.chapter)}
                              {it.chapter_title ? ` — ${it.chapter_title}` : ""}
                            </div>
                          </div>

                          <div className="flex-none text-right text-[11px] text-gray-500">{timeAgo(it.updated_at)}</div>
                        </div>

                        <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
                          <span className="rounded bg-white px-1.5 py-0.5 font-mono">{it.lang || "?"}</span>
                          <span className="truncate">{it.group || "No Group"}</span>
                        </div>

                        <div className="mt-1 text-[11px] text-gray-500">
                          <div className="truncate">
                            <span className="font-mono">MD:</span>{" "}
                            <span className="font-mono">{it.mangadex_manga_id}</span>
                          </div>
                          <div className="truncate">
                            <span className="font-mono">INK:</span>{" "}
                            {it.ink_manga_id ? (
                              <>
                                <span className="font-mono">{it.ink_manga_id}</span>
                                {it.ink_slug ? (
                                  <span className="ml-2 text-gray-400">
                                    (slug: <span className="font-mono">{it.ink_slug}</span>)
                                  </span>
                                ) : null}
                              </>
                            ) : (
                              <span className="font-semibold text-amber-700">No manga_external_ids match</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );

                  if (!href) {
                    return (
                      <div key={it.mangadex_manga_id} className="cursor-not-allowed opacity-95">
                        {Card}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={it.mangadex_manga_id}
                      href={href}
                      className="block rounded-md focus:outline-none focus:ring-2 focus:ring-gray-300"
                    >
                      {Card}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

export default MangadexStyleFeed;
