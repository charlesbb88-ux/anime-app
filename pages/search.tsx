// pages/search.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";

type AnimeRow = {
  id: string;
  slug: string;
  title: string;
  title_english: string | null;
  title_native: string | null;
  title_preferred: string | null;
  image_url: string | null;
  average_score: number | null;
  season_year: number | null;
};

type MangaRow = {
  id: string;
  slug: string;
  title: string;
  title_english: string | null;
  title_native: string | null;
  title_preferred: string | null;
  image_url: string | null;
  cover_image_url: string | null;
  average_score: number | null;
  publication_year: number | null;
};

function cleanSearch(s?: string | null): string {
  return (s || "").trim();
}

function buildSearchOr(raw: string): string {
  // same pattern as your anime page
  const q = raw;
  return [
    `title.ilike.%${q}%`,
    `title_english.ilike.%${q}%`,
    `title_preferred.ilike.%${q}%`,
    `title_native.ilike.%${q}%`,
    `slug.ilike.%${q}%`,
  ].join(",");
}

export default function SearchPage() {
  const router = useRouter();

  const initialQ = useMemo(() => {
    const q = router.query.q;
    return typeof q === "string" ? q : "";
  }, [router.query.q]);

  const [query, setQuery] = useState(initialQ);
  const debounceRef = useRef<number | null>(null);

  const [anime, setAnime] = useState<AnimeRow[]>([]);
  const [manga, setManga] = useState<MangaRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async (search?: string) => {
    setLoading(true);

    const raw = cleanSearch(search);
    const safeLimit = 60;

    let aq = supabase
      .from("anime")
      .select(
        "id,slug,title,title_english,title_native,title_preferred,image_url,average_score,season_year"
      )
      .order("created_at", { ascending: false })
      .limit(safeLimit);

    let mq = supabase
      .from("manga")
      .select(
        "id,slug,title,title_english,title_native,title_preferred,image_url,cover_image_url,average_score,publication_year"
      )
      .order("created_at", { ascending: false })
      .limit(safeLimit);

    if (raw.length > 0) {
      const or = buildSearchOr(raw);
      aq = aq.or(or);
      mq = mq.or(or);
    } else {
      // empty search = show newest, same idea as anime page
      setAnime([]);
      setManga([]);
      setLoading(false);
      return;
    }

    const [aRes, mRes] = await Promise.all([aq, mq]);

    if (aRes.error) {
      console.error("anime search error:", aRes.error);
      setAnime([]);
    } else {
      setAnime((aRes.data as AnimeRow[]) || []);
    }

    if (mRes.error) {
      console.error("manga search error:", mRes.error);
      setManga([]);
    } else {
      setManga((mRes.data as MangaRow[]) || []);
    }

    setLoading(false);
  };

  // keep input synced with url
  useEffect(() => setQuery(initialQ), [initialQ]);

  // update URL (shallow)
  useEffect(() => {
    const q = query.trim();
    const current = typeof router.query.q === "string" ? router.query.q : "";
    if (q === current) return;

    router.replace({ pathname: "/search", query: q ? { q } : {} }, undefined, {
      shallow: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // debounced load
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);

    debounceRef.current = window.setTimeout(() => {
      load(query);
    }, 250);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const qtrim = query.trim();
  const showEmpty = !qtrim && !loading;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-10 pt-6">
      <div className="mb-5">
        <div className="text-xl font-semibold text-slate-900">Search</div>
        <div className="mt-1 text-sm text-slate-500">
          Search anime & manga by title (all languages) or slug.
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <span className="select-none text-slate-400">🔎</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            autoComplete="off"
            spellCheck={false}
          />
          {qtrim && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="rounded-md px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Clear
            </button>
          )}
        </div>

        <div className="mt-2 text-xs text-slate-500">
          {loading ? "Searching…" : qtrim ? `Results for "${qtrim}"` : ""}
        </div>
      </div>

      {showEmpty ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Type to search.
        </div>
      ) : (
        <>
          <ResultGrid
            title="Anime"
            items={anime.map((a) => ({
              key: a.id,
              href: `/anime/${a.slug}`,
              title: a.title_preferred || a.title_english || a.title_native || a.title,
              sub: a.title_english || "",
              imageUrl: a.image_url,
            }))}
            emptyText={qtrim ? "No anime matches." : ""}
          />

          <div className="mt-8" />

          <ResultGrid
            title="Manga"
            items={manga.map((m) => ({
              key: m.id,
              href: `/manga/${m.slug}`,
              title: m.title_preferred || m.title_english || m.title_native || m.title,
              sub: m.title_english || "",
              imageUrl: m.cover_image_url || m.image_url,
            }))}
            emptyText={qtrim ? "No manga matches." : ""}
          />
        </>
      )}
    </main>
  );
}

function ResultGrid({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: { key: string; href: string; title: string; sub: string; imageUrl: string | null }[];
  emptyText: string;
}) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">{items.length ? `${items.length} found` : ""}</div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          {emptyText}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {items.map((it) => (
            <Link key={it.key} href={it.href} className="group block" prefetch={false}>
              <div className="aspect-[2/3] w-full overflow-hidden rounded-xl bg-slate-100 ring-1 ring-black/5">
                {it.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.imageUrl}
                    alt={it.title}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                ) : null}
              </div>

              <div className="mt-2 line-clamp-2 text-xs font-medium text-slate-900">
                {it.title}
              </div>
              {it.sub ? (
                <div className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">
                  {it.sub}
                </div>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
