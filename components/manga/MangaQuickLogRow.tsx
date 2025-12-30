"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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

    // ✅ NEW: forces the row to refetch "last logged" when logs change
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
    const [lastLoggedChapterId, setLastLoggedChapterId] = useState<string | null>(
        null
    );

    const fetchedForKey = useRef<string | null>(null);

    const chapterById = useMemo(() => {
        const map: Record<string, ChapterRow> = {};
        for (const c of chapters) map[c.id] = c;
        return map;
    }, [chapters]);

    // sorted numeric chapters (for "next" computation)
    const sortedChapters = useMemo(() => {
        return chapters
            .filter((c) => typeof c.chapter_number === "number" && Number.isFinite(c.chapter_number))
            .slice()
            .sort((a, b) => a.chapter_number - b.chapter_number);
    }, [chapters]);

    const lastLoggedNumber = useMemo(() => {
        if (!lastLoggedChapterId) return null;
        const row = chapterById[lastLoggedChapterId];
        return row ? row.chapter_number : null;
    }, [lastLoggedChapterId, chapterById]);

    const nextChapter = useMemo(() => {
        if (sortedChapters.length === 0) return null;

        if (lastLoggedNumber === null) {
            // if nothing logged yet, next is the first chapter
            return sortedChapters[0];
        }

        // next = first chapter with number greater than last logged
        const found = sortedChapters.find((c) => c.chapter_number > lastLoggedNumber);
        return found ?? null;
    }, [sortedChapters, lastLoggedNumber]);

    // Fetch last log for this user+manga (once per mangaId, and when chapters exist)
    useEffect(() => {
        if (!mangaId) return;
        if (!Array.isArray(chapters) || chapters.length === 0) return;

        const key = `${mangaId}:${chapters.length}`;
        if (fetchedForKey.current === key) return;

        let cancelled = false;

        async function run() {
            fetchedForKey.current = key;

            const { data: auth, error: authErr } = await supabase.auth.getUser();
            const user = auth?.user;

            if (cancelled) return;

            if (authErr || !user) {
                setLastLoggedChapterId(null);
                return;
            }

            // get most recent log row (expects created_at to exist; if it doesn’t, you can swap ordering)
            const { data, error } = await supabase
                .from("manga_chapter_logs")
                .select("manga_chapter_id, created_at")
                .eq("manga_id", mangaId)
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })
                .limit(1);

            if (cancelled) return;

            if (error) {
                console.warn("[MangaQuickLogRow] load last log failed:", error);
                setLastLoggedChapterId(null);
                return;
            }

            const first = Array.isArray(data) && data.length > 0 ? (data[0] as any) : null;
            setLastLoggedChapterId(first?.manga_chapter_id ?? null);
        }

        run();

        return () => {
            cancelled = true;
        };
    }, [mangaId, chapters, refreshToken]);

    async function quickLog(ch: ChapterRow) {
        if (!ch?.id) return;
        if (!canInteract) return;
        if (busy) return;

        setBusy(true);
        onMessage?.(null);

        try {
            const { data: auth, error: authErr } = await supabase.auth.getUser();
            const user = auth?.user;

            if (authErr || !user) {
                onMessage?.("You must be logged in to log.");
                return;
            }

            // ✅ 1) Set watched mark (chapter-scoped)
            {
                const del = await supabase
                    .from("user_marks")
                    .delete()
                    .eq("user_id", user.id)
                    .eq("kind", "watched")
                    .eq("manga_id", mangaId)
                    .eq("manga_chapter_id", ch.id)
                    .is("anime_id", null)
                    .is("anime_episode_id", null);

                if (del.error) {
                    console.error("[MangaQuickLogRow] watched mark delete failed:", del.error);
                    onMessage?.("Couldn’t log (watched mark failed).");
                    return;
                }

                const ins = await supabase.from("user_marks").insert({
                    user_id: user.id,
                    kind: "watched",
                    manga_id: mangaId,
                    manga_chapter_id: ch.id,
                });

                if (ins.error) {
                    console.error("[MangaQuickLogRow] watched mark insert failed:", ins.error);
                    onMessage?.("Couldn’t log (watched mark failed).");
                    return;
                }
            }

            // ✅ 2) Create the log (same as modal save w/ checkbox ON; no review/like/rating)
            {
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
            }

            // ✅ update “last logged” so nextChapter advances instantly
            setLastLoggedChapterId(ch.id);
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
                                <div className="mt-0.5 truncate text-[11px] text-gray-500">{title}</div>
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
