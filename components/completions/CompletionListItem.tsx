"use client";

import React from "react";
import type { CompletionItem } from "@/lib/completions";
import MiniProgressRing from "./MiniProgressRing";

type Props = {
    item: CompletionItem;
    userId: string; // keep prop so parent doesn’t need changes; unused now
    onSelect: (it: CompletionItem) => void;
};

/** same colors you used in the modal */
const RING_FILLED_PROGRESS = "#0EA5E9";
const RING_FILLED_REVIEWED = "#22C55E";
const RING_FILLED_RATED = "#EF4444";

function safeInt(v: unknown) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

export default function CompletionListItem({ item, onSelect }: Props) {
    // These now come directly from get_user_completions_with_stats
    const progressCurrent = safeInt((item as any).progress_current);
    const progressTotal = safeInt((item as any).progress_total);

    const reviewedCount = safeInt((item as any).reviewed_count);
    const ratedCount = safeInt((item as any).rated_count);

    // Guard: avoid 0 total (your SQL should already enforce 1 for empty series, but this is extra safety)
    const totalForRings = progressTotal > 0 ? progressTotal : 1;

    return (
        <button type="button" onClick={() => onSelect(item)} className="w-full">
            <div className="flex items-center gap-3 rounded-xs border border-black bg-white px-3 py-2 hover:bg-slate-50 active:translate-y-[1px]">
                {/* poster */}
                <div className="h-18 w-18 shrink-0 overflow-hidden rounded-md bg-slate-100">
                    {item.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={item.image_url}
                            alt={item.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                        />
                    ) : null}
                </div>

                {/* text */}
                <div className="min-w-0 flex-1 text-left">
                    <div className="truncate text-lg font-semibold text-slate-900">{item.title}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-black">
                        <span className="rounded-md border border-black bg-white px-1.5 py-0.5">
                            {item.kind === "manga" ? "Manga" : "Anime"}
                        </span>
                    </div>
                </div>

                {/* mini rings (right side) */}
                {/* mini rings (right side) */}
                <div className="pointer-events-none flex shrink-0 items-center gap-2">
                    {/* progress */}
                    <MiniProgressRing
                        current={progressCurrent}
                        total={totalForRings}
                        kind={item.kind}
                        slug={item.slug}
                        filledColor={RING_FILLED_PROGRESS}
                    />

                    {/* reviewed */}
                    <MiniProgressRing
                        current={reviewedCount}
                        total={totalForRings}
                        kind={item.kind}
                        slug={item.slug}
                        filledColor={RING_FILLED_REVIEWED}
                    />

                    {/* rated */}
                    <MiniProgressRing
                        current={ratedCount}
                        total={totalForRings}
                        kind={item.kind}
                        slug={item.slug}
                        filledColor={RING_FILLED_RATED}
                    />
                </div>
            </div>
        </button>
    );
}
