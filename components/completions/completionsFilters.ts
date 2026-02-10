// components/completions/completionsFilters.ts
import type { CompletionItem } from "@/lib/completions";

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
    | "0-9"
    | "unknown";

export const PROGRESS_FILTER_OPTIONS: { value: ProgressFilter; label: string }[] = [
    { value: "all", label: "All progress" },
    { value: "100", label: "100% complete" },
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
    { value: "unknown", label: "Unknown progress" },
];

export type CompletionsFilters = {
    progress: ProgressFilter;

    // Future filters can live here without bloating the shell:
    // yearPublished: "all" | number;
    // monthPublished: "all" | number; // 1-12
    // dateLoggedFrom: string | null;
    // dateLoggedTo: string | null;
};

export const DEFAULT_COMPLETIONS_FILTERS: CompletionsFilters = {
    progress: "all",
};

function normalizePct(pct: number | null | undefined) {
    if (pct == null || !Number.isFinite(pct)) return null;
    return Math.max(0, Math.min(100, Math.floor(pct)));
}

export function matchesProgressFilter(pct: number | null | undefined, f: ProgressFilter) {
    if (f === "all") return true;

    const clamped = normalizePct(pct);
    if (clamped == null) return f === "unknown";

    if (f === "100") return clamped === 100;

    const parts = f.split("-");
    if (parts.length !== 2) return true;

    const lo = Number(parts[0]);
    const hi = Number(parts[1]);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return true;

    return clamped >= lo && clamped <= hi;
}

/**
 * Central place to apply all filters.
 * As you add more filters later, you ONLY edit this file.
 */
export type ProgressByKey = Record<string, { current: number; total: number; pct: number | null }>;

export function applyCompletionsFilters(
    items: CompletionItem[],
    filters: CompletionsFilters,
    progressByKey: ProgressByKey
) {
    return items.filter((it) => {
        // Look up progress percent from the batch map:
        // key format MUST match what we used in the API route: `${kind}:${id}`
        const key = `${it.kind}:${it.id}`;
        const pct = progressByKey[key]?.pct;

        if (!matchesProgressFilter(pct, filters.progress)) return false;

        // Future filters go here later (year/month/date/etc)

        return true;
    });
}

