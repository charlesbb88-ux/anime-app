"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CompletionsCarouselRow from "./CompletionsCarouselRow";
import CompletionListItem from "./CompletionListItem";
import {
  fetchCompletionBucketCounts,
  fetchUserCompletions,
  type CompletionCursor,
  type CompletionItem,
  type ProgressBucket,
} from "@/lib/completions";
import CompletionDetailsModal, { type CompletionDetails } from "./CompletionDetailsModal";

import CompletionsFilterRow from "./CompletionsFilterRow";
import { DEFAULT_COMPLETIONS_FILTERS, type CompletionsFilters, type ProgressFilter } from "./completionsFilters";

type Props = {
  userId: string;
};

type ViewMode = "carousel" | "list";

function chunk<T>(arr: T[], size: number) {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

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

function normalizeSearch(s: string) {
  return (s ?? "").trim().toLowerCase();
}

export default function CompletionsPageShell({ userId }: Props) {
  const [items, setItems] = useState<CompletionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const [filters, setFilters] = useState<CompletionsFilters>(DEFAULT_COMPLETIONS_FILTERS);

  const [selected, setSelected] = useState<CompletionDetails | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // fixed carousel row size (normal posters only)
  const rowLimit = 40;

  const bounds = useMemo(() => progressBounds(filters.progress), [filters.progress]);

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

  // ✅ Step 3 — Store counts in CompletionsPageShell and pass to the filter row
  const [bucketCounts, setBucketCounts] = useState<Record<string, ProgressBucket>>({});

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const rows = await fetchCompletionBucketCounts({
          userId,
          kind: filters.kind,
          search: filters.search,
        });
        if (cancelled) return;

        const map: Record<string, ProgressBucket> = {};
        for (const r of rows) map[r.bucket] = r;
        setBucketCounts(map);
      } catch {
        if (!cancelled) setBucketCounts({});
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [userId, filters.kind, filters.search]);

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
    // NOTE: search is intentionally NOT here (client-side only)
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
      // transient errors: do nothing special
    } finally {
      setLoadingMore(false);
    }
  }, [bounds.minPct, bounds.maxPct, cursor, filters.kind, filters.sort, hasMore, loading, loadingMore, userId]);

  // Client-side search filter (safe: does not affect pagination/cursor)
  const visibleItems = useMemo(() => {
    const q = normalizeSearch(filters.search);
    if (!q) return items;

    return items.filter((it) => {
      const titles = [
        (it as any).title,
        (it as any).title_english,
        (it as any).title_native,
        (it as any).title_preferred,
      ]
        .filter(Boolean)
        .map((t: string) => t.toLowerCase());

      return titles.some((t) => t.includes(q));
    });
  }, [items, filters.search]);

  const rows = useMemo(() => chunk(visibleItems, rowLimit), [visibleItems, rowLimit]);

  function toggleViewMode() {
    setViewMode((m: ViewMode) => (m === "carousel" ? "list" : "carousel"));
  }

  function openDetails(it: CompletionItem) {
    if (!it.slug) return;

    const mapped: CompletionDetails = {
      id: it.id,
      slug: it.slug,
      title: it.title,
      title_english: (it as any).title_english ?? null,
      title_native: (it as any).title_native ?? null,
      title_preferred: (it as any).title_preferred ?? null,
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
      <div className="pb-2">
        <div className="flex justify-center">
          <CompletionsFilterRow
            filters={filters}
            onChange={setFilters}
            viewMode={viewMode}
            onToggleViewMode={toggleViewMode}
            bucketCounts={bucketCounts}
          />
        </div>
      </div>

      {loading ? (
        <div className="py-6 text-sm text-slate-600">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-6 text-sm text-slate-600">No completions yet.</div>
      ) : !loading && items.length > 0 && visibleItems.length === 0 ? (
        <div className="py-6 text-sm text-slate-600">No matches.</div>
      ) : null}

      {viewMode === "carousel" ? (
        <>
          {rows.map((rowItems, idx) => (
            <CompletionsCarouselRow
              key={`completions-row-${idx}`}
              items={rowItems}
              onSelect={(it) => openDetails(it as CompletionItem)}
            />
          ))}
        </>
      ) : null}

      {viewMode === "list" ? (
        <>
          <div className="space-y-1.5 pb-2">
            {visibleItems.map((it) => (
              <CompletionListItem key={`${it.kind}:${it.id}`} item={it} userId={userId} onSelect={openDetails} />
            ))}
          </div>

          <InfiniteSentinel disabled={!hasMore || loading || loadingMore} onVisible={loadMore} />

          {loadingMore ? <div className="py-4 text-xs text-slate-600">Loading more…</div> : null}
        </>
      ) : null}

      <CompletionDetailsModal open={modalOpen} item={selected} onClose={closeDetails} userId={userId} />
    </div>
  );
}

function InfiniteSentinel({ onVisible, disabled }: { onVisible: () => void; disabled?: boolean }) {
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
