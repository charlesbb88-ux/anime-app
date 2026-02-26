// components/EpisodeNavigatorMobile.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getAnimeBySlug } from "@/lib/anime";
import { FALLBACK_BACKDROP_SRC } from "@/lib/fallbacks";
import SmartBackdropImage from "@/components/SmartBackdropImage";

type Props = {
  slug: string;
  totalEpisodes?: number | null;
  currentEpisodeNumber?: number | null;
  className?: string;
};

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

type EpisodeMeta = {
  title: string | null;
  imageUrl: string | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function pad2(n: number) {
  return String(n).padStart(2, "0");
}

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

function findEpisodeIndex(nums: number[], target: number) {
  const EPS = 1e-6;
  for (let i = 0; i < nums.length; i++) {
    if (Math.abs(nums[i] - target) < EPS) return i;
  }
  return -1;
}

export default function EpisodeNavigatorMobile({
  slug,
  totalEpisodes,
  currentEpisodeNumber,
  className,
}: Props) {
  // ---------------- totals (prop or derived) ----------------
  const propTotal =
    typeof totalEpisodes === "number" &&
      Number.isFinite(totalEpisodes) &&
      totalEpisodes > 0
      ? Math.floor(totalEpisodes)
      : null;

  const [animeId, setAnimeId] = useState<string | null>(null);
  const [animePosterUrl, setAnimePosterUrl] = useState<string | null>(null);
  const [derivedTotalEpisodes, setDerivedTotalEpisodes] = useState<number | null>(
    null
  );

  const total = propTotal ?? derivedTotalEpisodes;
  const hasTotal = typeof total === "number" && Number.isFinite(total) && total > 0;
  const cappedTotal = hasTotal ? Math.min(total as number, 2000) : null;

  const current =
    typeof currentEpisodeNumber === "number" && Number.isFinite(currentEpisodeNumber)
      ? currentEpisodeNumber
      : null;

  const currentSafe =
    typeof current === "number" && Number.isFinite(current) && current > 0
      ? current
      : null;

  const animeHref = `/anime/${encodeURIComponent(slug)}`;
  const episodeBase = `${animeHref}/episode`;

  const displayEpisodes: number[] = useMemo(() => {
    if (!hasTotal || !cappedTotal) return [];
    const nums: number[] = [];
    for (let i = 1; i <= cappedTotal; i++) nums.push(i);
    return nums;
  }, [hasTotal, cappedTotal]);

  const episodeCount = displayEpisodes.length;

  // ---------------- anime id lookup ----------------
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setAnimeId(null);
      setDerivedTotalEpisodes(null);

      if (!slug) return;

      const { data: anime, error } = await getAnimeBySlug(slug);
      if (cancelled) return;
      if (error || !anime?.id) return;

      setAnimeId(anime.id);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // ---------------- series poster fallback (fetch once per animeId) ----------------
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setAnimePosterUrl(null);
      if (!animeId) return;

      const { data, error } = await supabase
        .from("anime")
        .select("image_url")
        .eq("id", animeId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error("EpisodeNavigatorMobile: anime poster fetch error:", error);
        setAnimePosterUrl(null);
        return;
      }

      setAnimePosterUrl(data?.image_url ?? null);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [animeId]);

  // ---------------- derive total episodes (mobile only) ----------------
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setDerivedTotalEpisodes(null);
      if (!animeId) return;
      if (propTotal) return; // if prop exists, don't do extra work

      const { data, error } = await supabase
        .from("anime_episodes")
        .select("episode_number")
        .eq("anime_id", animeId)
        .order("episode_number", { ascending: false })
        .limit(1);

      if (cancelled) return;
      if (error || !Array.isArray(data) || data.length === 0) return;

      const raw = (data[0] as any)?.episode_number;
      const n = typeof raw === "number" ? raw : Number(raw);

      if (Number.isFinite(n) && n > 0) setDerivedTotalEpisodes(Math.floor(n));
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [animeId, propTotal]);

  // ---------------- meta cache (lazy, window-only) ----------------
  const [metaByNumber, setMetaByNumber] = useState<Record<number, EpisodeMeta>>(
    {}
  );

  useEffect(() => {
    // reset caches when slug changes (or anime changes)
    setMetaByNumber({});
  }, [slug]);

  // ---------------- mobile virtualization + buttery scroll ----------------
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const didInitialCenterRef = useRef(false);

  const [viewportW, setViewportW] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const rafRef = useRef<number | null>(null);
  const lastEmitMsRef = useRef(0);
  const liveScrollLeftRef = useRef(0);

  // layout tuned for mobile (episode card is wide)
  const CARD_W = 240;
  const GAP = 12;
  const STEP = CARD_W + GAP;

  // measure viewport width
  useEffect(() => {
    function update() {
      const node = scrollerRef.current;
      if (!node) return;
      setViewportW(node.clientWidth || 0);
    }

    update();

    const node = scrollerRef.current;
    if (!node) return;

    const ro = new ResizeObserver(() => update());
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;

    liveScrollLeftRef.current = el.scrollLeft;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;

      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      if (now - lastEmitMsRef.current < 48) return; // ~20fps
      lastEmitMsRef.current = now;

      setScrollLeft(liveScrollLeftRef.current);
    });
  }

  const VBUF = 10;

  const { leftPx, rightPx, visibleEpisodeNumbers } = useMemo(() => {
    if (episodeCount <= 0) {
      return { leftPx: 0, rightPx: 0, visibleEpisodeNumbers: [] as number[] };
    }

    const maxIdx = episodeCount - 1;

    const vw = viewportW || 0;
    const left = scrollLeft || 0;

    const approxStart = Math.floor(left / STEP) - VBUF;
    const approxEnd = Math.ceil((left + vw) / STEP) + VBUF;

    const s = clamp(approxStart, 0, maxIdx);
    const e = clamp(approxEnd, 0, maxIdx);

    const nums: number[] = [];
    for (let i = s; i <= e; i++) nums.push(displayEpisodes[i]);

    return {
      leftPx: s * STEP,
      rightPx: (maxIdx - e) * STEP,
      visibleEpisodeNumbers: nums,
    };
  }, [episodeCount, displayEpisodes, viewportW, scrollLeft]);

  // initial scroll to current (re-run when currentSafe becomes available)
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (!viewportW) return;
    if (episodeCount <= 0) return;

    if (!currentSafe) {
      didInitialCenterRef.current = false;
      return;
    }

    if (didInitialCenterRef.current) return;

    let idx = findEpisodeIndex(displayEpisodes, currentSafe);
    if (idx < 0) idx = 0;

    idx = clamp(idx, 0, Math.max(0, episodeCount - 1));

    requestAnimationFrame(() => {
      const target = idx * STEP + CARD_W / 2 - viewportW / 2;
      el.scrollLeft = Math.max(0, target);

      liveScrollLeftRef.current = el.scrollLeft;
      setScrollLeft(el.scrollLeft);
      didInitialCenterRef.current = true;
    });
  }, [viewportW, episodeCount, currentSafe, displayEpisodes.join("|")]);

  // fetch meta for visible window (titles + artwork) — no observer needed
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!animeId) return;
      if (!visibleEpisodeNumbers.length) return;

      const missing = visibleEpisodeNumbers.filter((n) => !metaByNumber[n]);
      if (missing.length === 0) return;

      const wantedNums = missing.slice(0, 60);

      const { data: eps, error: epsErr } = await supabase
        .from("anime_episodes")
        .select("id, episode_number, title")
        .eq("anime_id", animeId)
        .in("episode_number", wantedNums);

      if (cancelled) return;

      if (epsErr || !eps) {
        setMetaByNumber((prev) => {
          const next = { ...prev };
          for (const n of wantedNums) if (!next[n]) next[n] = { title: null, imageUrl: null };
          return next;
        });
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

      for (const n of wantedNums) {
        const epId = idByNumber[n];
        const best =
          epId && byEpisodeId[epId] ? pickBestArtwork(byEpisodeId[epId]) : null;

        patch[n] = {
          title: titleByNumber[n] ?? null,
          imageUrl: best ? normalizeThumbUrl(best) : null,
        };
      }

      if (Object.keys(patch).length > 0) {
        setMetaByNumber((prev) => ({ ...prev, ...patch }));
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animeId, visibleEpisodeNumbers.join("|")]);

  // render guards
  const showNothingYet = !!slug && (!animeId || (!propTotal && !derivedTotalEpisodes));
  if (!showNothingYet && episodeCount <= 0) return null;

  // styles (keep same tokens as desktop)
  const cardBase =
    "group relative shrink-0 rounded-xs bg-[var(--card-bg)] ring-1 ring-[var(--ring)] shadow-sm transition";
  const cardSize = "h-[120px] w-[240px]";
  const thumbSize = "h-full w-[120px] shrink-0";

  return (
    <div
      className={["min-w-0", className ?? ""].join(" ")}
      style={
        {
          "--card-bg": "rgba(245, 250, 255, 1)",
          "--ring": "rgba(245, 250, 255, 1)",
        } as React.CSSProperties
      }
    >
      <div className="w-full overflow-hidden rounded-sm border border-black bg-black">
        <div
          ref={scrollerRef}
          className={[
            "scrollbar-none relative flex overflow-x-auto overflow-y-hidden",
            "px-0 py-2",
          ].join(" ")}
          onScroll={onScroll}
          style={{
            WebkitOverflowScrolling: "touch",
            overscrollBehaviorX: "contain",
          }}
        >
          <div style={{ width: leftPx }} className="shrink-0" />

          <div className="flex gap-3">
            {visibleEpisodeNumbers.map((n) => {
              const meta = metaByNumber[n];
              const title = meta?.title ?? `Episode ${n}`;

              // undefined = meta not loaded yet (don't show fallback)
              // null = loaded but missing (allow poster/final fallback)
              const imageUrl = meta ? meta.imageUrl : undefined;

              const metaLine = `S${pad2(1)} · E${pad2(n)}`;
              const hasSelectedEpisode = typeof currentSafe === "number";
              const isActive = currentSafe === n;

              return (
                <Link
                  key={n}
                  href={`${episodeBase}/${n}`}
                  scroll={false}
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  className={[
                    cardBase,
                    cardSize,

                    // make non-active quieter so current pops
                    hasSelectedEpisode && !isActive ? "opacity-80" : "opacity-100",

                    // active treatment
                    isActive
                      ? [
                        "ring-2 ring-sky-400",
                        "shadow-lg shadow-sky-500/20",
                        "scale-[1.03]",
                        "z-[2]",
                      ].join(" ")
                      : "",
                  ].join(" ")}
                  style={{
                    contentVisibility: "auto",
                    containIntrinsicSize: "120px 240px",
                  }}
                >
                  <div className="flex h-full overflow-hidden rounded-xs">
                    <div className={[thumbSize, "bg-black/5"].join(" ")}>
                      <SmartBackdropImage
                        src={imageUrl} // 1) episode still (undefined while loading)
                        posterFallbackSrc={animePosterUrl} // 2) series poster
                        finalFallbackSrc={FALLBACK_BACKDROP_SRC} // 3) hero fallback
                        alt=""
                        width={500}
                        height={750}
                        priority={false}
                        sizes="120px"
                        className="h-full w-full object-cover"
                        placeholderClassName="h-full w-full"
                      />
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col justify-start px-3 py-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-medium text-black/50">
                          {metaLine}
                        </div>

                        {isActive ? (
                          <div className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_0_3px_rgba(56,189,248,0.18)]" />
                            <span className="text-[10px] font-bold tracking-wide text-sky-300">
                              CURRENT
                            </span>
                          </div>
                        ) : null}
                      </div>

                      <div
                        className="mt-1 text-sm font-semibold text-black/90 break-words leading-snug flex-1 min-h-0"
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 4,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {title}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <div style={{ width: rightPx }} className="shrink-0" />
        </div>
      </div>
    </div>
  );
}
