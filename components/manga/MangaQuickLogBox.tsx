// components/manga/MangaQuickLogBox.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { buildChapterNavGroups } from "@/lib/chapterNavigation";
import type { NavGroup } from "@/lib/chapterNavigation";
import { createMangaChapterLog } from "@/lib/logs";
import AuthGate from "@/components/AuthGate";

import MangaQuickLogRow from "@/components/manga/MangaQuickLogRow";

type ChapterRow = {
  id: string;
  manga_id: string;
  chapter_number: number; // normalized
  title: string | null;
};

type ChapterRowRaw = {
  id: string;
  manga_id: string;
  chapter_number: any; // may come back as string/number
  title: string | null;
};

type VolumeMapRow = {
  mapping: Record<string, string[]> | null;
};

type Props = {
  mangaId: string;
  totalChapters?: number | null;
  onOpenLog: (chapterId?: string) => void;
  widthClassName?: string;

  // bump this from the page when a chapter log/review is created via the modal
  refreshToken?: number;
};

type DragScrollOptions = {
  ignoreFromSelector?: string;
  allowInteractiveTargets?: boolean;
  thresholdPx?: number;
};

type DragScrollHook = {
  ref: React.MutableRefObject<HTMLDivElement | null>;
  drag: React.MutableRefObject<{
    isDown: boolean;
    startY: number;
    startScrollTop: number;
    moved: boolean;
    pointerId: number | null;
    captured: boolean;
  }>;
  bind: {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerLeave: (e: React.PointerEvent<HTMLDivElement>) => void;
  };
};

function toFiniteNumber(v: any): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function intPart(n: number) {
  return Math.floor(n);
}

function useDragScroll(options?: DragScrollOptions): DragScrollHook {
  const ref = useRef<HTMLDivElement | null>(null);

  const ignoreFromSelector = options?.ignoreFromSelector ?? "";
  const allowInteractiveTargets = options?.allowInteractiveTargets ?? false;
  const thresholdPx = options?.thresholdPx ?? 3;

  const drag = useRef<{
    isDown: boolean;
    startY: number;
    startScrollTop: number;
    moved: boolean;
    pointerId: number | null;
    captured: boolean;
  }>({
    isDown: false,
    startY: 0,
    startScrollTop: 0,
    moved: false,
    pointerId: null,
    captured: false,
  });

  function isInsideIgnoreZone(target: EventTarget | null) {
    if (!ignoreFromSelector) return false;
    const el = target as HTMLElement | null;
    if (!el) return false;
    return Boolean(el.closest(ignoreFromSelector));
  }

  function isInteractive(target: EventTarget | null) {
    const el = target as HTMLElement | null;
    if (!el) return false;
    return Boolean(
      el.closest(
        'button, a, input, textarea, select, label, [role="button"], [data-no-drag="true"]'
      )
    );
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;

    if (e.pointerType === "mouse" && (e as any).button !== 0) return;
    if (isInsideIgnoreZone(e.target)) return;
    if (!allowInteractiveTargets && isInteractive(e.target)) return;

    drag.current.isDown = true;
    drag.current.moved = false;
    drag.current.startY = e.clientY;
    drag.current.startScrollTop = el.scrollTop;
    drag.current.pointerId = e.pointerId;
    drag.current.captured = false;
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    if (!drag.current.isDown) return;
    if (drag.current.pointerId !== e.pointerId) return;

    const dy = e.clientY - drag.current.startY;

    if (!drag.current.moved && Math.abs(dy) >= thresholdPx) {
      drag.current.moved = true;

      if (!drag.current.captured) {
        try {
          (e.currentTarget as any).setPointerCapture?.(e.pointerId);
          drag.current.captured = true;
        } catch {
          // ignore
        }
      }

      e.preventDefault();
    }

    if (drag.current.moved) {
      el.scrollTop = drag.current.startScrollTop - dy;
    }
  }

  function endPointer(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current.isDown) return;
    if (drag.current.pointerId !== e.pointerId) return;

    drag.current.isDown = false;
    drag.current.pointerId = null;
    drag.current.captured = false;

    // allow click handlers to see moved state in capture, then reset
    setTimeout(() => {
      drag.current.moved = false;
    }, 0);
  }

  return {
    ref,
    drag,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
      onPointerLeave: endPointer,
    },
  };
}

