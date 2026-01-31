"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient"; // ⬅️ change this path if needed
import FeedShell from "@/components/FeedShell";

type TrendingRow = {
  slug: string;
  title: string;
  image_url: string | null;
  score: number | null;
};

type TrendingCardProps = {
  title: string;
  subtitle: string;
  hrefPrefix: string; // "/anime" or "/manga"
  rows: TrendingRow[];
  loading: boolean;
  error: string | null;
};

function TrendingCard({ title, subtitle, hrefPrefix, rows, loading, error }: TrendingCardProps) {
  // overall card padding (inside FeedShell)
  const OUTER_PAD = "0.9rem 1rem";

  // ✅ this is the padding you meant: inside the clickable row itself
  // reduce left/right a lot while keeping a tiny vertical hitbox
  const ROW_PAD_Y = 4; // px
  const ROW_PAD_X = 2; // px  <-- much tighter left/right
  const ROW_GAP = 8; // px

  const RANK_W = 18; // slightly tighter
  const POSTER_W = 46;
  const POSTER_H = 66;
  const POSTER_RADIUS = 6;

  return (
    <div style={{ padding: OUTER_PAD }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: "0.85rem", color: "#777" }}>{subtitle}</div>
      </div>

      <div style={{ height: 10 }} />

      {loading && <div style={{ fontSize: "0.9rem", color: "#777" }}>Loading…</div>}

      {!loading && error && <div style={{ fontSize: "0.9rem", color: "#b00000" }}>{error}</div>}

      {!loading && !error && rows.length === 0 && (
        <div style={{ fontSize: "0.9rem", color: "#777" }}>No activity yet this week.</div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
          {rows.map((a, idx) => (
            <Link
              key={`${a.slug}-${idx}`}
              href={`${hrefPrefix}/${a.slug}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: ROW_GAP,
                  padding: `${ROW_PAD_Y}px ${ROW_PAD_X}px`, // ✅ tighter L/R padding
                  borderRadius: 8,
                  border: "1px solid #eee",
                  background: "#fafafa",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f2f2f2")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fafafa")}
              >
                {/* Rank */}
                <div
                  style={{
                    width: RANK_W,
                    textAlign: "center",
                    fontWeight: 700,
                    color: "#444",
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </div>

                {/* Poster */}
                <div
                  style={{
                    width: POSTER_W,
                    height: POSTER_H,
                    borderRadius: POSTER_RADIUS,
                    background: "#eaeaea",
                    border: "1px solid #ddd",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  {a.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.image_url}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  ) : null}
                </div>

                {/* Title (✅ allow 2 lines) */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: "0.95rem",
                      fontWeight: 650,
                      lineHeight: 1.2,
                      // ✅ 2-line clamp
                      display: "-webkit-box",
                      WebkitLineClamp: 2 as any,
                      WebkitBoxOrient: "vertical" as any,
                      overflow: "hidden",
                      // remove nowrap/ellipsis so it can wrap
                      whiteSpace: "normal",
                      wordBreak: "break-word",
                    }}
                    title={a.title}
                  >
                    {a.title}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LeftSidebar() {
  const [animeRows, setAnimeRows] = useState<TrendingRow[]>([]);
  const [mangaRows, setMangaRows] = useState<TrendingRow[]>([]);

  const [animeLoading, setAnimeLoading] = useState(true);
  const [mangaLoading, setMangaLoading] = useState(true);

  const [animeError, setAnimeError] = useState<string | null>(null);
  const [mangaError, setMangaError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAnime() {
      setAnimeLoading(true);
      setAnimeError(null);

      try {
        const { data, error } = await supabase
          .from("anime_weekly_trending")
          .select("slug, title, image_url, score")
          .order("score", { ascending: false })
          .limit(10);

        if (error) throw error;
        if (!cancelled) setAnimeRows((data ?? []) as TrendingRow[]);
      } catch (e: any) {
        if (!cancelled) {
          setAnimeError(e?.message ?? "Failed to load top anime.");
          setAnimeRows([]);
        }
      } finally {
        if (!cancelled) setAnimeLoading(false);
      }
    }

    async function loadManga() {
      setMangaLoading(true);
      setMangaError(null);

      try {
        const { data, error } = await supabase
          .from("manga_weekly_trending")
          .select("slug, title, image_url, score")
          .order("score", { ascending: false })
          .limit(10);

        if (error) throw error;
        if (!cancelled) setMangaRows((data ?? []) as TrendingRow[]);
      } catch (e: any) {
        if (!cancelled) {
          setMangaError(e?.message ?? "Failed to load top manga.");
          setMangaRows([]);
        }
      } finally {
        if (!cancelled) setMangaLoading(false);
      }
    }

    loadAnime();
    loadManga();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside style={{ width: "100%", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <FeedShell>
        <TrendingCard
          title="Top Anime"
          subtitle="This week"
          hrefPrefix="/anime"
          rows={animeRows}
          loading={animeLoading}
          error={animeError}
        />
      </FeedShell>

      <FeedShell>
        <TrendingCard
          title="Top Manga"
          subtitle="This week"
          hrefPrefix="/manga"
          rows={mangaRows}
          loading={mangaLoading}
          error={mangaError}
        />
      </FeedShell>
    </aside>
  );
}
