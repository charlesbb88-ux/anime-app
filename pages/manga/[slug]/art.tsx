// pages/manga/[slug]/art.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import Link from "next/link";

import { supabase } from "@/lib/supabaseClient";

type MangaRow = {
  id: string;
  slug: string;
  title: string;
};

type CoverRow = {
  id: string;
  volume: string | null;
  locale: string | null;
  cached_url: string | null;
  source_url: string | null;
};

function labelVolume(v: string | null) {
  if (!v) return "Volume ?";
  return `Vol. ${v}`;
}

const MangaArtPage: NextPage = () => {
  const router = useRouter();
  const slug = String(router.query.slug || "");

  const [manga, setManga] = useState<MangaRow | null>(null);
  const [covers, setCovers] = useState<CoverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!slug) return;
      setLoading(true);
      setError(null);

      // 1) find manga by slug
      const { data: m, error: mErr } = await supabase
        .from("manga")
        .select("id, slug, title")
        .eq("slug", slug)
        .maybeSingle();

      if (!isMounted) return;

      if (mErr || !m) {
        setError("Manga not found.");
        setLoading(false);
        return;
      }

      setManga(m as MangaRow);

      // 2) load art covers
      const { data: rows, error: cErr } = await supabase
        .from("manga_covers")
        .select("id, volume, locale, cached_url, source_url")
        .eq("manga_id", (m as MangaRow).id)
        .order("volume", { ascending: true });

      if (!isMounted) return;

      if (cErr) {
        console.error(cErr);
        setError("Failed to load cover art.");
        setCovers([]);
      } else {
        setCovers((rows as CoverRow[]) || []);
      }

      setLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const grouped = useMemo(() => {
    const map = new Map<string, CoverRow[]>();
    for (const c of covers) {
      const key = c.volume || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    // Sort locales inside each volume (nice)
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => String(a.locale || "").localeCompare(String(b.locale || "")));
      map.set(k, arr);
    }
    return Array.from(map.entries()).sort((a, b) => {
      // "" (unknown volume) last
      if (a[0] === "" && b[0] !== "") return 1;
      if (b[0] === "" && a[0] !== "") return -1;
      return a[0].localeCompare(b[0], undefined, { numeric: true });
    });
  }, [covers]);

  return (
    <main className="min-h-screen bg-black text-gray-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Art</h1>
              <p className="mt-1 text-sm text-gray-400">
                {manga ? (
                  <>
                    Cover art for{" "}
                    <Link href={`/manga/${manga.slug}`} className="text-emerald-300 hover:underline">
                      {manga.title}
                    </Link>
                  </>
                ) : (
                  "Cover art"
                )}
              </p>
            </div>
          </div>
        </header>

        {loading && <p className="text-sm text-gray-400">Loading cover art…</p>}
        {error && !loading && <p className="text-sm text-red-400">{error}</p>}

        {!loading && !error && covers.length === 0 && (
          <div className="rounded-lg border border-gray-800 bg-zinc-950/60 p-4">
            <p className="text-sm text-gray-300">No cover art cached yet.</p>
            <p className="mt-1 text-xs text-gray-500">
              Run your admin cache endpoint for this manga to populate the art tab.
            </p>
          </div>
        )}

        {!loading && !error && covers.length > 0 && (
          <div className="space-y-8">
            {grouped.map(([vol, arr]) => (
              <section key={vol || "unknown"}>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold text-gray-200">{labelVolume(vol || null)}</h2>
                  <span className="text-xs text-gray-500">{arr.length} cover(s)</span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {arr.map((c) => (
                    <a
                      key={c.id}
                      href={c.cached_url || c.source_url || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="group overflow-hidden rounded-lg border border-gray-800 bg-zinc-950/70 hover:border-emerald-500/60"
                      title={c.locale ? `Locale: ${c.locale}` : "Locale: unknown"}
                    >
                      <div className="aspect-[2/3] w-full bg-gray-900">
                        {c.cached_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.cached_url}
                            alt=""
                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                            No image
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                        <span className="truncate text-[11px] text-gray-300">
                          {c.locale ? c.locale.toUpperCase() : "UND"}
                        </span>
                        <span className="text-[11px] text-gray-500">Open</span>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

export default MangaArtPage;
