// lib/titleLanguage.ts

// Basic Unicode ranges for some common scripts.
// (Not exhaustive, but enough to catch "obviously not English".)
const reCJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uF900-\uFAFF]/; // JP Kana + CJK
const reHangul = /[\uac00-\ud7af]/; // Korean
const reCyrillic = /[\u0400-\u04FF]/; // Russian etc.
const reArabic = /[\u0600-\u06FF]/;
const reThai = /[\u0E00-\u0E7F]/;
const reDevanagari = /[\u0900-\u097F]/;

const commonEnglishWords = new Set([
  "the","and","of","to","in","a","an","for","with","on","at","from","by","is","are","was","were",
  "my","your","his","her","their","our","not","no","yes","love","girl","boy","king","queen","hero",
]);

function tokenizeAsciiWords(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// Returns a score 0..1 where higher = "more likely English"
export function englishLikelihood(input: string): number {
  const s = (input ?? "").trim();
  if (!s) return 0;

  // If it contains lots of non-Latin scripts, it's probably not English.
  // (English titles can contain a few symbols, but not full CJK/Hangul/etc.)
  if (
    reCJK.test(s) ||
    reHangul.test(s) ||
    reCyrillic.test(s) ||
    reArabic.test(s) ||
    reThai.test(s) ||
    reDevanagari.test(s)
  ) {
    return 0;
  }

  // Count ASCII letters ratio
  const letters = s.match(/[A-Za-z]/g)?.length ?? 0;
  const total = s.replace(/\s+/g, "").length;
  const asciiRatio = total > 0 ? letters / total : 0;

  // English titles usually have a decent amount of A-Z
  // (but allow short titles like "IT")
  const base = Math.min(1, Math.max(0, (asciiRatio - 0.15) / 0.6)); // maps ~0.15..0.75 -> 0..1

  // Common English word hint
  const words = tokenizeAsciiWords(s);
  const hitCount = words.reduce((acc, w) => acc + (commonEnglishWords.has(w) ? 1 : 0), 0);
  const wordBoost = Math.min(0.35, hitCount * 0.12);

  // Penalize “almost no vowels” which often indicates romanized non-English
  const vowelCount = (s.match(/[aeiouAEIOU]/g)?.length ?? 0);
  const vowelRatio = letters > 0 ? vowelCount / letters : 0;
  const vowelPenalty = vowelRatio < 0.18 && letters >= 6 ? 0.25 : 0;

  // Penalize super punctuation-heavy strings
  const punct = (s.match(/[^A-Za-z0-9\s]/g)?.length ?? 0);
  const punctPenalty = punct >= 8 ? 0.15 : 0;

  const score = base + wordBoost - vowelPenalty - punctPenalty;
  return Math.min(1, Math.max(0, score));
}

export function looksEnglish(input: string, threshold = 0.55): boolean {
  return englishLikelihood(input) >= threshold;
}
