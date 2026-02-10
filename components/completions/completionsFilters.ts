// components/completions/completionsFilters.ts
import type { CompletionItem } from "@/lib/completions";

/* -------------------- Progress filter -------------------- */

export type ProgressFilter =
  | "all"
  | "100"
  | "90-99"
  | "80-89"
  | "70-79"
  | "60-69"
  | "50-59"
  | "40-49"
  | "30-39"
  | "20-29"
  | "10-19"
  | "0-9";

export const PROGRESS_FILTER_OPTIONS: { value: ProgressFilter; label: string }[] = [
  { value: "all", label: "All progress" },
  { value: "100", label: "100% done" },
  { value: "90-99", label: "90–99%" },
  { value: "80-89", label: "80–89%" },
  { value: "70-79", label: "70–79%" },
  { value: "60-69", label: "60–69%" },
  { value: "50-59", label: "50–59%" },
  { value: "40-49", label: "40–49%" },
  { value: "30-39", label: "30–39%" },
  { value: "20-29", label: "20–29%" },
  { value: "10-19", label: "10–19%" },
  { value: "0-9", label: "0–9%" },
];

/* -------------------- Kind filter -------------------- */

export type KindFilter = "all" | "anime" | "manga";

export const KIND_FILTER_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "anime", label: "Anime only" },
  { value: "manga", label: "Manga only" },
];

/* -------------------- Sort filter -------------------- */

export type SortFilter = "last_logged" | "pct_desc" | "pct_asc";

export const SORT_FILTER_OPTIONS: { value: SortFilter; label: string }[] = [
  { value: "last_logged", label: "Sort: Last logged" },
  { value: "pct_desc", label: "Sort: Most complete" },
  { value: "pct_asc", label: "Sort: Least complete" },
];

/* -------------------- Filters model -------------------- */

export type CompletionsFilters = {
  progress: ProgressFilter;
  kind: KindFilter;
  sort: SortFilter;
};

export const DEFAULT_COMPLETIONS_FILTERS: CompletionsFilters = {
  progress: "all",
  kind: "all",
  sort: "last_logged",
};

/* -------------------- Helpers -------------------- */

function pctOf(it: CompletionItem) {
  const n = Number(it.progress_pct);
  return Number.isFinite(n) ? n : 0;
}

function timeMsOrNull(it: CompletionItem) {
  if (!it.last_logged_at) return null;
  const t = Date.parse(it.last_logged_at);
  return Number.isFinite(t) ? t : null;
}

/**
 * Stable tie-breaker that is ALWAYS the same direction:
 * - We want descending by default for "id key" so results don't flip randomly.
 */
function keyOf(it: CompletionItem) {
  // kind then id is fine; id is uuid so stable
  return `${it.kind}:${it.id}`;
}

function compareKeyDesc(a: CompletionItem, b: CompletionItem) {
  return keyOf(b).localeCompare(keyOf(a));
}

/* -------------------- Implementation -------------------- */

export function applyCompletionsFilters(items: CompletionItem[], filters: CompletionsFilters) {
  let out = items;

  // 1) kind
  if (filters.kind !== "all") {
    out = out.filter((it) => it.kind === filters.kind);
  }

  // 2) progress (client-side mode)
  const pf = filters.progress;
  if (pf !== "all") {
    if (pf === "100") {
      out = out.filter((it) => pctOf(it) >= 100);
    } else {
      const m = /^(\d{1,3})-(\d{1,3})$/.exec(pf);
      if (m) {
        const min = Number(m[1]);
        const max = Number(m[2]);
        out = out.filter((it) => {
          const p = pctOf(it);
          return p >= min && p <= max;
        });
      }
    }
  }

  // 3) sort (stable)
  const s = filters.sort;

  if (s === "pct_desc") {
    return [...out].sort((a, b) => {
      const d = pctOf(b) - pctOf(a);
      if (d !== 0) return d;

      // secondary: last_logged desc (real dates first)
      const ta = timeMsOrNull(a);
      const tb = timeMsOrNull(b);
      if (ta !== tb) {
        if (ta === null) return 1;  // null goes last
        if (tb === null) return -1;
        return tb - ta;
      }

      return compareKeyDesc(a, b);
    });
  }

  if (s === "pct_asc") {
    return [...out].sort((a, b) => {
      const d = pctOf(a) - pctOf(b);
      if (d !== 0) return d;

      // secondary: last_logged desc (still show recently touched first within same pct)
      const ta = timeMsOrNull(a);
      const tb = timeMsOrNull(b);
      if (ta !== tb) {
        if (ta === null) return 1;
        if (tb === null) return -1;
        return tb - ta;
      }

      return compareKeyDesc(a, b);
    });
  }

  // last_logged
  return [...out].sort((a, b) => {
    const ta = timeMsOrNull(a);
    const tb = timeMsOrNull(b);

    // real dates first, nulls last
    if (ta !== tb) {
      if (ta === null) return 1;
      if (tb === null) return -1;
      return tb - ta; // desc
    }

    // secondary: pct desc (optional but feels good)
    const d = pctOf(b) - pctOf(a);
    if (d !== 0) return d;

    return compareKeyDesc(a, b);
  });
}
