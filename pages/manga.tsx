import { useEffect, useState } from "react";
import type { NextPage } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Manga = {
  id: string;
  title: string;
  slug: string;
  image_url: string | null;
  banner_image_url: string | null;
  total_chapters: number | null;
  total_volumes: number | null;
};

const MangaIndexPage: NextPage = () => {
  const [mangaList, setMangaList] = useState<Manga[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadManga() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("manga")
        .select(
          `
          id,
          title,
          slug,
          image_url,
          banner_image_url,
          total_chapters,
          total_volumes
        `
        )
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (error) {
        console.error("Error loading manga list:", error);
        setError("Failed to load manga list.");
        setMangaList([]);
      } else {
        setMangaList((data as Manga[]) || []);
      }

      setLoading(false);
    }

    loadManga();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-black text-gray-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6 flex items-baseline justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Manga</h1>
            <p className="mt-1 text-sm text-gray-400">
              All manga you&apos;ve imported from AniList.
            </p>
          </div>
        </header>

        {loading && (
          <p className="text-sm text-gray-400">Loading manga from catalog…</p>
        )}

        {error && !loading && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {!loading && !error && mangaList.length === 0 && (
          <p className="text-sm text-gray-400">
            No manga found yet. Use the dev page at{" "}
            <code className="rounded bg-gray-900 px-1.5 py-0.5 text-xs text-gray-200">
              /dev/anilist-manga-test
            </code>{" "}
            to import some from AniList.
          </p>
        )}

        {!loading && !error && mangaList.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {mangaList.map((manga) => {
              const cover = manga.image_url;
              const chapters = manga.total_chapters;
              const volumes = manga.total_volumes;

              return (
                <Link
                  key={manga.id}
                  href={`/manga/${manga.slug}`}
                  className="group flex flex-col overflow-hidden rounded-lg border border-gray-800 bg-zinc-950/80 transition-transform hover:-translate-y-1 hover:border-emerald-500/70"
                >
                  {/* Poster */}
                  <div className="relative w-full overflow-hidden bg-gray-900">
                    <div className="aspect-[2/3] w-full">
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cover}
                          alt={manga.title}
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-gray-400">
                          {manga.title.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Info */}
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
        )}
      </div>
    </main>
  );
};

export default MangaIndexPage;
