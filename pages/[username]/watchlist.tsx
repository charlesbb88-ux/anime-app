"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import ProfileLayout from "@/components/profile/ProfileLayout";

import { buildChapterNavGroups } from "@/lib/chapterNavigation";
import type { NavGroup } from "@/lib/chapterNavigation";

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
  total_chapters: number | null;
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

type MangaChapterMeta = {
  id: string;
  manga_id: string | null;
  chapter_number: number | null;
};

type AnimeEpisodeMeta = {
  id: string;
  anime_id: string | null;
  episode_number: number | null;
};

type CoverRow = {
  manga_id: string;
  volume: string | null;
  locale: string | null;
  cached_url: string | null;
  is_main: boolean | null;
};

type VolumeMapRow = {
  manga_id: string;
  mapping: Record<string, string[]> | null;
};

type WatchlistItem = {
  kind: "anime" | "manga" | "anime_episode" | "manga_chapter";

  // what the user watchlisted (series id OR episode/chapter id)
  id: string;

  // parent series id (used for poster + badges)
  parentId: string;

  // series slug (used to route)
  slug: string | null;

  posterUrl: string | null;
  title: string;

  // used for sorting
  addedAt: string | null;

  // optional badges (same look as library)
  stars: number | null; // 0..5 (converted)
  liked: boolean;
  reviewed: boolean;

  // routing for chapter/episode
  chapterNumber: number | null;
  episodeNumber: number | null;
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

/** ===== Cover picking logic (same behavior as your chapter page) ===== */

function normVol(v: any): string | null {
  const s0 = String(v ?? "").trim();
  if (!s0) return null;
  if (s0.toLowerCase() === "none") return null;

  if (/^\d+(\.\d+)?$/.test(s0)) {
    const n = Number(s0);
    if (!Number.isFinite(n) || n <= 0) return null;
    return String(Math.trunc(n));
  }

  const m = s0.match(/(\d+)/);
  if (m?.[1]) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) return String(Math.trunc(n));
  }

  return s0;
}

function pickBestCoverUrl(rows: CoverRow[]): string | null {
  const usable = (rows || []).filter((r) => r?.cached_url);
  if (!usable.length) return null;

  const mains = usable.filter((r) => r.is_main);
  const pool = mains.length ? mains : usable;

  const pref = ["en", "ja"];
  for (const p of pref) {
    const hit = pool.find((r) => (r.locale || "").toLowerCase() === p && r.cached_url);
    if (hit?.cached_url) return hit.cached_url;
  }

  return pool[0].cached_url ?? null;
}

/**
 * Build a per-manga lookup: chapterNumber -> best cover URL
 * Uses your same "carry forward last volume cover" behavior.
 */
