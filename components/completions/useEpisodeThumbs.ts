"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getAnimeBySlug } from "@/lib/anime";

type EpisodeRow = {
  id: string;
  episode_number: number;
  title: string | null;
};

type ArtworkRow = {
  anime_episode_id: string;
  url: string | null;
  source: string | null;
  vote: number | null;
  is_primary: boolean | null;
  width: number | null;
};

export type EpisodeMeta = {
  title: string | null;
  imageUrl: string | null;
};

function normalizeThumbUrl(url: string) {
  if (!url) return url;

  if (url.includes("https://image.tmdb.org/t/p/")) {
    return url.replace(/\/t\/p\/(original|w1280|w780|w500|w342|w300|w185)\//, "/t/p/w500/");
  }

  return url;
}

function pickBestArtwork(rows: ArtworkRow[]): string | null {
  const usable = rows.filter((r) => r.url);
  if (usable.length === 0) return null;

  usable.sort((a, b) => {
    const ap = a.is_primary ? 1 : 0;
    const bp = b.is_primary ? 1 : 0;
    if (bp !== ap) return bp - ap;

    const av = a.vote ?? -9999;
    const bv = b.vote ?? -9999;
    if (bv !== av) return bv - av;

    const aw = a.width ?? -9999;
    const bw = b.width ?? -9999;
    return bw - aw;
  });

  return usable[0].url ?? null;
}

/**
 * Fetches episode title + best artwork for given episode numbers.
 * Adds loadedByNumber so the UI can avoid "fallback flashing" before fetch completes.
 */
export function useEpisodeThumbs(params: {
  slug: string | null;
  numbers: number[];
  enabled?: boolean;
}) {
  const { slug, numbers, enabled = true } = params;

  const [animeId, setAnimeId] = useState<string | null>(null);
  const [metaByNumber, setMetaByNumber] = useState<Record<number, EpisodeMeta>>({});
  const [loadedByNumber, setLoadedByNumber] = useState<Record<number, boolean>>({});

  const inflightRef = useRef<Set<number>>(new Set());

  const wantedKey = useMemo(() => {
    if (!enabled || !slug) return "";
    const uniq = Array.from(new Set(numbers.filter((n) => Number.isFinite(n) && n > 0))).sort((a, b) => a - b);
    return `${slug}::${uniq.join(",")}`;
  }, [enabled, slug, numbers]);

  // load animeId from slug (same as EpisodeNavigator)
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setAnimeId(null);
      if (!enabled || !slug) return;

      const { data: anime, error } = await getAnimeBySlug(slug);
      if (cancelled) return;
      if (error || !anime?.id) return;

      setAnimeId(anime.id);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [enabled, slug]);

  // fetch metas for visible numbers (batched)
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!enabled) return;
      if (!slug) return;
      if (!animeId) return;

      const uniq = Array.from(new Set(numbers.filter((n) => Number.isFinite(n) && n > 0))).sort((a, b) => a - b);

      // only those we don't already have and aren't inflight
      const wanted = uniq.filter((n) => !metaByNumber[n] && !inflightRef.current.has(n));
      if (wanted.length === 0) return;

      const batch = wanted.slice(0, 60);
      batch.forEach((n) => inflightRef.current.add(n));

      const { data: eps, error: epsErr } = await supabase
        .from("anime_episodes")
        .select("id, episode_number, title")
        .eq("anime_id", animeId)
        .in("episode_number", batch);

      if (cancelled) return;

      if (epsErr || !eps) {
        batch.forEach((n) => inflightRef.current.delete(n));
        // ✅ still mark these as "loaded attempted" so UI can fallback if needed
        if (!cancelled) {
          setLoadedByNumber((prev) => {
            const next = { ...prev };
            for (const n of batch) next[n] = true;
            return next;
          });
        }
        return;
      }

      const episodeRows = eps as EpisodeRow[];

      const idByNumber: Record<number, string> = {};
      const titleByNumber: Record<number, string | null> = {};

      for (const e of episodeRows) {
        if (typeof e.episode_number !== "number") continue;
        idByNumber[e.episode_number] = e.id;
        titleByNumber[e.episode_number] = e.title ?? null;
      }

      const episodeIds = Object.values(idByNumber);
      const byEpisodeId: Record<string, ArtworkRow[]> = {};

      if (episodeIds.length > 0) {
        const { data: arts, error: artsErr } = await supabase
          .from("anime_episode_artwork")
          .select("anime_episode_id, url, source, vote, is_primary, width")
          .in("anime_episode_id", episodeIds);

        if (!artsErr && arts) {
          for (const r of arts as ArtworkRow[]) {
            if (!r?.anime_episode_id) continue;
            if (!byEpisodeId[r.anime_episode_id]) byEpisodeId[r.anime_episode_id] = [];
            byEpisodeId[r.anime_episode_id].push(r);
          }
        }
      }

      const patch: Record<number, EpisodeMeta> = {};
      const loadedPatch: Record<number, boolean> = {};

      for (const n of batch) {
        const epId = idByNumber[n];
        const best = epId && byEpisodeId[epId] ? pickBestArtwork(byEpisodeId[epId]) : null;

        patch[n] = {
          title: titleByNumber[n] ?? null,
          imageUrl: best ? normalizeThumbUrl(best) : null,
        };

        // ✅ mark "we attempted this episode number"
        loadedPatch[n] = true;
      }

      batch.forEach((n) => inflightRef.current.delete(n));

      if (!cancelled && Object.keys(patch).length > 0) {
        setMetaByNumber((prev) => ({ ...prev, ...patch }));
        setLoadedByNumber((prev) => ({ ...prev, ...loadedPatch }));
      }

      // if there are still wanted numbers, run again next tick
      if (!cancelled && wanted.length > 60) {
        queueMicrotask(() => {
          if (!cancelled) run();
        });
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, slug, animeId, wantedKey]);

  return { metaByNumber, loadedByNumber };
}
