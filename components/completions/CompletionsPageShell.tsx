// components/completions/CompletionsPageShell.tsx
import React, { useMemo } from "react";
import CompletionsCarouselRow from "./CompletionsCarouselRow";

type CompletionItem = {
  id: string;
  title: string;
  kind: "anime" | "manga";
};

function makeMixedPlaceholders(animeCount: number, mangaCount: number) {
  const anime: CompletionItem[] = Array.from({ length: animeCount }).map((_, i) => ({
    id: `anime-${i + 1}`,
    title: `Anime #${i + 1}`,
    kind: "anime",
  }));

  const manga: CompletionItem[] = Array.from({ length: mangaCount }).map((_, i) => ({
    id: `manga-${i + 1}`,
    title: `Manga #${i + 1}`,
    kind: "manga",
  }));

  const out: CompletionItem[] = [];
  const max = Math.max(anime.length, manga.length);

  for (let i = 0; i < max; i++) {
    if (anime[i]) out.push(anime[i]);
    if (manga[i]) out.push(manga[i]);
  }

  return out;
}

function chunk<T>(arr: T[], size: number) {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export default function CompletionsPageShell() {
  // ✅ later this becomes your real query result; chunking stays the same
  const allItems = useMemo(() => makeMixedPlaceholders(100, 100), []);

  // ✅ how many posters per row
  const ROW_LIMIT = 40;

  const rows = useMemo(() => chunk(allItems, ROW_LIMIT), [allItems]);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-black px-6 py-5">
        <h1 className="text-xl font-semibold text-slate-900">Completions</h1>
        <p className="mt-2 text-sm text-slate-700">
          Placeholder layout for your logged anime + manga (mixed together). Next step will be wiring real data.
        </p>
        <p className="mt-2 text-xs text-slate-600">
          Showing {allItems.length} total • {ROW_LIMIT} per row • {rows.length} rows
        </p>
      </div>

      {rows.map((items, idx) => (
        <CompletionsCarouselRow
          key={`completions-row-${idx}`}
          title={idx === 0 ? "All logged (anime + manga)" : `All logged (continued ${idx + 1})`}
          items={items}
        />
      ))}
    </div>
  );
}
