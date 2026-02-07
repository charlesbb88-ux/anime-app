"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ArtworkRow = {
  anime_episode_id: string;
  url: string | null;
  source: string | null;
  vote: number | null;
  is_primary: boolean | null;
  width: number | null;
};

function normalizeThumbUrl(url: string) {
  if (!url) return url;

  if (url.includes("https://image.tmdb.org/t/p/")) {
    return url.replace(
      /\/t\/p\/(original|w1280|w780|w500|w342|w300|w185)\//,
      "/t/p/w500/"
    );
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

type Props = {
  episodeId: string | null | undefined;

  // optional: style knobs
  className?: string;
  alt?: string;

  // optional: show a placeholder box even if no image
  showPlaceholder?: boolean;
};

export default function AnimeEpisodeThumb({
  episodeId,
  className,
  alt = "",
  showPlaceholder = true,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);

  // tiny in-memory cache (per page load) to avoid refetching the same episode
  const cacheKey = useMemo(() => (episodeId ? `ep:${episodeId}` : null), [episodeId]);
  const mem = (globalThis as any).__ep_art_cache as Map<string, string | null> | undefined;
  const cache: Map<string, string | null> =
    mem ?? (((globalThis as any).__ep_art_cache = new Map()) as Map<string, string | null>);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setUrl(null);
      if (!episodeId) return;

      if (cacheKey && cache.has(cacheKey)) {
        const cached = cache.get(cacheKey) ?? null;
        setUrl(cached);
        return;
      }

      const { data, error } = await supabase
        .from("anime_episode_artwork")
        .select("anime_episode_id, url, source, vote, is_primary, width")
        .eq("anime_episode_id", episodeId);

      if (cancelled) return;

      if (error || !data) {
        if (cacheKey) cache.set(cacheKey, null);
        setUrl(null);
        return;
      }

      const best = pickBestArtwork(data as ArtworkRow[]);
      const finalUrl = best ? normalizeThumbUrl(best) : null;

      if (cacheKey) cache.set(cacheKey, finalUrl);
      setUrl(finalUrl);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [episodeId, cacheKey, cache]);

  if (!url) {
    if (!showPlaceholder) return null;
    return <div className={["bg-black/15", className ?? ""].join(" ")} />;
  }

  return (
    <img
      src={url}
      alt={alt}
      className={["h-full w-full object-cover", className ?? ""].join(" ")}
      draggable={false}
      loading="lazy"
      decoding="async"
    />
  );
}
