"use client";

import React, { useEffect, useMemo, useState } from "react";
import CompletionsCarouselRow from "./CompletionsCarouselRow";
import CompletionsCarouselRowLarge from "./CompletionsCarouselRowLarge";
import CompletionsCarouselRowExtraLarge from "./CompletionsCarouselRowExtraLarge";
import CompletionListItem from "./CompletionListItem";
import { fetchUserCompletions, type CompletionItem } from "@/lib/completions";
import CompletionDetailsModal, { type CompletionDetails } from "./CompletionDetailsModal";

import CompletionsFilterRow from "./CompletionsFilterRow";
import {
  applyCompletionsFilters,
  DEFAULT_COMPLETIONS_FILTERS,
  type CompletionsFilters,
  type ProgressByKey,
} from "./completionsFilters";

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

export default function CompletionsPageShell({ userId }: Props) {
  const [items, setItems] = useState<CompletionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // NEW: batch progress state
  const [progressByKey, setProgressByKey] = useState<ProgressByKey>({});

  const [progressLoading, setProgressLoading] = useState(false);

  const [posterSize, setPosterSize] = useState<PosterSize>("small");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const [filters, setFilters] = useState<CompletionsFilters>(DEFAULT_COMPLETIONS_FILTERS);

  const [selected, setSelected] = useState<CompletionDetails | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const rowLimit = posterSize === "small" ? 40 : posterSize === "large" ? 30 : 15;

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      try {
        const data = await fetchUserCompletions(userId);
        if (!cancelled) setItems(data);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // NEW: after items load, fetch progress-batch once
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (items.length === 0) {
        setProgressByKey({});
        return;
      }

      setProgressLoading(true);
      try {
        const resp = await fetch("/api/completions/progress-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            userId,
            items: items.map((it) => ({ id: it.id, kind: it.kind })),
          }),
        });

        if (!resp.ok) throw new Error(String(resp.status));

        const data = (await resp.json()) as {
          byKey: Record<string, { current: number; total: number; pct: number | null }>;
        };
        if (!cancelled) setProgressByKey(data.byKey ?? {});
      } catch {
        if (!cancelled) setProgressByKey({});
      } finally {
        if (!cancelled) setProgressLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [items, userId]);

  const filteredItems = useMemo(
    () => applyCompletionsFilters(items, filters, progressByKey),
    [items, filters, progressByKey]
  );

  const rows = useMemo(() => chunk(filteredItems, rowLimit), [filteredItems, rowLimit]);

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
      ) : filteredItems.length === 0 ? (
        <div className="py-6 text-sm text-slate-600">No titles match those filters.</div>
      ) : null}

      {/* VIEW: carousel */}
      {viewMode === "carousel" ? (
        <>
          {rows.map((rowItems, idx) => (
            <RowComp key={`completions-row-${idx}`} items={rowItems} onSelect={(it) => openDetails(it as CompletionItem)} />
          ))}
        </>
      ) : null}

      {/* VIEW: list */}
      {viewMode === "list" ? (
        <div className="space-y-2 pb-2">
          {filteredItems.map((it) => (
            <CompletionListItem
              key={it.id}
              item={it}
              userId={userId}
              onSelect={(x) => openDetails(x)}
            // NOTE: progressByKey/progressLoading are now available in the shell if you want to thread them down next.
            // progress={progressByKey[`${it.kind}:${it.id}`]}
            // progressLoading={progressLoading}
            />
          ))}
        </div>
      ) : null}

      <CompletionDetailsModal open={modalOpen} item={selected} onClose={closeDetails} userId={userId} />
    </div>
  );
}
