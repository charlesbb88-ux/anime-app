"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { buildChapterNavGroups } from "@/lib/chapterNavigation";
import type { NavGroup } from "@/lib/chapterNavigation";

// ✅ NEW
import MangaQuickLogRow from "@/components/manga/MangaQuickLogRow";

type ChapterRow = {
  id: string;
  manga_id: string;
  chapter_number: number;
  title: string | null;
};

type VolumeMapRow = {
  mapping: Record<string, string[]> | null;
};

type Props = {
  mangaId: string;
  totalChapters?: number | null; // ✅ add
  onOpenLog: (chapterId?: string) => void;
  widthClassName?: string;
};

type DragScrollOptions = {
  ignoreFromSelector?: string; // don't start drag if pointerdown was inside this selector
  allowInteractiveTargets?: boolean; // allow starting drag on buttons/interactive nodes
  thresholdPx?: number;
};

function useDragScroll(options?: DragScrollOptions) {
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
  }>(/* ... unchanged ... */ {
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
        } catch { }
      }

      e.preventDefault();
    }

    if (drag.current.moved) {
      el.scrollTop = drag.current.startScrollTop - dy;
    }
  }

  function endPointer(e?: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current.isDown) return;
    if (e && drag.current.pointerId !== e.pointerId) return;

    drag.current.isDown = false;
    drag.current.pointerId = null;
    drag.current.captured = false;

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
}: Props) {
  const [open, setOpen] = useState(false);

  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [volumeMap, setVolumeMap] = useState<Record<string, string[]> | null>(
    null
  );
  const [volumeMapLoaded, setVolumeMapLoaded] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [expandedVolumeKey, setExpandedVolumeKey] = useState<string | null>(
    null
  );

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
      } else {
        setChapters((data as ChapterRow[]) ?? []);
        fetchedForMangaId.current = mangaId;
      }

      setLoading(false);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [mangaId]);

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
        if (row?.mapping && typeof row.mapping === "object") {
          setVolumeMap(row.mapping);
        } else {
          setVolumeMap(null);
        }
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

  const total =
    typeof totalChapters === "number" ? totalChapters : null;

  const hasTotal =
    typeof total === "number" && Number.isFinite(total) && total > 0;

  const cappedTotal = hasTotal ? Math.min(total as number, 5000) : null;

  const navGroups = useMemo<NavGroup[]>(() => {
    if (!volumeMapLoaded) return [];

    return buildChapterNavGroups({
      volumeMap,
      totalChapters: cappedTotal,
      chunkSize: 25,
    });
  }, [volumeMapLoaded, volumeMap, cappedTotal]);

  const hasNavGroups = volumeMapLoaded && navGroups.length > 0;

  const sections = useMemo(() => {
    if (hasNavGroups) {
      return navGroups.map((g) => {
        const nums = g.chapters.slice().sort((a, b) => a - b);

        // volume groups stay unchanged
        if (g.kind === "volume") {
          return {
            key: g.key,
            labelTop: g.labelTop,
            labelBottom: g.labelBottom ?? null,
            chapterNums: nums,
          };
        }

        // ✅ range groups (Option A)
        const start = nums[0];
        const end = nums[nums.length - 1];
        const count = nums.length;

        return {
          key: g.key,
          labelTop: `Ch ${start}–${end}`,
          labelBottom: null, // ✅ remove right-side text
          chapterNums: nums,
        };
      });
    }

    // fallback: no navGroups => just "All"
    const nums = chapters
      .map((c) => c.chapter_number)
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b);

    const min = nums.length ? nums[0] : null;
    const max = nums.length ? nums[nums.length - 1] : null;

    return [
      {
        key: "all",
        labelTop: "All",
        labelBottom: min !== null && max !== null ? `${min}–${max}` : null,
        chapterNums: nums,
      },
    ];
  }, [hasNavGroups, navGroups, chapters]);

  const chapterByNumber = useMemo(() => {
    const map: Record<number, ChapterRow> = {};
    for (const c of chapters) {
      if (typeof c.chapter_number === "number") map[c.chapter_number] = c;
    }
    return map;
  }, [chapters]);

  const expandedSection = useMemo(() => {
    if (!expandedVolumeKey) return null;
    return sections.find((s) => s.key === expandedVolumeKey) ?? null;
  }, [sections, expandedVolumeKey]);

  const expandedChapters = useMemo(() => {
    if (!expandedSection) return [];
    const out: ChapterRow[] = [];
    for (const n of expandedSection.chapterNums) {
      const row = chapterByNumber[n];
      if (row) out.push(row);
    }
    out.sort((a, b) => a.chapter_number - b.chapter_number);
    return out;
  }, [expandedSection, chapterByNumber]);

  const canInteract = !loading && !errMsg && chapters.length > 0;

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

      const { error } = await supabase.from("manga_chapter_logs").insert({
        user_id: user.id,
        manga_id: mangaId,
        manga_chapter_id: ch.id,
      });

      if (error) {
        console.error("MangaQuickLogBox: quick log error", error);
        setMsg("Couldn’t log (see console).");
        return;
      }

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

      {/* ✅ Always-visible quick row (NOT part of dropdown) */}
      <MangaQuickLogRow
        mangaId={mangaId}
        chapters={chapters}
        canInteract={canInteract}
        onOpenLog={onOpenLog}
        onMessage={setMsg}
      />

      {/* Header */}
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
          "hover:bg-white/5 active:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/10",
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

      {/* OUTER PANEL (volume list) */}
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
          open
            ? "max-h-[700px] opacity-100 overflow-y-auto"
            : "max-h-0 opacity-0 overflow-hidden",
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

                  return (
                    <div
                      key={s.key}
                      ref={(el) => {
                        sectionRefs.current[s.key] = el;
                      }}
                      className="overflow-hidden rounded-md border border-gray-800 bg-black"
                    >
                      {/* Volume header */}
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
                          "hover:bg-white/5 active:bg-white/10",
                          "focus:outline-none focus:ring-2 focus:ring-white/10",
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

                        <div className="flex items-center gap-2">
                          {s.labelBottom ? (
                            <span className="text-[11px] font-semibold text-gray-400">
                              {s.labelBottom}
                            </span>
                          ) : null}

                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-700 text-gray-400">
                            <Check className="h-3.5 w-3.5 opacity-40" />
                          </span>
                        </div>
                      </button>

                      {/* Expanded area */}
                      <div
                        className={[
                          "grid overflow-hidden",
                          "transition-[grid-template-rows,opacity] duration-200 ease-out",
                        ].join(" ")}
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
                                  No chapters found for this volume.
                                </div>
                              ) : (
                                <div className="divide-y divide-gray-800">
                                  {expandedChapters.map((ch) => {
                                    const title =
                                      typeof ch.title === "string" && ch.title.trim()
                                        ? ch.title.trim()
                                        : null;
                                    const rowBusy = busyId === ch.id;

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

                                        <div className="flex items-center gap-2 shrink-0">
                                          <button
                                            type="button"
                                            disabled={!canInteract || rowBusy}
                                            onClick={() => {
                                              if (innerDrag.drag.current.moved) return;
                                              onOpenLog(ch.id);
                                            }}
                                            className={[
                                              "rounded-md border px-3 py-1.5 text-[11px] font-semibold",
                                              "border-gray-700 text-gray-200",
                                              "hover:bg-white/5 active:bg-white/10",
                                              "focus:outline-none focus:ring-2 focus:ring-white/10",
                                              !canInteract || rowBusy
                                                ? "opacity-60 cursor-not-allowed"
                                                : "",
                                            ].join(" ")}
                                          >
                                            Review
                                          </button>

                                          <button
                                            type="button"
                                            disabled={!canInteract || rowBusy}
                                            onClick={() => {
                                              if (innerDrag.drag.current.moved) return;
                                              quickLogChapter(ch);
                                            }}
                                            className={[
                                              "inline-flex h-8 w-8 items-center justify-center rounded-full border",
                                              "border-gray-700 text-gray-200",
                                              "hover:bg-white/5 active:bg-white/10",
                                              "focus:outline-none focus:ring-2 focus:ring-white/10",
                                              !canInteract || rowBusy
                                                ? "opacity-60 cursor-not-allowed"
                                                : "",
                                            ].join(" ")}
                                            aria-label={`Quick log chapter ${ch.chapter_number}`}
                                          >
                                            <Check className="h-4 w-4" />
                                          </button>
                                        </div>
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
                  );
                })}
              </div>

              {msg ? <div className="mt-3 text-xs text-gray-300">{msg}</div> : null}

              {!volumeMapLoaded ? (
                <div className="mt-2 text-[11px] text-gray-600">Loading volumes…</div>
              ) : null}
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
