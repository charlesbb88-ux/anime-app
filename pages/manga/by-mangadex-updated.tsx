import { useEffect, useState } from "react";
import type { NextPage } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Manga = {
  id: string;
  title: string;
  slug: string;
  image_url: string | null;
  cover_image_url: string | null;
  banner_image_url: string | null;
  total_chapters: number | null;
  total_volumes: number | null;
  created_at: string;
};

type FeedRow = {
  mangadex_manga_id: string;
  mangadex_updated_at: string;
};

type ExternalIdRow = {
  manga_id: string; // uuid
  external_id: string; // mangadex uuid as text
  source: string; // enum/text
};

type MangaWithFeed = Manga & {
  latest_mangadex_updated_at: string | null;
};

const PAGE_SIZE = 100;

// how far back in recent chapters to look to build the ordering list
const FEED_WINDOW = 10000;

const MangaByMangadexUpdatedPage: NextPage = () => {
  const [mangaList, setMangaList] = useState<MangaWithFeed[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);

  async function fetchPage(pageIndex: number, mode: "replace" | "append") {
    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    // 1) Pull feed rows and compute latest updatedAt per mangadex_manga_id.
    const { data: feedRows, error: feedErr } = await supabase
      .from("mangadex_recent_chapters")
      .select("mangadex_manga_id, mangadex_updated_at")
      .order("mangadex_updated_at", { ascending: false })
      .limit(FEED_WINDOW);

    if (feedErr) throw feedErr;

    const newestByMdId = new Map<string, string>();
    for (const r of (feedRows as FeedRow[]) || []) {
      const id = r?.mangadex_manga_id;
      const ts = r?.mangadex_updated_at;
      if (typeof id !== "string" || !id) continue;
      if (typeof ts !== "string" || !ts) continue;

      const prev = newestByMdId.get(id);
      if (!prev || Date.parse(ts) > Date.parse(prev)) newestByMdId.set(id, ts);
    }

    // If feed is empty, fall back to created_at like the original page
    if (newestByMdId.size === 0) {
      const { data, error, count } = await supabase
        .from("manga")
        .select(
          `
          id,
          title,
          slug,
          image_url,
          cover_image_url,
          banner_image_url,
          total_chapters,
          total_volumes,
          created_at
        `,
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const rows = ((data as Manga[]) || []).map((m) => ({
        ...m,
        latest_mangadex_updated_at: null,
      }));

      if (typeof count === "number") setTotalCount(count);

      if (mode === "replace") setMangaList(rows);
      else setMangaList((prev) => [...prev, ...rows]);

      setHasMore(rows.length === PAGE_SIZE);
      return;
    }

    // 2) Order MangaDex ids by latest feed updatedAt (desc)
    const sortedMdIds = Array.from(newestByMdId.entries())
      .sort((a, b) => Date.parse(b[1]) - Date.parse(a[1]))
      .map(([id]) => id);

    setTotalCount(sortedMdIds.length);

    // 3) Pagination over ordered md ids
    const pageMdIds = sortedMdIds.slice(from, to + 1);
    if (pageMdIds.length === 0) {
      if (mode === "replace") setMangaList([]);
      setHasMore(false);
      return;
    }

    // 4) Map md ids -> internal manga_id via manga_external_ids
    const { data: extRows, error: extErr } = await supabase
      .from("manga_external_ids")
      .select("manga_id, external_id, source")
      .eq("source", "mangadex")
      .in("external_id", pageMdIds);

    if (extErr) throw extErr;

    const mangaIdByMdId = new Map<string, string>();
    for (const r of (extRows as ExternalIdRow[]) || []) {
      const md = r?.external_id;
      const mid = r?.manga_id;
      if (typeof md !== "string" || !md) continue;
      if (typeof mid !== "string" || !mid) continue;
      mangaIdByMdId.set(md, mid);
    }

    const mangaIds = Array.from(new Set(Array.from(mangaIdByMdId.values())));
    if (mangaIds.length === 0) {
      // Feed exists but none of those md ids are in your imported catalog
      if (mode === "replace") setMangaList([]);
      else setMangaList((prev) => [...prev]);
      setHasMore(pageMdIds.length === PAGE_SIZE);
      return;
    }

    // 5) Fetch manga rows for those internal ids
    const { data: mangaRows, error: mangaErr } = await supabase
      .from("manga")
      .select(
        `
        id,
        title,
        slug,
        image_url,
        cover_image_url,
        banner_image_url,
        total_chapters,
        total_volumes,
        created_at
      `
      )
      .in("id", mangaIds);

    if (mangaErr) throw mangaErr;

    const mangaById = new Map<string, Manga>();
    for (const m of (mangaRows as Manga[]) || []) {
      if (typeof m.id === "string" && m.id) mangaById.set(m.id, m);
    }

    // 6) Rebuild in exact md feed order (and attach the timestamp)
    const rows: MangaWithFeed[] = pageMdIds
      .map((mdId) => {
        const mid = mangaIdByMdId.get(mdId);
        if (!mid) return null;
        const m = mangaById.get(mid);
        if (!m) return null;
        return {
          ...m,
          latest_mangadex_updated_at: newestByMdId.get(mdId) || null,
        };
      })
      .filter(Boolean) as MangaWithFeed[];

    if (mode === "replace") setMangaList(rows);
    else setMangaList((prev) => [...prev, ...rows]);

    setHasMore(pageMdIds.length === PAGE_SIZE);
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
        console.error("Error loading manga list:", e);
        if (!cancelled) {
          setError("Failed to load manga list.");
          setMangaList([]);
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

    const nextPage = page + 1;

    try {
      await fetchPage(nextPage, "append");
      setPage(nextPage);
    } catch (e: any) {
      console.error("Error loading more manga:", e);
      setError("Failed to load more manga.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-gray-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6 flex items-baseline justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Manga (ordered by MangaDex activity)
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Sorted by newest mangadex_updated_at from chapter feed.
              {typeof totalCount === "number" ? (
                <span className="ml-2 text-gray-500">
                  ({mangaList.length.toLocaleString()} /{" "}
                  {totalCount.toLocaleString()})
                </span>
              ) : null}
            </p>
          </div>
        </header>

        {loading && (
          <p className="text-sm text-gray-400">Loading manga from activity feed…</p>
        )}

        {error && !loading && <p className="text-sm text-red-400">{error}</p>}

        {!loading && !error && mangaList.length === 0 && (
          <p className="text-sm text-gray-400">No manga found yet.</p>
        )}

        {!loading && !error && mangaList.length > 0 && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {mangaList.map((manga) => {
                const cover = manga.cover_image_url || manga.image_url;
                const chapters = manga.total_chapters;
                const volumes = manga.total_volumes;

                return (
                  <Link
                    key={manga.id}
                    href={`/manga/${manga.slug}`}
                    className="group flex flex-col overflow-hidden rounded-lg border border-gray-800 bg-zinc-950/80 transition-transform hover:-translate-y-1 hover:border-emerald-500/70"
                  >
                    <div className="relative w-full overflow-hidden bg-gray-900">
                      <div className="aspect-[2/3] w-full">
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={cover}
                            alt={manga.title}
                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-gray-400">
                            {manga.title.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col px-2.5 py-2">
                      <h2 className="line-clamp-2 text-[13px] font-semibold text-gray-100 group-hover:text-emerald-300">
                        {manga.title}
                      </h2>

                      <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-gray-400">
                        {typeof chapters === "number" && chapters > 0 && (
                          <span>Ch. {chapters}</span>
                        )}
                        {typeof volumes === "number" && volumes > 0 && (
                          <span>• Vol. {volumes}</span>
                        )}
                      </div>

                      {manga.latest_mangadex_updated_at ? (
                        <div className="mt-1 text-[10px] text-gray-500">
                          Updated:{" "}
                          {new Date(manga.latest_mangadex_updated_at).toLocaleString()}
                        </div>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="mt-8 flex items-center justify-center">
              {hasMore ? (
                <button
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  className="rounded-lg border border-gray-800 bg-zinc-950/80 px-4 py-2 text-sm text-gray-200 hover:border-emerald-500/70 disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              ) : (
                <p className="text-sm text-gray-500">
                  End of list
                  {typeof totalCount === "number" ? (
                    <span className="ml-1">
                      ({totalCount.toLocaleString()} total in feed window)
                    </span>
                  ) : null}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
};

export default MangaByMangadexUpdatedPage;
