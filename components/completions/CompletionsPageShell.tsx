"use client";

import React, { useEffect, useMemo, useState } from "react";
import CompletionsCarouselRow from "./CompletionsCarouselRow";
import CompletionsCarouselRowLarge from "./CompletionsCarouselRowLarge";
import CompletionsCarouselRowExtraLarge from "./CompletionsCarouselRowExtraLarge";
import { fetchUserCompletions, type CompletionItem } from "@/lib/completions";
import CompletionDetailsModal, { type CompletionDetails } from "./CompletionDetailsModal";

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

export default function CompletionsPageShell({ userId }: Props) {
  const [items, setItems] = useState<CompletionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [posterSize, setPosterSize] = useState<PosterSize>("small");

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

  const rows = useMemo(() => chunk(items, rowLimit), [items, rowLimit]);

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

  function openDetails(it: CompletionItem) {
    // If slug is missing, don't open a broken modal.
    // (Optional: you could still open it but disable the Link.)
    if (!it.slug) return;

    const mapped: CompletionDetails = {
      id: it.id,
      slug: it.slug, // ✅ add this
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
      <div className="flex items-center justify-end pb-2">
        <button
          type="button"
          onClick={cyclePosterSize}
          className="rounded-md border border-black bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-[0_1px_0_rgba(0,0,0,0.20)] hover:bg-slate-50 active:translate-y-[1px]"
        >
          {nextPosterSizeLabel(posterSize)}
        </button>
      </div>

      {loading ? (
        <div className="py-6 text-sm text-slate-600">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-6 text-sm text-slate-600">No completions yet.</div>
      ) : null}

      {rows.map((rowItems, idx) => (
        <RowComp
          key={`completions-row-${idx}`}
          items={rowItems}
          onSelect={(it) => openDetails(it as CompletionItem)}
        />
      ))}

      <CompletionDetailsModal
        open={modalOpen}
        item={selected}
        onClose={closeDetails}
        userId={userId}
      />
    </div>
  );
}
