// components/anime/AnimeQuickLogRowMobile.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Check } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { createAnimeEpisodeLog } from "@/lib/logs";
import AnimeEpisodeThumb from "@/components/anime/AnimeEpisodeThumb";

type EpisodeRow = {
  id: string;
  anime_id: string;
  episode_number: number;
  title: string | null;
};

type Props = {
  animeId: string;
  slug?: string;
  episodes: EpisodeRow[];
  canInteract: boolean;
  refreshToken?: number;
  onOpenLog: (episodeId?: string) => void;
  onMessage?: (msg: string | null) => void;
  onLogCreated?: () => void;
};

const SWIPE_COMMIT = 160;

const AUTO_SWIPE_MS = 320;
const AUTO_HOLD_MS = 140;
const AUTO_RETURN_MS = 240;

const REVIEW_POLL_MS = 400;
const REVIEW_POLL_MAX_MS = 12000;

export default function AnimeQuickLogRowMobile({
  animeId,
  slug,
  episodes,
  canInteract,
  refreshToken,
  onOpenLog,
  onMessage,
  onLogCreated,
}: Props) {
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [maxLoggedNumber, setMaxLoggedNumber] = useState<number | null>(null);

  const [swipeX, setSwipeX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const [autoPhase, setAutoPhase] = useState<"idle" | "swiping" | "holding" | "returning">("idle");

  const dragStartXRef = useRef<number | null>(null);
  const startSwipeXRef = useRef<number>(0);
  const committedRef = useRef(false);

  // ✅ measure how far the swipe can go (full width of the swipe row)
  const swipeRowRef = useRef<HTMLDivElement | null>(null);
  const [swipeMax, setSwipeMax] = useState(0);

  useEffect(() => {
    function measure() {
      const el = swipeRowRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      setSwipeMax(Math.max(0, rect.width));
    }

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const isAutoAnimating = autoPhase !== "idle";
  const lockInput = busy || isAutoAnimating;

  const pendingReviewEpisodeRef = useRef<EpisodeRow | null>(null);
  const reviewPollTimerRef = useRef<any>(null);
  const reviewPollStartedAtRef = useRef<number>(0);

  const episodeById = useMemo(() => {
    const map: Record<string, EpisodeRow> = {};
    for (const e of episodes) map[e.id] = e;
    return map;
  }, [episodes]);

  const sortedEpisodes = useMemo(() => {
    return episodes
      .filter(
        (e) =>
          typeof e.episode_number === "number" &&
          Number.isFinite(e.episode_number) &&
          e.episode_number > 0
      )
      .slice()
      .sort((a, b) => a.episode_number - b.episode_number);
  }, [episodes]);

  function getEpisodeAfter(ep: EpisodeRow): EpisodeRow | null {
    return sortedEpisodes.find((e) => e.episode_number > ep.episode_number) ?? null;
  }

  const nextEpisode = useMemo(() => {
    if (sortedEpisodes.length === 0) return null;
    if (maxLoggedNumber === null) return sortedEpisodes[0];
    const found = sortedEpisodes.find((e) => e.episode_number > maxLoggedNumber);
    return found ?? null;
  }, [sortedEpisodes, maxLoggedNumber]);

  const resolvedSlug = useMemo(() => {
    if (typeof slug === "string" && slug.trim()) return slug.trim();

    const q = router.query?.slug;
    if (typeof q === "string" && q.trim()) return q.trim();
    if (Array.isArray(q) && typeof q[0] === "string" && q[0].trim()) return q[0].trim();

    return null;
  }, [slug, router.query]);

  useEffect(() => {
    if (!animeId) return;
    if (!Array.isArray(episodes) || episodes.length === 0) return;

    let cancelled = false;

    async function run() {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (userErr || !user) {
        setMaxLoggedNumber(null);
        return;
      }

      const { data, error } = await supabase
        .from("anime_episode_logs")
        .select("anime_episode_id")
        .eq("anime_id", animeId)
        .eq("user_id", user.id)
        .limit(5000);

      if (cancelled) return;

      if (error || !data) {
        console.warn("[AnimeQuickLogRowMobile] failed to load episode logs:", error);
        setMaxLoggedNumber(null);
        return;
      }

      let maxNum: number | null = null;

      for (const row of data as any[]) {
        const eid = row?.anime_episode_id as string | null;
        if (!eid) continue;

        const ep = episodeById[eid];
        const n = ep?.episode_number;

        if (typeof n !== "number" || !Number.isFinite(n)) continue;
        if (maxNum === null || n > maxNum) maxNum = n;
      }

      setMaxLoggedNumber(maxNum);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [animeId, episodes, refreshToken, episodeById]);

  function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
  }

  function isInteractiveTarget(target: EventTarget | null) {
    const el = target as HTMLElement | null;
    if (!el) return false;
    return Boolean(
      el.closest(
        'button, a, input, textarea, select, label, [role="button"], [data-no-swipe="true"]'
      )
    );
  }

  function stopReviewPoll() {
    if (reviewPollTimerRef.current) {
      clearInterval(reviewPollTimerRef.current);
      reviewPollTimerRef.current = null;
    }
    reviewPollStartedAtRef.current = 0;
  }

  async function startReviewPoll(ep: EpisodeRow) {
    stopReviewPoll();
    pendingReviewEpisodeRef.current = ep;
    reviewPollStartedAtRef.current = Date.now();

    reviewPollTimerRef.current = setInterval(async () => {
      const pending = pendingReviewEpisodeRef.current;
      if (!pending) {
        stopReviewPoll();
        return;
      }

      if (Date.now() - reviewPollStartedAtRef.current > REVIEW_POLL_MAX_MS) {
        stopReviewPoll();
        pendingReviewEpisodeRef.current = null;
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("anime_episode_logs")
        .select("id")
        .eq("anime_id", animeId)
        .eq("user_id", user.id)
        .eq("anime_episode_id", pending.id)
        .limit(1);

      if (error) return;
      if (!data || data.length === 0) return;

      stopReviewPoll();
      pendingReviewEpisodeRef.current = null;

      setMaxLoggedNumber((prev) => {
        const n = pending.episode_number;
        if (typeof n !== "number" || !Number.isFinite(n)) return prev;
        if (prev === null) return n;
        return Math.max(prev, n);
      });

      onLogCreated?.();

      const next = getEpisodeAfter(pending);
      if (resolvedSlug && next) {
        router.push(`/anime/${resolvedSlug}/episode/${next.episode_number}`, undefined, {
          scroll: false,
        });
      }
    }, REVIEW_POLL_MS);
  }

  useEffect(() => {
    return () => {
      stopReviewPoll();
    };
  }, []);

  async function createWatchedMark(params: { userId: string; episodeId: string }) {
    const del = await supabase
      .from("user_marks")
      .delete()
      .eq("user_id", params.userId)
      .eq("kind", "watched")
      .eq("anime_id", animeId)
      .eq("anime_episode_id", params.episodeId)
      .is("manga_id", null)
      .is("manga_chapter_id", null);

    if (del.error) {
      console.error("[AnimeQuickLogRowMobile] watched mark delete failed:", del.error);
      return { error: del.error };
    }

    const ins = await supabase.from("user_marks").insert({
      user_id: params.userId,
      kind: "watched",
      anime_id: animeId,
      anime_episode_id: params.episodeId,
    });

    if (ins.error) {
      console.error("[AnimeQuickLogRowMobile] watched mark insert failed:", ins.error);
      return { error: ins.error };
    }

    return { error: null as any };
  }

  async function quickLogWithWatched(ep: EpisodeRow) {
    if (!ep?.id) return;

    setBusy(true);
    onMessage?.(null);

    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) {
        onMessage?.("You must be logged in to log.");
        return;
      }

      const watchedRes = await createWatchedMark({ userId: user.id, episodeId: ep.id });
      if (watchedRes.error) {
        onMessage?.("Couldn’t log (watched mark failed).");
        return;
      }

      const { error } = await createAnimeEpisodeLog({
        anime_id: animeId,
        anime_episode_id: ep.id,
        rating: null,
        liked: false,
        review_id: null,
        note: null,
        contains_spoilers: false,
      });

      if (error) {
        console.error("[AnimeQuickLogRowMobile] createAnimeEpisodeLog failed:", error);
        onMessage?.("Couldn’t log (see console).");
        return;
      }

      onLogCreated?.();

      setMaxLoggedNumber((prev) => {
        const n = ep.episode_number;
        if (typeof n !== "number" || !Number.isFinite(n)) return prev;
        if (prev === null) return n;
        return Math.max(prev, n);
      });

      const next = getEpisodeAfter(ep);

      if (resolvedSlug && next) {
        router.push(`/anime/${resolvedSlug}/episode/${next.episode_number}`, undefined, {
          scroll: false,
        });
      }

      onMessage?.(`Logged Ep ${ep.episode_number} ✅`);
    } finally {
      setBusy(false);
    }
  }

  async function animateSwipeAndLog(ep: EpisodeRow) {
    if (!ep?.id) return;
    if (!canInteract) return;
    if (lockInput) return;

    committedRef.current = true;

    setAutoPhase("swiping");
    setSwipeX(swipeMax);
    await new Promise((r) => setTimeout(r, AUTO_SWIPE_MS));

    setAutoPhase("holding");
    await new Promise((r) => setTimeout(r, AUTO_HOLD_MS));

    await quickLogWithWatched(ep);

    setAutoPhase("returning");
    setSwipeX(0);
    await new Promise((r) => setTimeout(r, AUTO_RETURN_MS));

    committedRef.current = false;
    setAutoPhase("idle");
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!nextEpisode) return;
    if (!canInteract) return;
    if (lockInput) return;

    if (isInteractiveTarget(e.target)) return;
    // @ts-ignore
    if (e.pointerType === "mouse" && e.button !== 0) return;

    committedRef.current = false;
    setIsDragging(true);

    dragStartXRef.current = e.clientX;
    startSwipeXRef.current = swipeX;

    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!isDragging) return;
    if (dragStartXRef.current === null) return;

    const dx = e.clientX - dragStartXRef.current;
    const next = clamp(startSwipeXRef.current + dx, 0, swipeMax);
    setSwipeX(next);
  }

  async function onPointerUpOrCancel(e: React.PointerEvent) {
    if (!isDragging) return;
    setIsDragging(false);

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}

    if (!nextEpisode) {
      setSwipeX(0);
      committedRef.current = false;
      return;
    }

    if (swipeX >= SWIPE_COMMIT && !committedRef.current) {
      await animateSwipeAndLog(nextEpisode);
      return;
    }

    setSwipeX(0);
    committedRef.current = false;
  }

  const title =
    nextEpisode && typeof nextEpisode.title === "string" && nextEpisode.title.trim()
      ? nextEpisode.title.trim()
      : null;

  const isDisabled = !canInteract || busy;

  const transition = useMemo(() => {
    if (isDragging) return "none";
    if (autoPhase === "swiping") return `transform ${AUTO_SWIPE_MS}ms cubic-bezier(0.2, 0.9, 0.2, 1)`;
    if (autoPhase === "returning") return `transform ${AUTO_RETURN_MS}ms cubic-bezier(0.2, 0.9, 0.2, 1)`;
    return "transform 180ms cubic-bezier(0.2, 0.9, 0.2, 1)";
  }, [isDragging, autoPhase]);

  return (
    <div className="border-b border-gray-800 bg-black">
      {/* header row (mobile: tighter vertical space) */}
      <div className="border-b border-gray-700/80 bg-black">
        <div className="px-3 py-2">
          <div className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-300">
            Quick Log
          </div>
        </div>
      </div>

      {sortedEpisodes.length === 0 ? (
        <div className="px-3 py-2 text-xs text-gray-400">No episodes.</div>
      ) : !nextEpisode ? (
        <div className="px-3 py-2 text-xs text-gray-400">You’re caught up ✅</div>
      ) : (
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center bg-green-500">
            <div className="text-[14px] font-semibold text-white">Episode Logged</div>
          </div>

          <div
            ref={swipeRowRef}
            className={[
              "relative border-x border-gray-800 bg-black",
              isDisabled ? "opacity-80" : "",
              // mobile: keep pan-y and feel snappy
              "touch-pan-y select-none cursor-pointer",
            ].join(" ")}
            style={{
              transform: `translateX(${swipeX}px)`,
              transition,
              willChange: "transform",
              touchAction: "pan-y",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUpOrCancel}
            onPointerCancel={onPointerUpOrCancel}
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <div className="-ml-3 -my-2.5 w-24 shrink-0 overflow-hidden rounded-xs bg-black/20">
                  <AnimeEpisodeThumb
                    episodeId={nextEpisode.id}
                    alt=""
                    showPlaceholder
                    className="h-auto w-full object-contain"
                  />
                </div>

                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-gray-100">
                    Ep {nextEpisode.episode_number}
                  </div>
                  {title ? (
                    <div className="mt-0.5 truncate text-[11px] text-gray-500">{title}</div>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  data-no-swipe="true"
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    startReviewPoll(nextEpisode);
                    onOpenLog(nextEpisode.id);
                  }}
                  className={[
                    "relative rounded-lg border px-3.5 py-2 text-[11px] font-semibold",
                    "transition-all duration-150 cursor-pointer",
                    "border-gray-700 text-gray-200",
                    "hover:border-sky-500/70 hover:bg-sky-500/10",
                    "active:bg-sky-500/20 active:scale-[0.98]",
                    "focus:outline-none focus:ring-2 focus:ring-sky-500/30",
                    isDisabled ? "opacity-60 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  Review
                </button>

                <button
                  data-no-swipe="true"
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    if (!nextEpisode) return;
                    animateSwipeAndLog(nextEpisode);
                  }}
                  className={[
                    "relative inline-flex h-9 w-9 items-center justify-center rounded-full border",
                    "transition-all duration-150 cursor-pointer",
                    "border-gray-700 text-gray-200",
                    "hover:border-sky-400 hover:bg-sky-500/20",
                    "active:scale-95",
                    "focus:outline-none focus:ring-2 focus:ring-sky-500/40",
                    isDisabled ? "opacity-60 cursor-not-allowed" : "",
                  ].join(" ")}
                  aria-label={`Quick log episode ${nextEpisode.episode_number}`}
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