function buildChapterCoverLookup(args: {
  volumeMap: Record<string, string[]> | null;
  covers: CoverRow[];
  totalChapters: number | null;
}): Record<number, string | null> {
  const { volumeMap, covers, totalChapters } = args;

  if (!volumeMap) return {};

  // group covers by volume -> best url
  const byVol: Record<string, CoverRow[]> = {};
  for (const r of covers) {
    const v = normVol(r.volume);
    if (!v) continue;
    if (!byVol[v]) byVol[v] = [];
    byVol[v].push(r);
  }

  const coverUrlByVolume: Record<string, string | null> = {};
  for (const v of Object.keys(byVol)) {
    coverUrlByVolume[v] = pickBestCoverUrl(byVol[v]);
  }

  const navGroups: NavGroup[] = buildChapterNavGroups({
    volumeMap,
    totalChapters,
    chunkSize: 25,
  });

  const chapterCoverByNumber: Record<number, string | null> = {};
  let lastVolumeCover: string | null = null;

  for (const g of navGroups) {
    if (g.kind === "volume") {
      const key = String(g.key || "");
      const rawVol =
        key.startsWith("vol:") ? key.slice(4) : key.startsWith("vol-") ? key.slice(4) : key;

      const v = normVol(rawVol);
      const cover = v ? coverUrlByVolume[v] ?? null : null;
      if (cover) lastVolumeCover = cover;

      for (const ch of g.chapters) chapterCoverByNumber[ch] = cover;
    } else {
      for (const ch of g.chapters) chapterCoverByNumber[ch] = lastVolumeCover;
    }
  }

  return chapterCoverByNumber;
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
        // 1) pull ALL watchlist marks (series + episode + chapter)
        const { data: watchRows, error: watchErr } = await supabase
          .from("user_marks")
          .select(
            "id, user_id, kind, anime_id, manga_id, anime_episode_id, manga_chapter_id, stars, created_at"
          )
          .eq("user_id", profileId)
          .eq("kind", "watchlist");

        if (cancelled) return;

        if (watchErr) {
          setItems([]);
          return;
        }

        const watchMarks = (watchRows || []) as MarkRow[];

        // parent series ids (for posters + badges + reviewed)
        const animeIds = Array.from(
          new Set(
            watchMarks.map((r) => (r.anime_id ? String(r.anime_id) : null)).filter(Boolean) as string[]
          )
        );

        const mangaIds = Array.from(
          new Set(
            watchMarks.map((r) => (r.manga_id ? String(r.manga_id) : null)).filter(Boolean) as string[]
          )
        );

        // episode/chapter ids (for routing/title labeling)
        const episodeIds = Array.from(
          new Set(
            watchMarks
              .map((r) => (r.anime_episode_id ? String(r.anime_episode_id) : null))
              .filter(Boolean) as string[]
          )
        );

        const chapterIds = Array.from(
          new Set(
            watchMarks
              .map((r) => (r.manga_chapter_id ? String(r.manga_chapter_id) : null))
              .filter(Boolean) as string[]
          )
        );

        // 2) liked/rating marks for badges (series-level)
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

        for (const mk of (badgeRows || []) as any[]) {
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

        // 3) pull series metadata (posters + titles + slugs + total chapters for cover picking)
        const [animeRes, mangaRes] = await Promise.all([
          animeIds.length
            ? supabase.from("anime").select("id, slug, title, title_english, image_url").in("id", animeIds)
            : Promise.resolve({ data: [] as any[] }),
          mangaIds.length
            ? supabase
              .from("manga")
              .select("id, slug, title, title_english, image_url, total_chapters")
              .in("id", mangaIds)
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
            total_chapters:
              typeof m.total_chapters === "number" && Number.isFinite(m.total_chapters)
                ? m.total_chapters
                : m.total_chapters != null && String(m.total_chapters).trim() !== ""
                  ? Number(m.total_chapters)
                  : null,
          };
        });

        // 4) optional reviewed badges (series-level)
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

        // 5) fetch chapter/episode numbers for routing
        // NOTE: If your table/columns differ, only change these select()s.
        const [chapRes, epsRes] = await Promise.all([
          chapterIds.length
            ? supabase.from("manga_chapters").select("id, manga_id, chapter_number").in("id", chapterIds)
            : Promise.resolve({ data: [] as any[] }),

          episodeIds.length
            ? supabase.from("anime_episodes").select("id, anime_id, episode_number").in("id", episodeIds)
            : Promise.resolve({ data: [] as any[] }),
        ]);

        if (cancelled) return;

        const chapterById: Record<string, MangaChapterMeta> = {};
        (chapRes.data || []).forEach((c: any) => {
          if (!c?.id) return;
          chapterById[String(c.id)] = {
            id: String(c.id),
            manga_id: c.manga_id ? String(c.manga_id) : null,
            chapter_number:
              typeof c.chapter_number === "number" && Number.isFinite(c.chapter_number)
                ? c.chapter_number
                : c.chapter_number != null && String(c.chapter_number).trim() !== ""
                  ? Number(c.chapter_number)
                  : null,
          };
        });

        const episodeById: Record<string, AnimeEpisodeMeta> = {};
        (epsRes.data || []).forEach((e: any) => {
          if (!e?.id) return;
          episodeById[String(e.id)] = {
            id: String(e.id),
            anime_id: e.anime_id ? String(e.anime_id) : null,
            episode_number:
              typeof e.episode_number === "number" && Number.isFinite(e.episode_number)
                ? e.episode_number
                : e.episode_number != null && String(e.episode_number).trim() !== ""
                  ? Number(e.episode_number)
                  : null,
          };
        });

        /**
         * 6) SAME CHAPTER COVER SELECTION LOGIC
         * For any manga that appears as a chapter watchlist item,
         * we fetch its volume map + covers and compute chapterNumber -> cover URL.
         */
        const mangaIdsNeedingChapterCovers = Array.from(
          new Set(
            watchMarks
              .filter((r) => r.manga_id && r.manga_chapter_id)
              .map((r) => String(r.manga_id))
          )
        );

        const chapterCoverLookupByMangaId: Record<string, Record<number, string | null>> = {};

        if (mangaIdsNeedingChapterCovers.length) {
          // volume map rows
          const { data: vmRows, error: vmErr } = await supabase
            .from("manga_volume_chapter_map")
            .select("manga_id, mapping")
            .in("manga_id", mangaIdsNeedingChapterCovers)
            .eq("source", "mangadex");

          if (cancelled) return;

          if (!vmErr && Array.isArray(vmRows)) {
            // covers
            const { data: coverRows, error: coverErr } = await supabase
              .from("manga_covers")
              .select("manga_id, volume, locale, cached_url, is_main")
              .in("manga_id", mangaIdsNeedingChapterCovers)
              .not("cached_url", "is", null);

            if (cancelled) return;

            const coversByManga: Record<string, CoverRow[]> = {};
            if (!coverErr && Array.isArray(coverRows)) {
              for (const r of coverRows as any[]) {
                const mid = r?.manga_id ? String(r.manga_id) : "";
                if (!mid) continue;
                if (!coversByManga[mid]) coversByManga[mid] = [];
                coversByManga[mid].push({
                  manga_id: mid,
                  volume: r?.volume ?? null,
                  locale: r?.locale ?? null,
                  cached_url: r?.cached_url ?? null,
                  is_main: r?.is_main ?? null,
                });
              }
            }

            for (const row of vmRows as any[]) {
              const mid = row?.manga_id ? String(row.manga_id) : "";
              if (!mid) continue;

              const mapping: Record<string, string[]> | null =
                row?.mapping && typeof row.mapping === "object" ? (row.mapping as any) : null;

              const meta = mangaById[mid];
              const totalRaw = meta?.total_chapters;
              const total =
                typeof totalRaw === "number" && Number.isFinite(totalRaw) && totalRaw > 0
                  ? Math.floor(totalRaw)
                  : null;

              const lookup = buildChapterCoverLookup({
                volumeMap: mapping,
                covers: coversByManga[mid] || [],
                totalChapters: total,
              });

              chapterCoverLookupByMangaId[mid] = lookup;
            }
          }
        }

        // 7) build final items — one card per watchlist mark (series, chapter, episode)
        const combined: WatchlistItem[] = [];

        for (const mk of watchMarks) {
          const addedAt = mk.created_at ?? null;

          // ANIME EPISODE watchlist
          if (mk.anime_episode_id) {
            const parentId = mk.anime_id ? String(mk.anime_id) : null;
            if (!parentId) continue;

            const a = animeById[parentId];
            if (!a) continue;

            const baseTitle = (a.title_english || a.title || "").trim() || "Untitled";
            const ep = episodeById[String(mk.anime_episode_id)];
            const epNum =
              ep && typeof ep.episode_number === "number" && Number.isFinite(ep.episode_number)
                ? ep.episode_number
                : null;

            combined.push({
              kind: "anime_episode",
              id: String(mk.anime_episode_id),
              parentId,
              slug: a.slug ?? null,
              posterUrl: a.image_url ?? null,
              title: baseTitle,
              addedAt,
              stars: ratingAnime[parentId] ?? null,
              liked: likedAnime.has(parentId),
              reviewed: reviewedAnime.has(parentId),
              chapterNumber: null,
              episodeNumber: epNum,
            });

            continue;
          }

          // MANGA CHAPTER watchlist (WITH chapter-specific cover selection)
          if (mk.manga_chapter_id) {
            const parentId = mk.manga_id ? String(mk.manga_id) : null;
            if (!parentId) continue;

            const m = mangaById[parentId];
            if (!m) continue;

            const baseTitle = (m.title_english || m.title || "").trim() || "Untitled";

            const ch = chapterById[String(mk.manga_chapter_id)];
            const chNum =
              ch && typeof ch.chapter_number === "number" && Number.isFinite(ch.chapter_number)
                ? ch.chapter_number
                : null;

            const chapterCover =
              chNum != null ? chapterCoverLookupByMangaId[parentId]?.[chNum] ?? null : null;

            combined.push({
              kind: "manga_chapter",
              id: String(mk.manga_chapter_id),
              parentId,
              slug: m.slug ?? null,
              // ✅ prefer the computed chapter cover; fallback to series image_url
              posterUrl: chapterCover ?? m.image_url ?? null,
              title: baseTitle,
              addedAt,
              stars: ratingManga[parentId] ?? null,
              liked: likedManga.has(parentId),
              reviewed: reviewedManga.has(parentId),
              chapterNumber: chNum,
              episodeNumber: null,
            });

            continue;
          }

          // ANIME SERIES watchlist
          if (mk.anime_id) {
            const id = String(mk.anime_id);
            const a = animeById[id];
            if (!a) continue;

            const title = (a.title_english || a.title || "").trim() || "Untitled";

            combined.push({
              kind: "anime",
              id,
              parentId: id,
              slug: a.slug ?? null,
              posterUrl: a.image_url ?? null,
              title,
              addedAt,
              stars: ratingAnime[id] ?? null,
              liked: likedAnime.has(id),
              reviewed: reviewedAnime.has(id),
              chapterNumber: null,
              episodeNumber: null,
            });

            continue;
          }

          // MANGA SERIES watchlist
          if (mk.manga_id) {
            const id = String(mk.manga_id);
            const m = mangaById[id];
            if (!m) continue;

            const title = (m.title_english || m.title || "").trim() || "Untitled";

            combined.push({
              kind: "manga",
              id,
              parentId: id,
              slug: m.slug ?? null,
              posterUrl: m.image_url ?? null,
              title,
              addedAt,
              stars: ratingManga[id] ?? null,
              liked: likedManga.has(id),
              reviewed: reviewedManga.has(id),
              chapterNumber: null,
              episodeNumber: null,
            });

            continue;
          }
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
            let href = "#";

            // series routes
            if (it.slug && it.kind === "anime") href = `/anime/${it.slug}`;
            if (it.slug && it.kind === "manga") href = `/manga/${it.slug}`;

            // ✅ your chapter route pattern:
            // pages/manga/[slug]/chapter/[chapterNumber].tsx
            if (it.slug && it.kind === "manga_chapter" && it.chapterNumber != null) {
              href = `/manga/${it.slug}/chapter/${it.chapterNumber}`;
            }

            // NOTE: I still don't know your anime episode route pattern.
            // Safe fallback to anime series page for now.
            if (it.slug && it.kind === "anime_episode") {
              href = `/anime/${it.slug}`;
            }

            return (
              <Link key={`${it.kind}:${it.id}`} href={href} title={it.title} className="group block">
                <div className="relative w-full aspect-[2/3] overflow-visible">
                  <div className="relative w-full h-full overflow-hidden rounded-[4px] bg-slate-200 border-2 border-black group-hover:border-slate-400 transition">
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

                {/* label under poster so chapter cards are actually distinguishable */}
                <div className="mt-1">
                  {/* row 1: series title (bigger + bold) */}
                  <div className="text-[13px] font-semibold leading-snug text-black line-clamp-1">
                    {it.title}
                  </div>

                  {/* row 2: chapter/episode number (same size, now black) */}
                  {it.kind === "manga_chapter" ? (
                    <div className="text-[12px] leading-snug text-black">
                      {it.chapterNumber != null ? `Chapter ${it.chapterNumber}` : "Chapter"}
                    </div>
                  ) : it.kind === "anime_episode" ? (
                    <div className="text-[12px] leading-snug text-black">
                      {it.episodeNumber != null ? `Episode ${it.episodeNumber}` : "Episode"}
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
