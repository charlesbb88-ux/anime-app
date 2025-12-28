// lib/chapterNavigation.ts

export type NavGroup =
  | {
      kind: "volume";
      key: string; // stable key like "vol:1"
      chapters: number[]; // chapter numbers this button represents
      labelTop: string; // e.g. "Vol 1"
      labelBottom: string | null; // e.g. "1–15"
    }
  | {
      kind: "range";
      key: string; // stable key like "range:169-193"
      chapters: number[];
      labelTop: string; // e.g. "Ch"
      labelBottom: string; // e.g. "169–193"
    };

function isNumericLike(s: string) {
  return /^(\d+)(\.\d+)?$/.test(String(s).trim());
}

function sortVolumeKeys(keys: string[]) {
  const numeric: string[] = [];
  const other: string[] = [];

  for (const k of keys) {
    const s = String(k ?? "").trim();
    if (!s) continue;
    if (s.toLowerCase() === "none") continue;
    (isNumericLike(s) ? numeric : other).push(s);
  }

  numeric.sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (na !== nb) return na - nb;
    return a.localeCompare(b);
  });

  other.sort((a, b) => a.localeCompare(b));

  return [...numeric, ...other];
}

function toNumericChapterList(chs: string[]): number[] {
  const nums = (chs || [])
    .map((s) => String(s ?? "").trim())
    .filter((s) => isNumericLike(s))
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0);

  nums.sort((a, b) => a - b);
  return nums;
}

function formatRange(nums: number[]): string | null {
  if (!nums.length) return null;
  const min = Math.floor(nums[0]);
  const max = Math.floor(nums[nums.length - 1]);
  if (min === max) return String(min);
  return `${min}–${max}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * This version is intentionally "dumb":
 * - It uses the volumeMap exactly as-is (like you currently do)
 * - Then, if totalChapters exists, it adds "Ch" buttons in 25-chunk increments
 *   AFTER the highest chapter covered by volumes.
 *
 * NO "weirdness detection" yet. NO estimation yet.
 * This is step 1: extract behavior without changing it.
 */
export function buildChapterNavGroups(opts: {
  volumeMap: Record<string, string[]> | null;
  totalChapters: number | null;
  chunkSize?: number; // default 25
}): NavGroup[] {
  const { volumeMap, totalChapters } = opts;
  const chunkSize = Math.max(1, opts.chunkSize ?? 25);

  const groups: NavGroup[] = [];

  // ---------
  // volumes
  // ---------
  if (volumeMap) {
    const volKeys = sortVolumeKeys(Object.keys(volumeMap));

    for (const vk of volKeys) {
      const nums = toNumericChapterList(volumeMap[vk] || []);
      if (!nums.length) continue;

      groups.push({
        kind: "volume",
        key: `vol:${vk}`,
        chapters: nums,
        labelTop: `Vol ${vk}`,
        labelBottom: formatRange(nums),
      });
    }
  }

  // ---------
  // leftovers in 25-chunks after max volume chapter
  // ---------
  const total =
    typeof totalChapters === "number" && Number.isFinite(totalChapters) && totalChapters > 0
      ? Math.floor(totalChapters)
      : null;

  if (!total) return groups;

  // find max chapter covered by volumes
  let maxCovered = 0;
  for (const g of groups) {
    if (!g.chapters.length) continue;
    const last = g.chapters[g.chapters.length - 1];
    if (last > maxCovered) maxCovered = last;
  }

  // next start is maxCovered+1 (but at least 1, and not above total)
  let start = clamp(Math.floor(maxCovered) + 1, 1, total);

  // if volumes covered nothing, start at 1 (but in practice you already have All mode)
  // we keep it consistent anyway.
  if (maxCovered <= 0) start = 1;

  while (start <= total) {
    const end = Math.min(total, start + chunkSize - 1);
    const nums: number[] = [];
    for (let n = start; n <= end; n++) nums.push(n);

    groups.push({
      kind: "range",
      key: `range:${start}-${end}`,
      chapters: nums,
      labelTop: "Ch",
      labelBottom: `${start}–${end}`,
    });

    start = end + 1;
  }

  return groups;
}
