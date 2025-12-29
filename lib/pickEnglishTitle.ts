import { englishLikelihood } from "@/lib/titleLanguage";

type TitleCandidates = Record<string, string | null | undefined>;

export function pickEnglishTitle(
  titles: TitleCandidates,
  opts?: {
    preferredKeys?: string[];
    fallbackKeys?: string[];
    minScore?: number;
  }
): { value: string; sourceKey: string; score: number } | null {
  // Your real columns:
  // title, title_english, title_native, title_preferred
  const preferredKeys = opts?.preferredKeys ?? [
    "title_english",
    "title_preferred",
    "title",
    "title_native",
  ];

  const fallbackKeys = opts?.fallbackKeys ?? preferredKeys;
  const minScore = opts?.minScore ?? 0.55;

  const scored: Array<{ key: string; value: string; score: number }> = [];

  for (const [key, raw] of Object.entries(titles)) {
    const value = (raw ?? "").trim();
    if (!value) continue;
    scored.push({ key, value, score: englishLikelihood(value) });
  }

  if (scored.length === 0) return null;

  // 1) Best within preferredKeys above threshold
  const preferredSet = new Set(preferredKeys);
  const bestPreferred = scored
    .filter(x => preferredSet.has(x.key))
    .sort((a, b) => b.score - a.score)[0];

  if (bestPreferred && bestPreferred.score >= minScore) {
    return { value: bestPreferred.value, sourceKey: bestPreferred.key, score: bestPreferred.score };
  }

  // 2) Best anywhere above threshold
  const bestAny = scored.sort((a, b) => b.score - a.score)[0];
  if (bestAny && bestAny.score >= minScore) {
    return { value: bestAny.value, sourceKey: bestAny.key, score: bestAny.score };
  }

  // 3) Fallback by your preferred order
  for (const k of fallbackKeys) {
    const v = (titles[k] ?? "").trim();
    if (v) return { value: v, sourceKey: k, score: englishLikelihood(v) };
  }

  // 4) Absolute fallback: whatever is “best”
  if (bestAny) return { value: bestAny.value, sourceKey: bestAny.key, score: englishLikelihood(bestAny.value) };

  return null;
}
