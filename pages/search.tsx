"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";

type Tab = "all" | "anime" | "manga";

type SearchRow = {
  kind: "anime" | "manga";
  id: string;
  slug: string;
  title: string;
  image_url: string | null;
  score: number | null;
};

function cleanSearch(s?: string | null): string {
  return (s || "").trim();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeSearchInput(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasSpecialSearchChars(value: string) {
  return /[':./\\\-!()&]/.test(value);
}

export default function SearchPage() {
  const router = useRouter();

  const initialQ = useMemo(() => {
    const q = router.query.q;
    return typeof q === "string" ? q : "";
  }, [router.query.q]);

  const [query, setQuery] = useState(initialQ);
  const [activeTab, setActiveTab] = useState<Tab>("all");

  const inputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const debounceRef = useRef<number | null>(null);
  const requestSeqRef = useRef(0);

  const [highlightIndex, setHighlightIndex] = useState<number>(-1);

  const load = useCallback(async (search?: string) => {
    const raw = cleanSearch(search);
    const normalizedQuery = normalizeSearchInput(raw);

    if (!normalizedQuery) {
      setRows([]);
      setLoading(false);
      setHasSearched(false);
      setHighlightIndex(-1);
      return;
    }

    setLoading(true);
    setHasSearched(true);

    const mySeq = ++requestSeqRef.current;
    const regex = `(^| )${normalizedQuery}`;
    const useRawPriority = hasSpecialSearchChars(raw);
    const rawPattern = `%${raw}%`;

    const requests = [
      supabase
        .from("anime")
        .select("id, slug, title, title_english, image_url")
        .filter("search_text_main", "match", regex)
        .limit(100),

      supabase
        .from("manga")
        .select("id, slug, title, title_english, image_url")
        .filter("search_text_main", "match", regex)
        .limit(100),

      supabase
        .from("anime")
        .select("id, slug, title, title_english, image_url")
        .filter("search_text", "match", regex)
        .limit(100),

      supabase
        .from("manga")
        .select("id, slug, title, title_english, image_url")
        .filter("search_text", "match", regex)
        .limit(100),
    ];

    const rawRequests = useRawPriority
      ? [
        supabase
          .from("anime")
          .select("id, slug, title, title_english, image_url")
          .or(`title.ilike.${rawPattern},title_english.ilike.${rawPattern}`)
          .limit(50),

        supabase
          .from("manga")
          .select("id, slug, title, title_english, image_url")
          .or(`title.ilike.${rawPattern},title_english.ilike.${rawPattern}`)
          .limit(50),
      ]
      : [];

    const results = await Promise.all([...rawRequests, ...requests]);

    if (mySeq !== requestSeqRef.current) return;

    let animeRawRes: any = null;
    let mangaRawRes: any = null;
    let animeMainRes: any;
    let mangaMainRes: any;
    let animeFallbackRes: any;
    let mangaFallbackRes: any;

    if (useRawPriority) {
      [animeRawRes, mangaRawRes, animeMainRes, mangaMainRes, animeFallbackRes, mangaFallbackRes] = results;
    } else {
      [animeMainRes, mangaMainRes, animeFallbackRes, mangaFallbackRes] = results;
    }

    if (
      animeRawRes?.error ||
      mangaRawRes?.error ||
      animeMainRes.error ||
      mangaMainRes.error ||
      animeFallbackRes.error ||
      mangaFallbackRes.error
    ) {
      console.error("[search] anime raw error", animeRawRes?.error);
      console.error("[search] manga raw error", mangaRawRes?.error);
      console.error("[search] anime main error", animeMainRes.error);
      console.error("[search] manga main error", mangaMainRes.error);
      console.error("[search] anime fallback error", animeFallbackRes.error);
      console.error("[search] manga fallback error", mangaFallbackRes.error);
      setRows([]);
      setLoading(false);
      setHighlightIndex(-1);
      return;
    }

    const mapRow = (r: any, kind: "anime" | "manga"): SearchRow => ({
      kind,
      id: String(r.id),
      slug: String(r.slug),
      title: String(r.title_english || r.title || ""),
      image_url: (r.image_url ?? null) as string | null,
      score: null,
    });

    const merged = new Map<string, SearchRow>();

    if (useRawPriority) {
      for (const r of (animeRawRes?.data || []) as any[]) {
        const row = mapRow(r, "anime");
        merged.set(`anime:${row.id}`, row);
      }

      for (const r of (mangaRawRes?.data || []) as any[]) {
        const row = mapRow(r, "manga");
        merged.set(`manga:${row.id}`, row);
      }
    }

    for (const r of (animeMainRes.data || []) as any[]) {
      const row = mapRow(r, "anime");
      const key = `anime:${row.id}`;
      if (!merged.has(key)) merged.set(key, row);
    }

    for (const r of (mangaMainRes.data || []) as any[]) {
      const row = mapRow(r, "manga");
      const key = `manga:${row.id}`;
      if (!merged.has(key)) merged.set(key, row);
    }

    for (const r of (animeFallbackRes.data || []) as any[]) {
      const row = mapRow(r, "anime");
      const key = `anime:${row.id}`;
      if (!merged.has(key)) merged.set(key, row);
    }

    for (const r of (mangaFallbackRes.data || []) as any[]) {
      const row = mapRow(r, "manga");
      const key = `manga:${row.id}`;
      if (!merged.has(key)) merged.set(key, row);
    }

    setRows(Array.from(merged.values()).slice(0, 200));
    setLoading(false);
    setHighlightIndex(-1);
  }, []);

  useEffect(() => setQuery(initialQ), [initialQ]);

  useEffect(() => {
    const q = query.trim();
    const current = typeof router.query.q === "string" ? router.query.q : "";
    if (q === current) return;

    router.replace({ pathname: "/search", query: q ? { q } : {} }, undefined, {
      shallow: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => load(query), 180);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, load]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const qtrim = query.trim();

  const animeRows = useMemo(() => rows.filter((r) => r.kind === "anime"), [rows]);
  const mangaRows = useMemo(() => rows.filter((r) => r.kind === "manga"), [rows]);

  const animeItems = useMemo(
    () =>
      animeRows.map((r) => ({
        key: r.id,
        href: `/anime/${r.slug}`,
        title: r.title,
        sub: "",
        imageUrl: r.image_url,
        score: null as number | null,
        year: null as number | null,
        type: "Anime" as const,
      })),
    [animeRows]
  );

  const mangaItems = useMemo(
    () =>
      mangaRows.map((r) => ({
        key: r.id,
        href: `/manga/${r.slug}`,
        title: r.title,
        sub: "",
        imageUrl: r.image_url,
        score: null as number | null,
        year: null as number | null,
        type: "Manga" as const,
      })),
    [mangaRows]
  );

  const allItems = useMemo(() => [...animeItems, ...mangaItems], [animeItems, mangaItems]);

  const tabs: { id: Tab; label: string; count: number }[] = useMemo(
    () => [
      { id: "all", label: "All", count: allItems.length },
      { id: "anime", label: "Anime", count: animeItems.length },
      { id: "manga", label: "Manga", count: mangaItems.length },
    ],
    [allItems.length, animeItems.length, mangaItems.length]
  );

  const visibleItems = useMemo(() => {
    if (activeTab === "anime") return animeItems;
    if (activeTab === "manga") return mangaItems;
    return allItems;
  }, [activeTab, allItems, animeItems, mangaItems]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!qtrim) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (visibleItems.length === 0) return;
        setHighlightIndex((prev) => clamp(prev + 1, 0, visibleItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (visibleItems.length === 0) return;
        setHighlightIndex((prev) => clamp(prev - 1, 0, visibleItems.length - 1));
      } else if (e.key === "Enter") {
        if (highlightIndex >= 0 && highlightIndex < visibleItems.length) {
          e.preventDefault();
          router.push(visibleItems[highlightIndex].href);
        }
      } else if (e.key === "Escape") {
        if (highlightIndex !== -1) {
          setHighlightIndex(-1);
        } else {
          setQuery("");
        }
      }
    },
    [qtrim, visibleItems, highlightIndex, router]
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&family=DM+Sans:wght@300;400;500;600&display=swap');

        :root {
          --bg: #0d0d0f;
          --surface: #141416;
          --surface-2: #1c1c1f;
          --border: rgba(255,255,255,0.07);
          --border-hover: rgba(255,255,255,0.14);
          --gold: #c9a96e;
          --gold-light: #e2c898;
          --text-primary: #f0ede8;
          --text-secondary: #8a8780;
          --text-muted: #555350;
          --accent: #c9a96e;
        }

        * { box-sizing: border-box; }

        .search-page {
          min-height: 100vh;
          background: var(--bg);
          font-family: 'DM Sans', sans-serif;
          color: var(--text-primary);
        }

        .search-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px 80px;
        }

        .search-header {
          padding: 64px 0 40px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 40px;
        }

        .search-eyebrow {
          font-family: 'DM Sans', sans-serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--gold);
          margin-bottom: 12px;
        }

        .search-headline {
          font-family: 'Playfair Display', serif;
          font-size: clamp(2rem, 5vw, 3.25rem);
          font-weight: 400;
          color: var(--text-primary);
          line-height: 1.1;
          margin: 0 0 32px;
          letter-spacing: -0.01em;
        }

        .search-bar-wrap {
          position: relative;
          max-width: 720px;
        }

        .search-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 14px 18px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .search-bar:focus-within {
          border-color: var(--gold);
          box-shadow: 0 0 0 3px rgba(201,169,110,0.1), 0 8px 32px rgba(0,0,0,0.4);
        }

        .search-icon {
          flex-shrink: 0;
          color: var(--text-muted);
          transition: color 0.2s;
        }

        .search-bar:focus-within .search-icon {
          color: var(--gold);
        }

        .search-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font-family: 'DM Sans', sans-serif;
          font-size: 16px;
          font-weight: 400;
          color: var(--text-primary);
          caret-color: var(--gold);
        }

        .search-input::placeholder { color: var(--text-muted); }

        .search-clear {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: none;
          background: var(--surface-2);
          color: var(--text-secondary);
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
          flex-shrink: 0;
        }

        .search-clear:hover {
          background: rgba(201,169,110,0.15);
          color: var(--gold);
        }

        .search-meta {
          margin-top: 12px;
          font-size: 13px;
          color: var(--text-muted);
          min-height: 20px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .loading-dots { display: flex; gap: 4px; align-items: center; }
        .loading-dots span {
          width: 4px; height: 4px; border-radius: 50%;
          background: var(--gold);
          animation: dot-bounce 1.2s ease-in-out infinite;
        }
        .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes dot-bounce {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }

        .tabs-row {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 32px;
        }

        .tab-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 7px 16px;
          border-radius: 8px;
          border: 1px solid transparent;
          background: transparent;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s;
        }

        .tab-btn:hover {
          color: var(--text-primary);
          background: var(--surface-2);
        }

        .tab-btn.active {
          color: var(--gold);
          background: rgba(201,169,110,0.08);
          border-color: rgba(201,169,110,0.2);
        }

        .tab-count {
          font-size: 11px;
          font-weight: 600;
          padding: 1px 6px;
          border-radius: 20px;
          background: var(--surface-2);
          color: var(--text-muted);
          transition: all 0.15s;
        }

        .tab-btn.active .tab-count {
          background: rgba(201,169,110,0.15);
          color: var(--gold);
        }

        .results-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 20px;
        }

        @media (min-width: 640px) {
          .results-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
        }

        @media (min-width: 1024px) {
          .results-grid { grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }
        }

        .card {
          text-decoration: none;
          display: block;
          position: relative;
        }

        .card-poster {
          aspect-ratio: 2/3;
          width: 100%;
          border-radius: 10px;
          overflow: hidden;
          background: var(--surface);
          border: 1px solid var(--border);
          position: relative;
          transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease;
        }

        .card:hover .card-poster {
          transform: translateY(-4px);
          box-shadow: 0 20px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,169,110,0.2);
        }

        .card-poster img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.35s ease;
        }

        .card:hover .card-poster img { transform: scale(1.04); }

        .card-poster-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%);
        }

        .card-poster-placeholder svg { opacity: 0.15; }

        .card-badge {
          position: absolute;
          top: 8px;
          left: 8px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 3px 7px;
          border-radius: 4px;
          background: rgba(13,13,15,0.85);
          color: var(--gold);
          backdrop-filter: blur(4px);
          border: 1px solid rgba(201,169,110,0.2);
        }

        .card-info {
          margin-top: 10px;
          padding: 0 2px;
        }

        .card-title {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          transition: color 0.15s;
        }

        .card:hover .card-title { color: var(--gold-light); }

        .card.highlight .card-poster {
          box-shadow: 0 18px 44px rgba(0,0,0,0.65), 0 0 0 1px rgba(201,169,110,0.28);
          transform: translateY(-2px);
        }

        .card.highlight .card-title {
          color: var(--gold-light);
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 24px;
          text-align: center;
          gap: 12px;
        }

        .empty-icon {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: var(--surface);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          margin-bottom: 4px;
        }

        .empty-title {
          font-size: 16px;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .empty-sub {
          font-size: 13px;
          color: var(--text-muted);
          max-width: 360px;
        }

        .skeleton-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 20px;
        }

        @media (min-width: 640px) {
          .skeleton-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
        }

        .skeleton-card { display: flex; flex-direction: column; gap: 10px; }

        .skeleton-poster {
          aspect-ratio: 2/3;
          border-radius: 10px;
          background: var(--surface);
          position: relative;
          overflow: hidden;
        }

        .skeleton-poster::after,
        .skeleton-line::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%);
          animation: shimmer 1.6s ease-in-out infinite;
        }

        .skeleton-line {
          height: 12px;
          border-radius: 6px;
          background: var(--surface);
          position: relative;
          overflow: hidden;
        }

        .skeleton-line.short { width: 60%; }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

      <div className="search-page">
        <div className="search-container">
          <header className="search-header">
            <p className="search-eyebrow">Discover</p>
            <h1 className="search-headline">Search Anime & Manga</h1>

            <div className="search-bar-wrap">
              <div className="search-bar">
                <svg
                  className="search-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>

                <input
                  ref={inputRef}
                  className="search-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Type to search… (↑/↓ to navigate, Enter to open)"
                  autoComplete="off"
                  spellCheck={false}
                />

                {!!qtrim && (
                  <button
                    type="button"
                    className="search-clear"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              <div className="search-meta">
                {loading ? (
                  <>
                    <div className="loading-dots">
                      <span />
                      <span />
                      <span />
                    </div>
                    <span>Searching…</span>
                  </>
                ) : qtrim && hasSearched ? (
                  <span>
                    {allItems.length === 0
                      ? `No results for "${qtrim}"`
                      : `${allItems.length} result${allItems.length !== 1 ? "s" : ""} for "${qtrim}"`}
                  </span>
                ) : null}
              </div>
            </div>
          </header>

          {!qtrim && !hasSearched ? (
            <div className="empty-state">
              <div className="empty-icon">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </div>
              <p className="empty-title">Start typing to search</p>
              <p className="empty-sub">
                This search shows clean title matches first, then broader fallback matches.
              </p>
            </div>
          ) : loading ? (
            <SkeletonGrid count={12} />
          ) : !qtrim || allItems.length === 0 ? (
            qtrim ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9.172 16.172a4 4 0 0 1 5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
                <p className="empty-title">No results found</p>
                <p className="empty-sub">Try a different title or check for typos.</p>
              </div>
            ) : null
          ) : (
            <>
              <div className="tabs-row">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`tab-btn${activeTab === t.id ? " active" : ""}`}
                    onClick={() => {
                      setActiveTab(t.id);
                      setHighlightIndex(-1);
                    }}
                  >
                    {t.label}
                    {t.count > 0 && <span className="tab-count">{t.count}</span>}
                  </button>
                ))}
              </div>

              <ResultGrid
                items={visibleItems}
                highlightIndex={highlightIndex}
                setHighlightIndex={setHighlightIndex}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}

