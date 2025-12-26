"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import ProfileLayout from "@/components/profile/ProfileLayout";

type AnimeCard = {
  id: string;
  slug: string | null;
  title: string | null;
  title_english: string | null;
  image_url: string | null;
};

type MangaCard = {
  id: string;
  slug: string | null;
  title: string | null;
  title_english: string | null;
  image_url: string | null;
};

type MarkRow = {
  id: string;
  user_id: string;
  kind: string | null;

  anime_id: string | null;
  anime_episode_id: string | null;

  manga_id: string | null;
  manga_chapter_id: string | null;

  stars: number | null;
  created_at: string | null;
};

type WatchlistItem = {
  kind: "anime" | "manga";
  id: string;
  slug: string | null;
  posterUrl: string | null;
  title: string;

  addedAt: string | null;

  // optional badges (same look as library)
  stars: number | null; // 0..5 (converted)
  liked: boolean;
  reviewed: boolean;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function roundToHalf(n: number) {
  return Math.round(n * 2) / 2;
}

function normalizeStars(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;

  const n0 = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n0)) return null;

  // DB stars are 0..10 (half-star steps). Convert to 0..5.
  const scaled = n0 / 2;
  return roundToHalf(clamp(scaled, 0, 5));
}

function renderStars(stars: number) {
  const s = clamp(stars, 0, 5);
  const full = Math.floor(s);
  const half = s % 1 !== 0;

  let out = "";
  for (let i = 0; i < full; i++) out += "★";
  if (half) out += "½";
  return out;
}

