"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Check } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { createMangaChapterLog } from "@/lib/logs";

type ChapterRow = {
  id: string;
  manga_id: string;
  chapter_number: number;
  title: string | null;
};

type Props = {
  mangaId: string;
  slug?: string;
  chapters: ChapterRow[];
  canInteract: boolean;
  refreshToken?: number;
  onOpenLog: (chapterId?: string) => void;
  onMessage?: (msg: string | null) => void;
  onLogCreated?: () => void;
};

const SWIPE_MAX = 260;
const SWIPE_COMMIT = 160;

// ✅ TVTime-ish timing for the auto animation
const AUTO_SWIPE_MS = 320; // slide right duration
const AUTO_HOLD_MS = 140; // how long it stays showing the green action
const AUTO_RETURN_MS = 240; // slide back duration

export default function MangaQuickLogRow({
  mangaId,
  slug,
  chapters,
  canInteract,
  refreshToken,
  onOpenLog,
  onMessage,
  onLogCreated,
}: Props) {
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [maxLoggedNumber, setMaxLoggedNumber] = useState<number | null>(null);

  // swipe UI state
  const [swipeX, setSwipeX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // ✅ separate auto-swipe animation state
  const [autoPhase, setAutoPhase] = useState<"idle" | "swiping" | "holding" | "returning">("idle");

  const dragStartXRef = useRef<number | null>(null);
  const startSwipeXRef = useRef<number>(0);
  const committedRef = useRef(false);

  const isAutoAnimating = autoPhase !== "idle";
  const lockInput = busy || isAutoAnimating; // blocks starting new drags while auto anim runs

  const chapterById = useMemo(() => {
    const map: Record<string, ChapterRow> = {};
    for (const c of chapters) map[c.id] = c;
    return map;
  }, [chapters]);

  const sortedChapters = useMemo(() => {
    return chapters
      .filter(
        (c) =>
          typeof c.chapter_number === "number" &&
          Number.isFinite(c.chapter_number) &&
          c.chapter_number > 0
      )
      .slice()
      .sort((a, b) => a.chapter_number - b.chapter_number);
  }, [chapters]);

  function getChapterAfter(ch: ChapterRow): ChapterRow | null {
    return sortedChapters.find((c) => c.chapter_number > ch.chapter_number) ?? null;
  }

  const nextChapter = useMemo(() => {
    if (sortedChapters.length === 0) return null;
    if (maxLoggedNumber === null) return sortedChapters[0];
    const found = sortedChapters.find((c) => c.chapter_number > maxLoggedNumber);
    return found ?? null;
  }, [sortedChapters, maxLoggedNumber]);

  const resolvedSlug = useMemo(() => {
    if (typeof slug === "string" && slug.trim()) return slug.trim();

    const q = router.query?.slug;
    if (typeof q === "string" && q.trim()) return q.trim();
    if (Array.isArray(q) && typeof q[0] === "string" && q[0].trim()) return q[0].trim();

    return null;
  }, [slug, router.query]);

  useEffect(() => {
    if (!mangaId) return;
    if (!Array.isArray(chapters) || chapters.length === 0) return;

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
        .from("manga_chapter_logs")
        .select("manga_chapter_id")
        .eq("manga_id", mangaId)
        .eq("user_id", user.id)
        .limit(5000);

      if (cancelled) return;

      if (error || !data) {
        console.warn("[MangaQuickLogRow] failed to load chapter logs:", error);
        setMaxLoggedNumber(null);
        return;
      }

      let maxNum: number | null = null;

      for (const row of data as any[]) {
        const cid = row?.manga_chapter_id as string | null;
        if (!cid) continue;

        const ch = chapterById[cid];
        const n = ch?.chapter_number;

        if (typeof n !== "number" || !Number.isFinite(n)) continue;
        if (maxNum === null || n > maxNum) maxNum = n;
      }

      setMaxLoggedNumber(maxNum);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [mangaId, chapters, refreshToken, chapterById]);

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

  async function createWatchedMark(params: { userId: string; chapterId: string }) {
    const del = await supabase
      .from("user_marks")
      .delete()
      .eq("user_id", params.userId)
      .eq("kind", "watched")
      .eq("manga_id", mangaId)
      .eq("manga_chapter_id", params.chapterId)
      .is("anime_id", null)
      .is("anime_episode_id", null);

    if (del.error) {
      console.error("[MangaQuickLogRow] watched mark delete failed:", del.error);
      return { error: del.error };
    }

    const ins = await supabase.from("user_marks").insert({
      user_id: params.userId,
      kind: "watched",
      manga_id: mangaId,
      manga_chapter_id: params.chapterId,
    });

    if (ins.error) {
      console.error("[MangaQuickLogRow] watched mark insert failed:", ins.error);
      return { error: ins.error };
    }

    return { error: null as any };
  }

  async function quickLogWithWatched(ch: ChapterRow) {
    if (!ch?.id) return;

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

      const watchedRes = await createWatchedMark({ userId: user.id, chapterId: ch.id });
      if (watchedRes.error) {
        onMessage?.("Couldn’t log (watched mark failed).");
        return;
      }

      const { error } = await createMangaChapterLog({
        manga_id: mangaId,
        manga_chapter_id: ch.id,
        rating: null,
        liked: false,
        review_id: null,
        note: null,
        contains_spoilers: false,
      });

      if (error) {
        console.error("[MangaQuickLogRow] createMangaChapterLog failed:", error);
        onMessage?.("Couldn’t log (see console).");
        return;
      }

      onLogCreated?.();

      setMaxLoggedNumber((prev) => {
        const n = ch.chapter_number;
        if (typeof n !== "number" || !Number.isFinite(n)) return prev;
        if (prev === null) return n;
        return Math.max(prev, n);
      });

      const next = getChapterAfter(ch);

      // ✅ navigate to the chapter the user is ABOUT to review
      if (resolvedSlug && next) {
        router.push(`/manga/${resolvedSlug}/chapter/${next.chapter_number}`, undefined, {
          scroll: false,
        });
      }

      onMessage?.(`Logged Ch ${ch.chapter_number} ✅`);
    } finally {
      setBusy(false);
    }
  }

  async function animateSwipeAndLog(ch: ChapterRow) {
    if (!ch?.id) return;
    if (!canInteract) return;
    if (lockInput) return;

    committedRef.current = true;

    // ✅ slide right (animated)
    setAutoPhase("swiping");
    setSwipeX(SWIPE_MAX);
    await new Promise((r) => setTimeout(r, AUTO_SWIPE_MS));

    // ✅ hold briefly so user can see it
    setAutoPhase("holding");
    await new Promise((r) => setTimeout(r, AUTO_HOLD_MS));

    // ✅ perform log (may navigate)
    await quickLogWithWatched(ch);

    // ✅ return
    setAutoPhase("returning");
    setSwipeX(0);
    await new Promise((r) => setTimeout(r, AUTO_RETURN_MS));

    committedRef.current = false;
    setAutoPhase("idle");
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!nextChapter) return;
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
    const next = clamp(startSwipeXRef.current + dx, 0, SWIPE_MAX);
    setSwipeX(next);
  }

  async function onPointerUpOrCancel(e: React.PointerEvent) {
    if (!isDragging) return;
    setIsDragging(false);

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}

    if (!nextChapter) {
      setSwipeX(0);
      committedRef.current = false;
      return;
    }

    if (swipeX >= SWIPE_COMMIT && !committedRef.current) {
      await animateSwipeAndLog(nextChapter);
      return;
    }

    setSwipeX(0);
    committedRef.current = false;
  }

  const title =
    nextChapter && typeof nextChapter.title === "string" && nextChapter.title.trim()
      ? nextChapter.title.trim()
      : null;

  const isDisabled = !canInteract || busy;

  // ✅ transition timing:
  // - manual drag: none
  // - auto phases: use their durations
  // - normal settle: 180ms
  const transition = useMemo(() => {
    if (isDragging) return "none";
    if (autoPhase === "swiping") return `transform ${AUTO_SWIPE_MS}ms cubic-bezier(0.2, 0.9, 0.2, 1)`;
    if (autoPhase === "returning") return `transform ${AUTO_RETURN_MS}ms cubic-bezier(0.2, 0.9, 0.2, 1)`;
    return "transform 180ms cubic-bezier(0.2, 0.9, 0.2, 1)";
  }, [isDragging, autoPhase]);

  return (
    <div className="border-b border-gray-800 bg-black">
      <div className="px-3 py-2">
        {sortedChapters.length === 0 ? (
          <div className="text-xs text-gray-400">No chapters.</div>
        ) : !nextChapter ? (
          <div className="text-xs text-gray-400">You’re caught up ✅</div>
        ) : (
          <div className="relative overflow-hidden rounded-md">
            {/* green action revealed by swipe */}
            <div className="absolute inset-0 flex items-center bg-green-500">
              <div className="flex items-center gap-3 pl-4">
                <div className="h-6 w-6 rounded-full bg-white/20" />
                <div className="text-[14px] font-semibold text-white">Chapter Logged</div>
              </div>
            </div>

            {/* sliding foreground */}
            <div
              className={[
                "relative rounded-md border border-gray-800 bg-black",
                isDisabled ? "opacity-80" : "",
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
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-gray-100">
                    Ch {nextChapter.chapter_number}
                  </div>
                  {title ? (
                    <div className="mt-0.5 truncate text-[11px] text-gray-500">{title}</div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    data-no-swipe="true"
                    type="button"
                    disabled={isDisabled}
                    onClick={() => onOpenLog(nextChapter.id)}
                    className={[
                      "relative rounded-md border px-3 py-1.5 text-[11px] font-semibold",
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
                      if (!nextChapter) return;
                      animateSwipeAndLog(nextChapter);
                    }}
                    className={[
                      "relative inline-flex h-8 w-8 items-center justify-center rounded-full border",
                      "transition-all duration-150 cursor-pointer",
                      "border-gray-700 text-gray-200",
                      "hover:border-sky-400 hover:bg-sky-500/20",
                      "active:scale-95",
                      "focus:outline-none focus:ring-2 focus:ring-sky-500/40",
                      isDisabled ? "opacity-60 cursor-not-allowed" : "",
                    ].join(" ")}
                    aria-label={`Quick log chapter ${nextChapter.chapter_number}`}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