type ResultItem = {
  key: string;
  href: string;
  title: string;
  sub: string;
  imageUrl: string | null;
  score: number | null;
  year: number | null;
  type: "Anime" | "Manga";
};

function ResultGrid({
  items,
  highlightIndex,
  setHighlightIndex,
}: {
  items: ResultItem[];
  highlightIndex: number;
  setHighlightIndex: (n: number) => void;
}) {
  return (
    <div className="results-grid">
      {items.map((item, i) => (
        <Link
          key={item.key}
          href={item.href}
          className={`card card-animate${i === highlightIndex ? " highlight" : ""}`}
          style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
          prefetch={false}
          onMouseEnter={() => setHighlightIndex(i)}
        >
          <div className="card-poster">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt={item.title} loading="lazy" />
            ) : (
              <div className="card-poster-placeholder">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="m9 9 6 6m0-6-6 6" />
                </svg>
              </div>
            )}
            <span className="card-badge">{item.type}</span>
          </div>

          <div className="card-info">
            <p className="card-title">{item.title}</p>
            {item.sub && item.sub !== item.title ? <p className="card-sub">{item.sub}</p> : null}
          </div>
        </Link>
      ))}
    </div>
  );
}

function SkeletonGrid({ count }: { count: number }) {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton-poster" style={{ animationDelay: `${i * 0.06}s` }} />
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
        </div>
      ))}
    </div>
  );
}