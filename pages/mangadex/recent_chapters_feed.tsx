import { useEffect, useMemo, useState } from "react";
import type { NextPage } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type RecentChapterRow = {
  id: string;
  mangadex_chapter_id: string;
  mangadex_manga_id: string;
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
  updated_at: string; // iso string
  slug: string | null; // your site slug
};

// MangaDex-style grid window
const COLS = 4;
const ROWS_PER_COL = 6;
const PAGE_SIZE = COLS * ROWS_PER_COL; // 24

// we scan a larger window, but only show 24
const CHAPTER_SCAN_WINDOW = 1500;

// must match your manga_external_ids.source enum value
const MANGADEX_SOURCE = "mangadex";

function safeStr(v: any): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
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
        const t = safeStr(titleObj[k]);
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

function pickCoverFromRawJson(_raw: any): string | null {
  // You aren’t storing cover in this table right now, so keep placeholder.
  // If later you store cover somewhere, implement it here.
  return null;
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

async function fetchSlugMapByMangadexIds(mangadexIds: string[]) {
  // returns Map<mangadex_manga_id, slug>
  const out = new Map<string, string>();

  const ids = mangadexIds
    .map((x) => safeStr(x))
    .filter((x): x is string => !!x);

  if (ids.length === 0) return out;

  // 1) external_id (mangadex uuid) -> manga_id
  const extToMangaId = new Map<string, string>();

  // Supabase "in" has limits; chunk it
  const CHUNK = 200;

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);

    const { data, error } = await supabase
      .from("manga_external_ids")
      .select("external_id, manga_id")
      .eq("source", MANGADEX_SOURCE)
      .in("external_id", chunk);

    if (error) throw error;

    for (const row of (data as any[]) || []) {
      const ext = safeStr(row?.external_id);
      const mid = safeStr(row?.manga_id);
      if (ext && mid) extToMangaId.set(ext, mid);
    }
  }

  const mangaIds = Array.from(new Set(Array.from(extToMangaId.values())));
  if (mangaIds.length === 0) return out;

  // 2) manga_id -> slug
  const idToSlug = new Map<string, string>();

  for (let i = 0; i < mangaIds.length; i += CHUNK) {
    const chunk = mangaIds.slice(i, i + CHUNK);

    const { data, error } = await supabase
      .from("manga")
      .select("id, slug")
      .in("id", chunk);

    if (error) throw error;

    for (const row of (data as any[]) || []) {
      const id = safeStr(row?.id);
      const slug = safeStr(row?.slug);
      if (id && slug) idToSlug.set(id, slug);
    }
  }

  // 3) ext -> slug
  for (const [ext, mid] of extToMangaId.entries()) {
    const slug = idToSlug.get(mid);
    if (slug) out.set(ext, slug);
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

  // debug counters
  const [mappedCount, setMappedCount] = useState(0);
  const [missingIds, setMissingIds] = useState<string[]>([]);

  async function fetchPage(pageIndex: number, mode: "replace" | "append") {
    const from = pageIndex * CHAPTER_SCAN_WINDOW;
    const to = from + CHAPTER_SCAN_WINDOW - 1;

    const { data, error } = await supabase
      .from("mangadex_recent_chapters")
      .select(
        `
          id,
          mangadex_chapter_id,
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

    // Deduplicate by mangadex_manga_id (newest wins)
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
        cover_url: pickCoverFromRawJson(r?.raw_json),
        chapter: safeStr(r?.chapter),
        volume: safeStr(r?.volume),
        chapter_title: safeStr(r?.title),
        lang: safeStr(r?.translated_language),
        group: safeStr(r?.group_name),
        updated_at: updatedAt,
        slug: null,
      });
    }

    const unique = Array.from(byManga.values()).sort(
      (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)
    );

    // only render 24 at a time (MangaDex style)
    const pageItems = unique.slice(0, PAGE_SIZE);

    // Lookup slugs for these 24 Mangadex IDs using manga_external_ids -> manga -> slug
    const mdIds = pageItems.map((x) => x.mangadex_manga_id);
    const slugMap = await fetchSlugMapByMangadexIds(mdIds);

    const withSlugs = pageItems.map((it) => ({
      ...it,
      slug: slugMap.get(it.mangadex_manga_id) || null,
    }));

    // debug
    const mapped = withSlugs.filter((x) => !!x.slug).length;
    const missing = withSlugs.filter((x) => !x.slug).map((x) => x.mangadex_manga_id);
    setMappedCount(mapped);
    setMissingIds(missing);

    if (mode === "replace") setItems(withSlugs);
    else setItems((prev) => [...prev, ...withSlugs]);

    // if we got a full scan window, there might be more
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
          setError("Failed to load latest updates.");
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
      setError("Failed to load more.");
    } finally {
      setLoadingMore(false);
    }
  }

  // MangaDex-style: fill DOWN each column
  const cols = useMemo(() => {
    const out: FeedItem[][] = Array.from({ length: COLS }, () => []);
    const slice = items.slice(0, PAGE_SIZE);

    for (let c = 0; c < COLS; c++) {
      const start = c * ROWS_PER_COL;
      const end = start + ROWS_PER_COL;
      out[c] = slice.slice(start, end);
    }

    return out;
  }, [items]);

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Latest Updates</h1>
            <p className="mt-1 text-sm text-gray-500">
              From <span className="font-mono">mangadex_recent_chapters</span> • newest{" "}
              <span className="font-mono">mangadex_updated_at</span> first{" "}
              <span className="text-gray-400">
                (mapped {mappedCount}/{PAGE_SIZE}
                {missingIds.length > 0 ? ` • missing: ${missingIds.slice(0, 3).join(", ")}${missingIds.length > 3 ? "…" : ""}` : ""}
                )
              </span>
            </p>
          </div>

          <button
            onClick={onLoadMore}
            disabled={!hasMore || loadingMore || loading}
            className="flex-none rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "Loading…" : loadingMore ? "Loading…" : "Load more"}
          </button>
        </header>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        {loading && <p className="text-sm text-gray-500">Loading…</p>}

        {!loading && items.length === 0 && (
          <p className="text-sm text-gray-500">No recent updates found.</p>
        )}

        {!loading && items.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {cols.map((col, colIdx) => (
              <div key={colIdx} className="space-y-2">
                {col.map((it) => {
                  const href = it.slug ? `/manga/${it.slug}` : null;

                  const card = (
                    <div className="group flex items-start gap-3 rounded-md bg-gray-50 px-2.5 py-2 hover:bg-gray-100">
                      {/* thumb */}
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

                      {/* text */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-semibold text-gray-900 group-hover:underline">
                              {it.title}
                            </div>
                            <div className="mt-0.5 truncate text-[12px] text-gray-600">
                              {formatVolCh(it.volume, it.chapter)}
                              {it.chapter_title ? ` — ${it.chapter_title}` : ""}
                            </div>
                          </div>

                          <div className="flex-none text-right text-[11px] text-gray-500">
                            {timeAgo(it.updated_at)}
                          </div>
                        </div>

                        <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
                          <span className="rounded bg-white px-1.5 py-0.5 font-mono">
                            {it.lang || "?"}
                          </span>
                          <span className="truncate">{it.group || "No Group"}</span>

                          {!it.slug && (
                            <span className="ml-auto rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                              Not imported
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );

                  return href ? (
                    <Link key={it.mangadex_manga_id} href={href} className="block">
                      {card}
                    </Link>
                  ) : (
                    <div
                      key={it.mangadex_manga_id}
                      className="block cursor-not-allowed opacity-80"
                      title={`No match in manga_external_ids for ${it.mangadex_manga_id}`}
                    >
                      {card}
                    </div>
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
