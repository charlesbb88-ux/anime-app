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

  // Interleave so it feels “mixed” (anime/manga alternating-ish)
  const out: CompletionItem[] = [];
  const max = Math.max(anime.length, manga.length);

  for (let i = 0; i < max; i++) {
    if (anime[i]) out.push(anime[i]);
    if (manga[i]) out.push(manga[i]);
  }

  return out;
}

export default function CompletionsPageShell() {
  const items = useMemo(() => makeMixedPlaceholders(34, 28), []);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-black px-6 py-5">
        <h1 className="text-xl font-semibold text-slate-900">Completions</h1>
        <p className="mt-2 text-sm text-slate-700">
          Placeholder layout for your logged anime + manga (mixed together). Next step will be wiring real data.
        </p>
      </div>

      <CompletionsCarouselRow title="All logged (anime + manga)" items={items} />
    </div>
  );
}