export default function MangaQuickLogBox({
  mangaId,
  totalChapters,
  onOpenLog,
  widthClassName,
  refreshToken,
}: Props) {
  const [open, setOpen] = useState(false);

  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [volumeMap, setVolumeMap] = useState<Record<string, string[]> | null>(null);
  const [volumeMapLoaded, setVolumeMapLoaded] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // ✅ log counts => check-circle + progress ring
  const [logCounts, setLogCounts] = useState<Record<string, number>>({});
  const [logBump, setLogBump] = useState(0);

  // ✅ review counts => review button + badge
  const [reviewCounts, setReviewCounts] = useState<Record<string, number>>({});
  const [reviewBump, setReviewBump] = useState(0);

  const [expandedVolumeKey, setExpandedVolumeKey] = useState<string | null>(null);

  const fetchedForMangaId = useRef<string | null>(null);

  const panelDrag = useDragScroll({
    allowInteractiveTargets: true,
    ignoreFromSelector: "[data-inner-drag='true']",
    thresholdPx: 3,
  });

  const innerDrag = useDragScroll({
    allowInteractiveTargets: false,
    thresholdPx: 3,
  });

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // 1) Load chapters (normalize chapter_number to number)
  useEffect(() => {
    if (!mangaId) return;
    if (fetchedForMangaId.current === mangaId) return;

    let cancelled = false;

    async function run() {
      setLoading(true);
      setErrMsg(null);
      setMsg(null);

      const { data, error } = await supabase
        .from("manga_chapters")
        .select("id, manga_id, chapter_number, title")
        .eq("manga_id", mangaId)
        .order("chapter_number", { ascending: true });

      if (cancelled) return;

      if (error || !data) {
        console.error("MangaQuickLogBox: error loading chapters", error);
        setChapters([]);
        setErrMsg("Couldn’t load chapters.");
        fetchedForMangaId.current = null;
        setLoading(false);
        return;
      }

      const normalized: ChapterRow[] = (data as ChapterRowRaw[])
        .map((row) => {
          const n = toFiniteNumber(row.chapter_number);
          return {
            id: row.id,
            manga_id: row.manga_id,
            chapter_number: n ?? Number.NaN,
            title: row.title ?? null,
          };
        })
        .filter((r) => Number.isFinite(r.chapter_number) && r.chapter_number > 0)
        .sort((a, b) => a.chapter_number - b.chapter_number);

      setChapters(normalized);
      fetchedForMangaId.current = mangaId;
      setLoading(false);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [mangaId]);

  // 2) Load volume map
  useEffect(() => {
    if (!mangaId) return;

    let cancelled = false;

    async function run() {
      setVolumeMap(null);
      setVolumeMapLoaded(false);
      setExpandedVolumeKey(null);

      const { data, error } = await supabase
        .from("manga_volume_chapter_map")
        .select("mapping")
        .eq("manga_id", mangaId)
        .eq("source", "mangadex")
        .maybeSingle();

      if (cancelled) return;

      if (!error && data) {
        const row = data as unknown as VolumeMapRow;
        if (row?.mapping && typeof row.mapping === "object") setVolumeMap(row.mapping);
        else setVolumeMap(null);
      } else {
        if (error) console.warn("MangaQuickLogBox: volume map load failed", error);
        setVolumeMap(null);
      }

      setVolumeMapLoaded(true);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [mangaId]);

  // 3) Load LOG counts
  useEffect(() => {
    if (!mangaId) return;

    let cancelled = false;

    async function run() {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (userErr || !user) {
        setLogCounts({});
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
        console.warn("MangaQuickLogBox: failed to load chapter log counts", error);
        setLogCounts({});
        return;
      }

      const counts: Record<string, number> = {};
      for (const row of data as any[]) {
        const id = row?.manga_chapter_id as string | null;
        if (!id) continue;
        counts[id] = (counts[id] ?? 0) + 1;
      }

      setLogCounts(counts);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [mangaId, refreshToken, logBump]);

  // 4) Load REVIEW counts
  useEffect(() => {
    if (!mangaId) return;

    let cancelled = false;

    async function run() {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (userErr || !user) {
        setReviewCounts({});
        return;
      }

      const { data, error } = await supabase
        .from("reviews")
        .select("manga_chapter_id")
        .eq("manga_id", mangaId)
        .eq("user_id", user.id)
        .not("manga_chapter_id", "is", null)
        .limit(5000);

      if (cancelled) return;

      if (error || !data) {
        console.warn("MangaQuickLogBox: failed to load chapter review counts", error);
        setReviewCounts({});
        return;
      }

      const counts: Record<string, number> = {};
      for (const row of data as any[]) {
        const id = row?.manga_chapter_id as string | null;
        if (!id) continue;
        counts[id] = (counts[id] ?? 0) + 1;
      }

      setReviewCounts(counts);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [mangaId, refreshToken, reviewBump]);

  // ✅ Derive totalChapters if prop is missing (this restores leftover chunk groups)
  const derivedTotalChapters = useMemo(() => {
    if (typeof totalChapters === "number" && Number.isFinite(totalChapters) && totalChapters > 0) {
      return totalChapters;
    }
    if (chapters.length === 0) return null;
    const max = chapters[chapters.length - 1]?.chapter_number;
    if (typeof max !== "number" || !Number.isFinite(max)) return null;
    return Math.max(1, Math.floor(max));
  }, [totalChapters, chapters]);

  const cappedTotal = useMemo(() => {
    if (typeof derivedTotalChapters !== "number") return null;
    return Math.min(derivedTotalChapters, 5000);
  }, [derivedTotalChapters]);

  const navGroups = useMemo<NavGroup[]>(() => {
    if (!volumeMapLoaded) return [];
    return buildChapterNavGroups({
      volumeMap,
      totalChapters: cappedTotal,
      chunkSize: 25,
    });
  }, [volumeMapLoaded, volumeMap, cappedTotal]);

  const hasNavGroups = volumeMapLoaded && navGroups.length > 0;

  // ✅ bucket by integer part so decimals (169.1) show inside the right group
  const chaptersByInt = useMemo(() => {
    const map: Record<number, ChapterRow[]> = {};
    for (const ch of chapters) {
      const k = intPart(ch.chapter_number);
      (map[k] ??= []).push(ch);
    }
    for (const kStr of Object.keys(map)) {
      const k = Number(kStr);
      map[k].sort((a, b) => a.chapter_number - b.chapter_number);
    }
    return map;
  }, [chapters]);

  const sections = useMemo(() => {
    if (hasNavGroups) {
      return navGroups.map((g) => {
        const ints = g.chapters.slice().sort((a, b) => a - b);

        if (g.kind === "volume") {
          return {
            key: g.key,
            labelTop: g.labelTop,
            labelBottom: g.labelBottom ?? null,
            intChapterNums: ints,
          };
        }

        const start = ints[0];
        const end = ints[ints.length - 1];

        return {
          key: g.key,
          labelTop: `Ch ${start}–${end}`,
          labelBottom: null,
          intChapterNums: ints,
        };
      });
    }

    // fallback: one big section
    const ints = Array.from(new Set(chapters.map((c) => intPart(c.chapter_number)))).sort(
      (a, b) => a - b
    );

    const min = ints.length ? ints[0] : null;
    const max = ints.length ? ints[ints.length - 1] : null;

    return [
      {
        key: "all",
        labelTop: "All",
        labelBottom: min !== null && max !== null ? `${min}–${max}` : null,
        intChapterNums: ints,
      },
    ];
  }, [hasNavGroups, navGroups, chapters]);

  const expandedSection = useMemo(() => {
    if (!expandedVolumeKey) return null;
    return sections.find((s) => s.key === expandedVolumeKey) ?? null;
  }, [sections, expandedVolumeKey]);

  const expandedChapters = useMemo(() => {
    if (!expandedSection) return [];
    const out: ChapterRow[] = [];
    for (const n of expandedSection.intChapterNums) {
      const bucket = chaptersByInt[n];
      if (bucket?.length) out.push(...bucket);
    }
    out.sort((a, b) => a.chapter_number - b.chapter_number);
    return out;
  }, [expandedSection, chaptersByInt]);

  const canInteract = !loading && !errMsg && chapters.length > 0;

  function getSectionProgress(sectionKey: string) {
    const s = sections.find((x) => x.key === sectionKey);
    if (!s) return { logged: 0, total: 0, pct: 0 };

    let totalLocal = 0;
    let loggedLocal = 0;

    for (const n of s.intChapterNums) {
      const bucket = chaptersByInt[n];
      if (!bucket?.length) continue;

      for (const ch of bucket) {
        totalLocal += 1;
        if ((logCounts[ch.id] ?? 0) > 0) loggedLocal += 1;
      }
    }

    const pct = totalLocal > 0 ? Math.round((loggedLocal / totalLocal) * 1000) / 10 : 0;
    return { logged: loggedLocal, total: totalLocal, pct };
  }

  async function quickLogChapter(ch: ChapterRow) {
    if (!ch?.id) return;
    if (!canInteract) return;
    if (busyId) return;

    setBusyId(ch.id);
    setMsg(null);

    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      const user = auth?.user;

      if (authErr || !user) {
        setMsg("You must be logged in to log.");
        return;
      }

      // watched mark (chapter scoped)
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
          console.error("[MangaQuickLogBox] watched mark delete failed:", del.error);
          setMsg("Couldn’t log (watched mark failed).");
          return;
        }

        const ins = await supabase.from("user_marks").insert({
          user_id: user.id,
          kind: "watched",
          manga_id: mangaId,
          manga_chapter_id: ch.id,
        });

        if (ins.error) {
          console.error("[MangaQuickLogBox] watched mark insert failed:", ins.error);
          setMsg("Couldn’t log (watched mark failed).");
          return;
        }
      }

      // create chapter log
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
          console.error("[MangaQuickLogBox] createMangaChapterLog failed:", error);
          setMsg("Couldn’t log (see console).");
          return;
        }
      }

      setLogCounts((prev) => ({
        ...prev,
        [ch.id]: (prev[ch.id] ?? 0) + 1,
      }));
      setLogBump((n) => n + 1);

      setMsg(`Logged Ch ${ch.chapter_number} ✅`);
    } finally {
      setBusyId(null);
    }
  }

  function scrollSectionIntoPanelView(sectionKey: string) {
    const panel = panelDrag.ref.current;
    const card = sectionRefs.current[sectionKey];
    if (!panel || !card) return;

    const panelRect = panel.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();

    const above = cardRect.top < panelRect.top;
    const below = cardRect.bottom > panelRect.bottom;

    if (above) panel.scrollTop -= panelRect.top - cardRect.top + 8;
    else if (below) panel.scrollTop += cardRect.bottom - panelRect.bottom + 8;
  }

  return (
    <div
      className={[
        "mt-3 overflow-hidden rounded-md border border-gray-800 bg-black text-gray-200 shadow-sm",
        widthClassName ?? "w-[240px]",
      ].join(" ")}
    >
      <style jsx global>{`
        .mqb-scroll {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .mqb-scroll::-webkit-scrollbar {
          width: 0px;
          height: 0px;
        }
      `}</style>

      <MangaQuickLogRow
        mangaId={mangaId}
        chapters={chapters}
        canInteract={canInteract}
        refreshToken={(refreshToken ?? 0) * 100000 + logBump + reviewBump}
        onOpenLog={onOpenLog}
        onMessage={setMsg}
        onLogCreated={() => {
          setLogBump((n) => n + 1);
        }}
      />

      <button
        type="button"
        onClick={() =>
          setOpen((v) => {
            const next = !v;
            if (next) {
              setExpandedVolumeKey(null);
              requestAnimationFrame(() => {
                if (panelDrag.ref.current) panelDrag.ref.current.scrollTop = 0;
              });
            }
            return next;
          })
        }
        className={[
          "w-full px-3 py-2 text-left text-[12px] font-semibold text-gray-100",
          "transition-colors duration-150",
          "hover:bg-sky-500/10 active:bg-sky-500/20",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30",
          "flex items-center justify-between",
        ].join(" ")}
      >
        <span>Chapters</span>
        <ChevronDown
          className={[
            "h-4 w-4 transition-transform duration-200",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      <Divider />

      <div
        ref={panelDrag.ref}
        {...panelDrag.bind}
        onClickCapture={(e) => {
          if (panelDrag.drag.current.moved) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        className={[
          "mqb-scroll transition-all duration-200 ease-out",
          "cursor-grab active:cursor-grabbing select-none",
          open ? "max-h-[700px] opacity-100 overflow-y-auto" : "max-h-0 opacity-0 overflow-hidden",
        ].join(" ")}
      >
        <div className="px-2 py-3">
          {loading ? (
            <div className="text-xs text-gray-400">Loading chapters…</div>
          ) : errMsg ? (
            <div className="text-xs text-red-300">{errMsg}</div>
          ) : chapters.length === 0 ? (
            <div className="text-xs text-gray-400">No chapters found.</div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {sections.map((s) => {
                  const isOpen = expandedVolumeKey === s.key;
                  const prog = getSectionProgress(s.key);
                  const hasProg = prog.total > 0;

                  return (
                    <div
                      key={s.key}
                      ref={(el) => {
                        sectionRefs.current[s.key] = el;
                      }}
                      className="rounded-md p-[2px]"
                      style={{
                        backgroundImage: hasProg
                          ? `conic-gradient(#0ea5e9 0 ${prog.pct}%, rgba(55,65,81,0.7) ${prog.pct}% 100%)`
                          : undefined,
                        backgroundColor: hasProg ? undefined : "rgba(55,65,81,0.7)",
                      }}
                    >
                      <div
                        className={[
                          "overflow-hidden rounded-md border border-gray-800 bg-black",
                          "transition-all duration-200",
                          "hover:border-sky-500/70 hover:shadow-[0_0_0_1px_rgba(14,165,233,0.35)]",
                          "hover:bg-[#0b1220]",
                        ].join(" ")}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (panelDrag.drag.current.moved) return;

                            setMsg(null);
                            setExpandedVolumeKey((cur) => {
                              const next = cur === s.key ? null : s.key;
                              if (next) {
                                requestAnimationFrame(() => {
                                  scrollSectionIntoPanelView(s.key);
                                });
                              }
                              return next;
                            });
                          }}
                          className={[
                            "w-full px-3 py-2 text-left",
                            "flex items-center justify-between",
                            "transition-colors duration-150",
                            "hover:bg-sky-500/10 active:bg-sky-500/20",
                            "focus:outline-none focus:ring-2 focus:ring-sky-500/30",
                          ].join(" ")}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-semibold text-gray-100">
                              {s.labelTop}
                            </span>
                            <ChevronDown
                              className={[
                                "h-4 w-4 text-gray-400 transition-transform duration-200",
                                isOpen ? "rotate-180" : "",
                              ].join(" ")}
                            />
                          </div>

                          {s.labelBottom ? (
                            <span className="text-[11px] font-semibold text-gray-400">
                              {s.labelBottom}
                            </span>
                          ) : null}
                        </button>

                        <div
                          className="grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out"
                          style={{
                            gridTemplateRows: isOpen ? "1fr" : "0fr",
                            opacity: isOpen ? 1 : 0,
                          }}
                        >
                          <div className="min-h-0 overflow-hidden">
                            <div className="px-0 pb-0">
                              <div
                                data-inner-drag="true"
                                ref={isOpen ? innerDrag.ref : undefined}
                                {...(isOpen ? innerDrag.bind : {})}
                                onClickCapture={(e) => {
                                  if (!isOpen) return;
                                  if (innerDrag.drag.current.moved) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }
                                }}
                                className={[
                                  "mqb-scroll max-h-[320px] overflow-y-auto",
                                  "rounded-md border border-gray-800 bg-black",
                                  "cursor-grab active:cursor-grabbing select-none",
                                ].join(" ")}
                              >
                                {!isOpen ? null : expandedChapters.length === 0 ? (
                                  <div className="px-3 py-3 text-xs text-gray-500">
                                    No chapters found for this section.
                                  </div>
                                ) : (
                                  <div className="divide-y divide-gray-800">
                                    {expandedChapters.map((ch) => {
                                      const title =
                                        typeof ch.title === "string" && ch.title.trim()
                                          ? ch.title.trim()
                                          : null;

                                      const rowBusy = busyId === ch.id;

                                      const logCount = logCounts[ch.id] ?? 0;
                                      const isLogged = logCount > 0;
                                      const showLogBadge = logCount > 1;

                                      const reviewCount = reviewCounts[ch.id] ?? 0;
                                      const hasReview = reviewCount > 0;
                                      const showReviewBadge = reviewCount > 1;

                                      return (
                                        <div
                                          key={ch.id}
                                          className="flex items-center justify-between gap-2 px-3 py-2"
                                        >
                                          <div className="min-w-0">
                                            <div className="text-[12px] font-semibold text-gray-100">
                                              Ch {ch.chapter_number}
                                            </div>
                                            {title ? (
                                              <div className="mt-0.5 truncate text-[11px] text-gray-500">
                                                {title}
                                              </div>
                                            ) : null}
                                          </div>
                                          <AuthGate>
                                            <div className="flex items-center gap-2 shrink-0">
                                              <button
                                                type="button"
                                                disabled={!canInteract || rowBusy}
                                                onClick={() => {
                                                  if (innerDrag.drag.current.moved) return;
                                                  onOpenLog(ch.id);
                                                  setReviewBump((n) => n + 1);
                                                }}
                                                className={[
                                                  "relative rounded-md border px-3 py-1.5 text-[11px] font-semibold",
                                                  "transition-all duration-150",
                                                  hasReview
                                                    ? "border-sky-500/70 text-sky-300 bg-sky-500/10"
                                                    : "border-gray-700 text-gray-200",
                                                  "hover:border-sky-500/70 hover:bg-sky-500/10",
                                                  "active:bg-sky-500/20 active:scale-[0.98]",
                                                  "focus:outline-none focus:ring-2 focus:ring-sky-500/30",
                                                  !canInteract || rowBusy ? "opacity-60 cursor-not-allowed" : "",
                                                ].join(" ")}
                                              >
                                                Review
                                                {showReviewBadge ? (
                                                  <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-bold leading-none text-black">
                                                    {reviewCount}
                                                  </span>
                                                ) : null}
                                              </button>

                                              <button
                                                type="button"
                                                disabled={!canInteract || rowBusy}
                                                onClick={() => {
                                                  if (innerDrag.drag.current.moved) return;
                                                  quickLogChapter(ch);
                                                }}
                                                className={[
                                                  "relative inline-flex h-8 w-8 items-center justify-center rounded-full border",
                                                  "transition-all duration-150",
                                                  isLogged
                                                    ? "border-sky-500 text-sky-400 bg-sky-500/10"
                                                    : "border-gray-700 text-gray-200",
                                                  "hover:border-sky-400 hover:bg-sky-500/20",
                                                  "active:scale-95",
                                                  "focus:outline-none focus:ring-2 focus:ring-sky-500/40",
                                                  !canInteract || rowBusy ? "opacity-60 cursor-not-allowed" : "",
                                                ].join(" ")}
                                                aria-label={`Quick log chapter ${ch.chapter_number}`}
                                                title={
                                                  isLogged
                                                    ? logCount > 1
                                                      ? `Logged ${logCount} times`
                                                      : "Logged"
                                                    : "Quick log"
                                                }
                                              >
                                                <Check className="h-4 w-4" />
                                                {showLogBadge ? (
                                                  <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-bold leading-none text-black">
                                                    {logCount}
                                                  </span>
                                                ) : null}
                                              </button>
                                            </div>
                                          </AuthGate>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {msg ? <div className="mt-3 text-xs text-gray-300">{msg}</div> : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-gray-700/60" />;
}
