"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  chapters: ChapterRow[];
  canInteract: boolean;

  // parent bumps this whenever a log could have been created elsewhere
  refreshToken?: number;

  onOpenLog: (chapterId?: string) => void;
  onMessage?: (msg: string | null) => void;
};

export default function MangaQuickLogRow({
  mangaId,
  chapters,
  canInteract,
  refreshToken,
  onOpenLog,
  onMessage,
}: Props) {
  const [busy, setBusy] = useState(false);

  // the highest chapter_number the user has logged for this manga
  const [maxLoggedNumber, setMaxLoggedNumber] = useState<number | null>(null);

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

  const nextChapter = useMemo(() => {
    if (sortedChapters.length === 0) return null;

    if (maxLoggedNumber === null) return sortedChapters[0];

    const found = sortedChapters.find((c) => c.chapter_number > maxLoggedNumber);
    return found ?? null;
  }, [sortedChapters, maxLoggedNumber]);

  // ✅ Refetch whenever refreshToken changes (or manga/chapters change)
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

  async function quickLog(ch: ChapterRow) {
    if (!ch?.id) return;
    if (!canInteract) return;
    if (busy) return;

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
        console.error("[MangaQuickLogRow] quick log failed:", error);
        onMessage?.("Couldn’t log (see console).");
        return;
      }

      // ✅ instant UI update
      setMaxLoggedNumber((prev) => {
        const n = ch.chapter_number;
        if (typeof n !== "number" || !Number.isFinite(n)) return prev;
        if (prev === null) return n;
        return Math.max(prev, n);
      });

      onMessage?.(`Logged Ch ${ch.chapter_number} ✅`);
    } finally {
      setBusy(false);
    }
  }

  const title =
    nextChapter && typeof nextChapter.title === "string" && nextChapter.title.trim()
      ? nextChapter.title.trim()
      : null;

  return (
    <div className="border-b border-gray-800 bg-black">
      <div className="px-3 py-2">
        {sortedChapters.length === 0 ? (
          <div className="text-xs text-gray-400">No chapters.</div>
        ) : !nextChapter ? (
          <div className="text-xs text-gray-400">You’re caught up ✅</div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-gray-100">
                Next: Ch {nextChapter.chapter_number}
              </div>
              {title ? (
                <div className="mt-0.5 truncate text-[11px] text-gray-500">
                  {title}
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={!canInteract || busy}
                onClick={() => onOpenLog(nextChapter.id)}
                className={[
                  "rounded-md border px-3 py-1.5 text-[11px] font-semibold",
                  "border-gray-700 text-gray-200",
                  "hover:bg-white/5 active:bg-white/10",
                  "focus:outline-none focus:ring-2 focus:ring-white/10",
                  !canInteract || busy ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}
              >
                Review
              </button>

              <button
                type="button"
                disabled={!canInteract || busy}
                onClick={() => quickLog(nextChapter)}
                className={[
                  "inline-flex h-8 w-8 items-center justify-center rounded-full border",
                  "border-gray-700 text-gray-200",
                  "hover:bg-white/5 active:bg-white/10",
                  "focus:outline-none focus:ring-2 focus:ring-white/10",
                  !canInteract || busy ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}
                aria-label={`Quick log chapter ${nextChapter.chapter_number}`}
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
