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
  created_at: string; // ✅ needed for ordering + sanity
};

const PAGE_SIZE = 100;

const MangaIndexPage: NextPage = () => {
  const [mangaList, setMangaList] = useState<Manga[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);

  async function fetchPage(pageIndex: number, mode: "replace" | "append") {
    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

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

    const rows = (data as Manga[]) || [];

    if (typeof count === "number") setTotalCount(count);

    if (mode === "replace") {
      setMangaList(rows);
    } else {
      setMangaList((prev) => [...prev, ...rows]);
    }

    // if we received fewer than PAGE_SIZE, we've hit the end
    setHasMore(rows.length === PAGE_SIZE);
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
            <h1 className="text-2xl font-bold tracking-tight">Manga</h1>
            <p className="mt-1 text-sm text-gray-400">
              All manga you&apos;ve imported.
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
          <p className="text-sm text-gray-400">Loading manga from catalog…</p>
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
                      ({totalCount.toLocaleString()} total)
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

export default MangaIndexPage;
