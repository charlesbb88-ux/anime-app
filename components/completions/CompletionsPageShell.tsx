"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CompletionsCarouselRow from "./CompletionsCarouselRow";
import CompletionsCarouselRowLarge from "./CompletionsCarouselRowLarge";
import CompletionsCarouselRowExtraLarge from "./CompletionsCarouselRowExtraLarge";
import CompletionListItem from "./CompletionListItem";
import { fetchUserCompletions, type CompletionItem, type CompletionCursor } from "@/lib/completions";
import CompletionDetailsModal, { type CompletionDetails } from "./CompletionDetailsModal";

import CompletionsFilterRow from "./CompletionsFilterRow";
import { DEFAULT_COMPLETIONS_FILTERS, type CompletionsFilters, type ProgressFilter } from "./completionsFilters";

type Props = {
  userId: string;
};

function chunk<T>(arr: T[], size: number) {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type PosterSize = "small" | "large" | "xlarge";
type ViewMode = "carousel" | "list";

// keep your testing value; change back later
const PAGE_SIZE = 60;

function progressBounds(progress: ProgressFilter): { minPct: number | null; maxPct: number | null } {
  if (!progress || progress === "all") return { minPct: null, maxPct: null };
  if (progress === "100") return { minPct: 100, maxPct: 100 };

  const m = /^(\d+)-(\d+)$/.exec(progress);
  if (!m) return { minPct: null, maxPct: null };

  return { minPct: Number(m[1]), maxPct: Number(m[2]) };
}

function safeInt(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export default function CompletionsPageShell({ userId }: Props) {
  const [items, setItems] = useState<CompletionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [posterSize, setPosterSize] = useState<PosterSize>("small");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const [filters, setFilters] = useState<CompletionsFilters>(DEFAULT_COMPLETIONS_FILTERS);

  const [selected, setSelected] = useState<CompletionDetails | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const rowLimit = posterSize === "small" ? 40 : posterSize === "large" ? 30 : 15;

  // Turn the progress dropdown into server-side bounds
  const bounds = useMemo(() => progressBounds(filters.progress), [filters.progress]);

  // Cursor derived from the last loaded item (keyset pagination)
  // IMPORTANT: include pct so pct sort pagination is stable.
  const cursor: CompletionCursor | null = useMemo(() => {
    const last = items[items.length - 1];
    if (!last) return null;

    return {
      last_logged_at: last.last_logged_at,
      kind: last.kind,
      id: last.id,
      pct: safeInt(last.progress_pct),
    };
  }, [items]);

  // Load page 1 whenever userId or any server-side filter changes
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setLoadingMore(false);
      setHasMore(true);

      try {
        const first = await fetchUserCompletions({
          userId,
          limit: PAGE_SIZE,
          cursor: null,
          minPct: bounds.minPct,
          maxPct: bounds.maxPct,
          kind: filters.kind,
          sort: filters.sort,
        });

        if (cancelled) return;

        setItems(first);
        setHasMore(first.length === PAGE_SIZE);
      } catch {
        if (cancelled) return;
        setItems([]);
        setHasMore(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [userId, bounds.minPct, bounds.maxPct, filters.kind, filters.sort]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const next = await fetchUserCompletions({
        userId,
        limit: PAGE_SIZE,
        cursor,
        minPct: bounds.minPct,
        maxPct: bounds.maxPct,
        kind: filters.kind,
        sort: filters.sort,
      });

      setItems((prev) => {
        const seen = new Set(prev.map((x) => `${x.kind}:${x.id}`));
        const out = [...prev];
        for (const it of next) {
          const key = `${it.kind}:${it.id}`;
          if (!seen.has(key)) out.push(it);
        }
        return out;
      });

      setHasMore(next.length === PAGE_SIZE);
    } catch {
      // Don’t permanently flip hasMore=false on transient errors.
    } finally {
      setLoadingMore(false);
    }
  }, [
    bounds.minPct,
    bounds.maxPct,
    cursor,
    filters.kind,
    filters.sort,
    hasMore,
    loading,
    loadingMore,
    userId,
  ]);

  // No client-side reshuffle: server already did kind/sort/progress paging correctly.
  const visibleItems = items;

  const rows = useMemo(() => chunk(visibleItems, rowLimit), [visibleItems, rowLimit]);

  const RowComp =
    posterSize === "small"
      ? CompletionsCarouselRow
      : posterSize === "large"
        ? CompletionsCarouselRowLarge
        : CompletionsCarouselRowExtraLarge;

  function nextPosterSizeLabel(size: PosterSize) {
    if (size === "small") return "Bigger posters";
    if (size === "large") return "Extra big posters";
    return "Smaller posters";
  }

  function cyclePosterSize() {
    setPosterSize((s) => (s === "small" ? "large" : s === "large" ? "xlarge" : "small"));
  }

  function toggleViewMode() {
    setViewMode((m) => (m === "carousel" ? "list" : "carousel"));
  }

  function openDetails(it: CompletionItem) {
    if (!it.slug) return;

    const mapped: CompletionDetails = {
      id: it.id,
      slug: it.slug,
      title: it.title,
      kind: it.kind,
      image_url: it.image_url ?? null,
    };

    setSelected(mapped);
    setModalOpen(true);
  }

  function closeDetails() {
    setModalOpen(false);
    setSelected(null);
  }

  return (
    <div className="space-y-0">
      {/* FILTER ROW + top right controls */}
      <div className="flex items-center justify-between gap-2 pb-2">
        <div />
        <div className="flex items-center gap-2">
          <CompletionsFilterRow filters={filters} onChange={setFilters} />

          <button
            type="button"
            onClick={toggleViewMode}
            className="rounded-md border border-black bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-[0_1px_0_rgba(0,0,0,0.20)] hover:bg-slate-50 active:translate-y-[1px]"
          >
            {viewMode === "carousel" ? "List view" : "Carousel view"}
          </button>

          {viewMode === "carousel" ? (
            <button
              type="button"
              onClick={cyclePosterSize}
              className="rounded-md border border-black bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-[0_1px_0_rgba(0,0,0,0.20)] hover:bg-slate-50 active:translate-y-[1px]"
            >
              {nextPosterSizeLabel(posterSize)}
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="py-6 text-sm text-slate-600">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-6 text-sm text-slate-600">No completions yet.</div>
      ) : null}

      {/* VIEW: carousel */}
      {viewMode === "carousel" ? (
        <>
          {rows.map((rowItems, idx) => (
            <RowComp
              key={`completions-row-${idx}`}
              items={rowItems}
              onSelect={(it) => openDetails(it as CompletionItem)}
            />
          ))}
        </>
      ) : null}

      {/* VIEW: list */}
      {viewMode === "list" ? (
        <>
          <div className="space-y-2 pb-2">
            {visibleItems.map((it) => (
              <CompletionListItem
                key={`${it.kind}:${it.id}`}
                item={it}
                userId={userId}
                onSelect={openDetails}
              />
            ))}
          </div>

          <InfiniteSentinel disabled={!hasMore || loading || loadingMore} onVisible={loadMore} />

          {loadingMore ? <div className="py-4 text-xs text-slate-600">Loading more…</div> : null}
          {!loading && !loadingMore && visibleItems.length > 0 && !hasMore ? (
            <div className="py-4 text-xs text-slate-500">That’s everything.</div>
          ) : null}
        </>
      ) : null}

      <CompletionDetailsModal open={modalOpen} item={selected} onClose={closeDetails} userId={userId} />
    </div>
  );
}

function InfiniteSentinel({
  onVisible,
  disabled,
}: {
  onVisible: () => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (disabled) return;

    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) onVisible();
      },
      { root: null, rootMargin: "800px", threshold: 0 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [onVisible, disabled]);

  return <div ref={ref} className="h-1 w-full" />;
}