function WatchlistBody({ profileId }: { profileId: string }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<WatchlistItem[]>([]);

  const countLabel = useMemo(() => items.length, [items.length]);

  useEffect(() => {
    if (!profileId) return;

    let cancelled = false;

    async function loadWatchlist() {
      setLoading(true);

      try {
        // 1) pull watchlist marks
        const { data: watchRows, error: watchErr } = await supabase
          .from("user_marks")
          .select("id, user_id, kind, anime_id, manga_id, anime_episode_id, manga_chapter_id, stars, created_at")
          .eq("user_id", profileId)
          .eq("kind", "watchlist");

        if (cancelled) return;

        if (watchErr) {
          setItems([]);
          return;
        }

        // only allow series-level watchlist, ignore episode/chapter rows
        const watchMarks = ((watchRows || []) as MarkRow[]).filter(
          (r) => !r.anime_episode_id && !r.manga_chapter_id
        );

        const animeIds = Array.from(
          new Set(watchMarks.map((r) => (r.anime_id ? String(r.anime_id) : null)).filter(Boolean) as string[])
        );
        const mangaIds = Array.from(
          new Set(watchMarks.map((r) => (r.manga_id ? String(r.manga_id) : null)).filter(Boolean) as string[])
        );

        // 2) pull optional liked/rating marks for badges (not required, but keeps same “look”)
        const { data: badgeRows } = await supabase
          .from("user_marks")
          .select("kind, anime_id, manga_id, stars")
          .eq("user_id", profileId)
          .in("kind", ["liked", "rating"]);

        if (cancelled) return;

        const likedAnime = new Set<string>();
        const likedManga = new Set<string>();
        const ratingAnime: Record<string, number> = {};
        const ratingManga: Record<string, number> = {};

        for (const mk of ((badgeRows || []) as any[])) {
          const k = String(mk.kind || "").toLowerCase();

          if (k === "liked") {
            if (mk.anime_id) likedAnime.add(String(mk.anime_id));
            if (mk.manga_id) likedManga.add(String(mk.manga_id));
          }

          if (k === "rating") {
            const s = normalizeStars(mk.stars);
            if (s == null) continue;
            if (mk.anime_id) ratingAnime[String(mk.anime_id)] = s;
            if (mk.manga_id) ratingManga[String(mk.manga_id)] = s;
          }
        }

        // 3) pull metadata
        const [animeRes, mangaRes] = await Promise.all([
          animeIds.length
            ? supabase.from("anime").select("id, slug, title, title_english, image_url").in("id", animeIds)
            : Promise.resolve({ data: [] as any[] }),
          mangaIds.length
            ? supabase.from("manga").select("id, slug, title, title_english, image_url").in("id", mangaIds)
            : Promise.resolve({ data: [] as any[] }),
        ]);

        if (cancelled) return;

        const animeById: Record<string, AnimeCard> = {};
        (animeRes.data || []).forEach((a: any) => {
          if (!a?.id) return;
          animeById[String(a.id)] = {
            id: String(a.id),
            slug: a.slug ?? null,
            title: a.title ?? null,
            title_english: a.title_english ?? null,
            image_url: a.image_url ?? null,
          };
        });

        const mangaById: Record<string, MangaCard> = {};
        (mangaRes.data || []).forEach((m: any) => {
          if (!m?.id) return;
          mangaById[String(m.id)] = {
            id: String(m.id),
            slug: m.slug ?? null,
            title: m.title ?? null,
            title_english: m.title_english ?? null,
            image_url: m.image_url ?? null,
          };
        });

        // 4) optional reviewed badges
        const reviewedAnime = new Set<string>();
        const reviewedManga = new Set<string>();

        try {
          const [revAnimeRes, revMangaRes] = await Promise.all([
            animeIds.length
              ? supabase.from("reviews").select("id, anime_id").eq("user_id", profileId).in("anime_id", animeIds)
              : Promise.resolve({ data: [] as any[] }),
            mangaIds.length
              ? supabase.from("reviews").select("id, manga_id").eq("user_id", profileId).in("manga_id", mangaIds)
              : Promise.resolve({ data: [] as any[] }),
          ]);

          (revAnimeRes.data || []).forEach((r: any) => {
            if (r?.anime_id) reviewedAnime.add(String(r.anime_id));
          });
          (revMangaRes.data || []).forEach((r: any) => {
            if (r?.manga_id) reviewedManga.add(String(r.manga_id));
          });
        } catch {
          // ignore if schema differs
        }

        // map addedAt by id for sorting
        const addedAtAnime: Record<string, string | null> = {};
        const addedAtManga: Record<string, string | null> = {};
        for (const mk of watchMarks) {
          if (mk.anime_id) addedAtAnime[String(mk.anime_id)] = mk.created_at ?? null;
          if (mk.manga_id) addedAtManga[String(mk.manga_id)] = mk.created_at ?? null;
        }

        const combined: WatchlistItem[] = [];

        for (const id of animeIds) {
          const meta = animeById[id];
          if (!meta) continue;
          const title = (meta.title_english || meta.title || "").trim() || "Untitled";

          combined.push({
            kind: "anime",
            id,
            slug: meta.slug ?? null,
            posterUrl: meta.image_url ?? null,
            title,
            addedAt: addedAtAnime[id] ?? null,
            stars: ratingAnime[id] ?? null,
            liked: likedAnime.has(id),
            reviewed: reviewedAnime.has(id),
          });
        }

        for (const id of mangaIds) {
          const meta = mangaById[id];
          if (!meta) continue;
          const title = (meta.title_english || meta.title || "").trim() || "Untitled";

          combined.push({
            kind: "manga",
            id,
            slug: meta.slug ?? null,
            posterUrl: meta.image_url ?? null,
            title,
            addedAt: addedAtManga[id] ?? null,
            stars: ratingManga[id] ?? null,
            liked: likedManga.has(id),
            reviewed: reviewedManga.has(id),
          });
        }

        // newest-added first, then title
        combined.sort((a, b) => {
          const at = a.addedAt ? Date.parse(a.addedAt) : 0;
          const bt = b.addedAt ? Date.parse(b.addedAt) : 0;
          if (bt !== at) return bt - at;
          return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
        });

        setItems(combined);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadWatchlist();

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-slate-900 uppercase">Watchlist</h2>
          <span className="text-sm text-slate-500">{countLabel}</span>
        </div>

        {loading ? <span className="text-sm text-slate-500">Loading…</span> : null}
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
          Loading watchlist…
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
          Nothing on this watchlist yet.
        </div>
      ) : (
        <div className="grid [grid-template-columns:repeat(auto-fill,minmax(160px,1fr))] gap-x-2 gap-y-4">
          {items.map((it) => {
            const href = it.slug ? (it.kind === "anime" ? `/anime/${it.slug}` : `/manga/${it.slug}`) : "#";

            return (
              <Link key={`${it.kind}:${it.id}`} href={href} title={it.title} className="group block">
                <div className="relative w-full aspect-[2/3] overflow-visible">
                  <div className="relative w-full h-full overflow-hidden rounded-[4px] bg-slate-200 border border-black group-hover:border-slate-400 transition">
                    {it.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.posterUrl} alt={it.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-[10px] text-slate-500">No poster</span>
                      </div>
                    )}

                    {it.posterUrl ? (
                      <div className="pointer-events-none absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
                    ) : null}
                  </div>

                  {it.posterUrl ? (
                    <div className="pointer-events-none absolute inset-0 z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex-none w-[220px] aspect-[2/3] overflow-hidden rounded-[6px] border border-slate-200/80 shadow-2xl bg-slate-200">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={it.posterUrl} alt={it.title} className="w-full h-full object-cover" />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function UserWatchlistPage() {
  return (
    <ProfileLayout activeTab="watchlist">
      {({ profile }) => <WatchlistBody profileId={profile.id} />}
    </ProfileLayout>
  );
}
