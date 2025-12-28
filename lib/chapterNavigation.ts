// lib/chapterNavigation.ts

export type NavGroup =
  | {
      kind: "volume";
      key: string; // stable key like "vol:1"
      chapters: number[];
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

function isStrictlyIncreasing(nums: number[]) {
  for (let i = 1; i < nums.length; i++) {
    if (!(nums[i] > nums[i - 1])) return false;
  }
  return true;
}

type ParsedVolume = {
  volKey: string;
  nums: number[];
  min: number;
  max: number;
};

function parseVolumes(volumeMap: Record<string, string[]>) {
  const keys = sortVolumeKeys(Object.keys(volumeMap));
  const vols: ParsedVolume[] = [];

  for (const vk of keys) {
    const nums = toNumericChapterList(volumeMap[vk] || []);
    if (!nums.length) continue;

    const min = Math.floor(nums[0]);
    const max = Math.floor(nums[nums.length - 1]);

    vols.push({ volKey: vk, nums, min, max });
  }

  return vols;
}

/**
 * Mark as weird if:
 * - any volume isn't strictly increasing
 * - later volume starts <= previous volume start (reset)
 * - overlap is heavy (dupRate > 0.35)
 */
function isWeirdVolumeMap(vols: ParsedVolume[]) {
  if (vols.length === 0) return false;

  for (const v of vols) {
    if (!isStrictlyIncreasing(v.nums)) return true;
    if (v.min < 1) return true;
  }

  for (let i = 1; i < vols.length; i++) {
    if (vols[i].min <= vols[i - 1].min) return true;
  }

  const sets: Array<Set<number>> = vols.map((v) => {
    const s = new Set<number>();
    for (const n of v.nums) s.add(Math.floor(n));
    return s;
  });

  const global = new Set<number>();
  for (const s of sets) for (const n of s) global.add(n);

  const totalUnique = global.size;
  if (totalUnique === 0) return false;

  let totalReported = 0;
  for (const s of sets) totalReported += s.size;

  const dupRate = (totalReported - totalUnique) / totalUnique;
  if (dupRate > 0.35) return true;

  return false;
}

function buildEstimatedVolumes(opts: {
  volKeys: string[];
  maxMentioned: number;
}): ParsedVolume[] {
  const { volKeys, maxMentioned } = opts;
  const vcount = volKeys.length;
  if (vcount === 0 || maxMentioned <= 0) return [];

  const per = Math.floor(maxMentioned / vcount);
  const rem = maxMentioned % vcount;

  const out: ParsedVolume[] = [];
  let start = 1;

  for (let i = 0; i < vcount; i++) {
    const size = per + (i < rem ? 1 : 0);
    const end = Math.max(start, start + size - 1);

    const nums: number[] = [];
    for (let n = start; n <= end; n++) nums.push(n);

    out.push({
      volKey: volKeys[i],
      nums,
      min: start,
      max: end,
    });

    start = end + 1;
  }

  return out;
}

export function buildChapterNavGroups(opts: {
  volumeMap: Record<string, string[]> | null;
  totalChapters: number | null;
  chunkSize?: number;
}): NavGroup[] {
  const { volumeMap } = opts;
  const chunkSize = Math.max(1, opts.chunkSize ?? 25);

  const total =
    typeof opts.totalChapters === "number" &&
    Number.isFinite(opts.totalChapters) &&
    opts.totalChapters > 0
      ? Math.floor(opts.totalChapters)
      : null;

  const groups: NavGroup[] = [];

  // No map => just chunk ranges (if total known)
  if (!volumeMap) {
    if (total) {
      let start = 1;
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
    }
    return groups;
  }

  const parsed = parseVolumes(volumeMap);

  // parsed empty => just chunk ranges
  if (parsed.length === 0) {
    if (total) {
      let start = 1;
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
    }
    return groups;
  }

  const weird = isWeirdVolumeMap(parsed);

  let volumesToUse: ParsedVolume[] = parsed;

  if (weird) {
    let maxMentioned = 0;
    for (const v of parsed) {
      if (v.max > maxMentioned) maxMentioned = v.max;
    }

    const volKeys = parsed.map((v) => v.volKey);
    volumesToUse = buildEstimatedVolumes({ volKeys, maxMentioned });
  }

  // Build volume groups
  let lastCovered = 0;
  for (const v of volumesToUse) {
    if (!v.nums.length) continue;

    groups.push({
      kind: "volume",
      key: `vol:${v.volKey}`,
      chapters: v.nums,
      labelTop: `Vol ${v.volKey}`,
      labelBottom: formatRange(v.nums),
    });

    lastCovered = Math.max(lastCovered, v.max);
  }

  // Leftover chunk groups after lastCovered
  if (total && total > lastCovered) {
    let start = clamp(lastCovered + 1, 1, total);

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
  }

  return groups;
}
