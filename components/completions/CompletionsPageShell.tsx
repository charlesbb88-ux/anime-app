// components/completions/CompletionsPageShell.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import CompletionsCarouselRow from "./CompletionsCarouselRow";
import { fetchUserCompletions, type CompletionItem } from "@/lib/completions";

type Props = {
  userId: string;
};

function chunk<T>(arr: T[], size: number) {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function CompletionsPageShell({ userId }: Props) {
  const [items, setItems] = useState<CompletionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // how many posters per row
  const ROW_LIMIT = 40;

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

  const rows = useMemo(() => chunk(items, ROW_LIMIT), [items]);

  return (
    <div className="space-y-0">
      {loading ? (
        <div className="py-6 text-sm text-slate-600">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-6 text-sm text-slate-600">No completions yet.</div>
      ) : null}

      {rows.map((rowItems, idx) => (
        <CompletionsCarouselRow key={`completions-row-${idx}`} items={rowItems} />
      ))}
    </div>
  );
}
