// pages/search.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
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

type Tab = "all" | "anime" | "manga";

function cleanSearch(s?: string | null): string {
  return (s || "").trim();
}

function buildSearchOr(raw: string): string {
  return [
    `title.ilike.%${raw}%`,
    `title_english.ilike.%${raw}%`,
    `title_preferred.ilike.%${raw}%`,
    `title_native.ilike.%${raw}%`,
    `slug.ilike.%${raw}%`,
  ].join(",");
}

export default function SearchPage() {
  const router = useRouter();

  const initialQ = useMemo(() => {
    const q = router.query.q;
    return typeof q === "string" ? q : "";
  }, [router.query.q]);

  const [query, setQuery] = useState(initialQ);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const debounceRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [anime, setAnime] = useState<AnimeRow[]>([]);
  const [manga, setManga] = useState<MangaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const load = useCallback(async (search?: string) => {
    const raw = cleanSearch(search);
    if (!raw) {
      setAnime([]);
      setManga([]);
      setLoading(false);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    const or = buildSearchOr(raw);

    const [aRes, mRes] = await Promise.all([
      supabase
        .from("anime")
        .select("id,slug,title,title_english,title_native,title_preferred,image_url,average_score,season_year")
        .or(or)
        .order("average_score", { ascending: false, nullsFirst: false })
        .limit(60),
      supabase
        .from("manga")
        .select("id,slug,title,title_english,title_native,title_preferred,image_url,cover_image_url,average_score,publication_year")
        .or(or)
        .order("average_score", { ascending: false, nullsFirst: false })
        .limit(60),
    ]);

    setAnime((aRes.data as AnimeRow[]) || []);
    setManga((mRes.data as MangaRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => setQuery(initialQ), [initialQ]);

  useEffect(() => {
    const q = query.trim();
    const current = typeof router.query.q === "string" ? router.query.q : "";
    if (q === current) return;
    router.replace({ pathname: "/search", query: q ? { q } : {} }, undefined, { shallow: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => load(query), 300);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [query, load]);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const qtrim = query.trim();

  const animeItems = anime.map((a) => ({
    key: a.id,
    href: `/anime/${a.slug}`,
    title: a.title_preferred || a.title_english || a.title_native || a.title,
    sub: a.title_english !== (a.title_preferred || a.title_native) ? (a.title_english || "") : "",
    imageUrl: a.image_url,
    score: a.average_score,
    year: a.season_year,
    type: "Anime" as const,
  }));

  const mangaItems = manga.map((m) => ({
    key: m.id,
    href: `/manga/${m.slug}`,
    title: m.title_preferred || m.title_english || m.title_native || m.title,
    sub: m.title_english !== (m.title_preferred || m.title_native) ? (m.title_english || "") : "",
    imageUrl: m.cover_image_url || m.image_url,
    score: m.average_score,
    year: m.publication_year,
    type: "Manga" as const,
  }));

  const allItems = [...animeItems, ...mangaItems].sort((a, b) => (b.score || 0) - (a.score || 0));

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "all", label: "All", count: allItems.length },
    { id: "anime", label: "Anime", count: animeItems.length },
    { id: "manga", label: "Manga", count: mangaItems.length },
  ];

  const visibleItems =
    activeTab === "all" ? allItems : activeTab === "anime" ? animeItems : mangaItems;

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

        /* ── Header ── */
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

        /* ── Search Bar ── */
        .search-bar-wrap {
          position: relative;
          max-width: 680px;
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

        .search-input::placeholder {
          color: var(--text-muted);
        }

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

        .loading-dots {
          display: flex;
          gap: 4px;
          align-items: center;
        }

        .loading-dots span {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--gold);
          animation: dot-bounce 1.2s ease-in-out infinite;
        }

        .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes dot-bounce {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }

        /* ── Tabs ── */
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

        /* ── Grid ── */
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

        /* ── Card ── */
        .card {
          text-decoration: none;
          display: block;
          group: true;
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

        .card:hover .card-poster img {
          transform: scale(1.04);
        }

        .card-poster-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%);
        }

        .card-poster-placeholder svg {
          opacity: 0.15;
        }

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

        .card-score {
          position: absolute;
          bottom: 8px;
          right: 8px;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 7px;
          border-radius: 4px;
          background: rgba(13,13,15,0.85);
          color: var(--text-primary);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          gap: 3px;
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

        .card:hover .card-title {
          color: var(--gold-light);
        }

        .card-sub {
          font-size: 11.5px;
          font-weight: 400;
          color: var(--text-muted);
          margin-top: 3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ── Empty / Skeleton ── */
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
          max-width: 300px;
        }

        /* Skeleton shimmer */
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

        .skeleton-poster::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%);
          animation: shimmer 1.6s ease-in-out infinite;
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .skeleton-line {
          height: 12px;
          border-radius: 6px;
          background: var(--surface);
          position: relative;
          overflow: hidden;
        }

        .skeleton-line::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%);
          animation: shimmer 1.6s ease-in-out infinite;
        }

        .skeleton-line.short { width: 60%; }

        /* ── Section divider ── */
        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .section-title {
          font-family: 'Playfair Display', serif;
          font-size: 20px;
          font-weight: 400;
          color: var(--text-primary);
        }

        .section-count {
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 500;
        }

        .divider {
          height: 1px;
          background: var(--border);
          margin: 48px 0;
        }

        /* Fade-in animation for cards */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .card-animate {
          animation: fadeUp 0.3s ease forwards;
          opacity: 0;
        }
      `}</style>

      <div className="search-page">
        <div className="search-container">

          {/* Header */}
          <header className="search-header">
            <p className="search-eyebrow">Discover</p>
            <h1 className="search-headline">Search Anime & Manga</h1>

            {/* Search bar */}
            <div className="search-bar-wrap">
              <div className="search-bar">
                <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  ref={inputRef}
                  className="search-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by title, native name, or slug…"
                  autoComplete="off"
                  spellCheck={false}
                />
                {qtrim && (
                  <button type="button" className="search-clear" onClick={() => setQuery("")} aria-label="Clear search">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              <div className="search-meta">
                {loading ? (
                  <>
                    <div className="loading-dots">
                      <span /><span /><span />
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

          {/* Body */}
          {!qtrim && !hasSearched ? (
            <div className="empty-state">
              <div className="empty-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </div>
              <p className="empty-title">Start typing to search</p>
              <p className="empty-sub">Find anime and manga by title in any language, or by slug.</p>
            </div>
          ) : loading ? (
            <SkeletonGrid count={12} />
          ) : !qtrim || allItems.length === 0 ? (
            qtrim ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.172 16.172a4 4 0 0 1 5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
                <p className="empty-title">No results found</p>
                <p className="empty-sub">Try a different title or check for typos.</p>
              </div>
            ) : null
          ) : (
            <>
              {/* Tabs — only shown when there are results */}
              <div className="tabs-row">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`tab-btn${activeTab === t.id ? " active" : ""}`}
                    onClick={() => setActiveTab(t.id)}
                  >
                    {t.label}
                    {t.count > 0 && <span className="tab-count">{t.count}</span>}
                  </button>
                ))}
              </div>

              {/* Results */}
              {activeTab === "all" ? (
                <ResultGrid items={visibleItems} />
              ) : (
                <>
                  {activeTab === "anime" && (
                    <section>
                      <div className="section-header">
                        <h2 className="section-title">Anime</h2>
                        <span className="section-count">{animeItems.length} title{animeItems.length !== 1 ? "s" : ""}</span>
                      </div>
                      <ResultGrid items={animeItems} />
                    </section>
                  )}
                  {activeTab === "manga" && (
                    <section>
                      <div className="section-header">
                        <h2 className="section-title">Manga</h2>
                        <span className="section-count">{mangaItems.length} title{mangaItems.length !== 1 ? "s" : ""}</span>
                      </div>
                      <ResultGrid items={mangaItems} />
                    </section>
                  )}
                </>
              )}
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

function ResultGrid({ items }: { items: ResultItem[] }) {
  return (
    <div className="results-grid">
      {items.map((item, i) => (
        <Link
          key={item.key}
          href={item.href}
          className="card card-animate"
          style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
          prefetch={false}
        >
          <div className="card-poster">
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.title} loading="lazy" />
            ) : (
              <div className="card-poster-placeholder">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="m9 9 6 6m0-6-6 6" />
                </svg>
              </div>
            )}
            <span className="card-badge">{item.type}</span>
            {item.score && (
              <span className="card-score">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="#c9a96e" stroke="none">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {item.score}
              </span>
            )}
          </div>
          <div className="card-info">
            <p className="card-title">{item.title}</p>
            {item.sub && item.sub !== item.title && (
              <p className="card-sub">{item.sub}</p>
            )}
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