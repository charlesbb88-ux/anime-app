"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { CompletionItem } from "@/lib/completions";
import MiniProgressRing from "./MiniProgressRing";

type Props = {
    item: CompletionItem;
    userId: string;
    onSelect: (it: CompletionItem) => void;
};

/** same colors you used in the modal */
const RING_FILLED_PROGRESS = "#0EA5E9";
const RING_FILLED_REVIEWED = "#22C55E";
const RING_FILLED_RATED = "#EF4444";

function safeNum(v: unknown) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

/** simple in-memory caches so rows don’t refetch constantly */
const progressCache = new Map<string, { current: number; total: number }>();
const engagementCache = new Map<string, { reviewed: number; rated: number }>();

type ProgressState =
    | { status: "loading" }
    | { status: "ready"; current: number; total: number }
    | { status: "error" };

type EngagementState =
    | { status: "loading" }
    | { status: "ready"; reviewed: number; rated: number }
    | { status: "error" };

export default function CompletionListItem({ item, userId, onSelect }: Props) {
    const cacheKey = useMemo(() => `${userId}:${item.kind}:${item.id}`, [userId, item.kind, item.id]);

    const [progress, setProgress] = useState<ProgressState>(() => {
        const cached = progressCache.get(cacheKey);
        return cached ? { status: "ready", ...cached } : { status: "loading" };
    });

    const [engagement, setEngagement] = useState<EngagementState>(() => {
        const cached = engagementCache.get(cacheKey);
        return cached ? { status: "ready", ...cached } : { status: "loading" };
    });

    useEffect(() => {
        const pc = progressCache.get(cacheKey);
        if (pc) {
            setProgress({ status: "ready", ...pc });
            return;
        }

        let cancelled = false;
        setProgress({ status: "loading" });

        const qs = new URLSearchParams({ userId, id: item.id, kind: item.kind });

        fetch(`/api/completions/progress?${qs.toString()}`, { cache: "no-store" })
            .then((r) => {
                if (!r.ok) throw new Error(String(r.status));
                return r.json() as Promise<{ current?: unknown; total?: unknown }>;
            })
            .then((data) => {
                if (cancelled) return;
                const val = { current: safeNum(data.current), total: safeNum(data.total) };
                progressCache.set(cacheKey, val);
                setProgress({ status: "ready", ...val });
            })
            .catch(() => {
                if (cancelled) return;
                setProgress({ status: "error" });
            });

        return () => {
            cancelled = true;
        };
    }, [cacheKey, userId, item.id, item.kind]);

    useEffect(() => {
        const ec = engagementCache.get(cacheKey);
        if (ec) {
            setEngagement({ status: "ready", ...ec });
            return;
        }

        let cancelled = false;
        setEngagement({ status: "loading" });

        const qs = new URLSearchParams({ userId, id: item.id, kind: item.kind });

        fetch(`/api/completions/engagement?${qs.toString()}`, { cache: "no-store" })
            .then((r) => {
                if (!r.ok) throw new Error(String(r.status));
                return r.json() as Promise<{ reviewed?: unknown; rated?: unknown }>;
            })
            .then((data) => {
                if (cancelled) return;
                const val = { reviewed: safeNum(data.reviewed), rated: safeNum(data.rated) };
                engagementCache.set(cacheKey, val);
                setEngagement({ status: "ready", ...val });
            })
            .catch(() => {
                if (cancelled) return;
                setEngagement({ status: "error" });
            });

        return () => {
            cancelled = true;
        };
    }, [cacheKey, userId, item.id, item.kind]);

    const totalForEngagement = progress.status === "ready" ? progress.total : 0;

    return (
        <button type="button" onClick={() => onSelect(item)} className="w-full">
            <div className="flex items-center gap-3 rounded-sm border border-black bg-white px-3 py-2 hover:bg-slate-50 active:translate-y-[1px]">
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
                    <div className="truncate text-sm font-semibold text-slate-900">{item.title}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-600">
                        <span className="rounded-md border border-black/10 bg-white px-1.5 py-0.5">
                            {item.kind === "manga" ? "Manga" : "Anime"}
                        </span>
                    </div>
                </div>

                {/* mini rings (right side) */}
                <div className="flex shrink-0 items-center gap-2">
                    {/* progress */}
                    {progress.status === "loading" ? (
                        <div className="h-16 w-16 rounded-full bg-slate-100 animate-pulse" />
                    ) : progress.status === "error" ? (
                        <div className="h-16 w-16 rounded-full border border-black/10 bg-white" />
                    ) : (
                        <MiniProgressRing
                            current={progress.current}
                            total={progress.total}
                            kind={item.kind}
                            slug={item.slug}
                            filledColor={RING_FILLED_PROGRESS}
                        />
                    )}

                    {/* engagement */}
                    {engagement.status === "loading" ? (
                        <>
                            <div className="h-16 w-16 rounded-full bg-slate-100 animate-pulse" />
                            <div className="h-16 w-16 rounded-full bg-slate-100 animate-pulse" />
                        </>
                    ) : engagement.status === "error" ? (
                        <>
                            <div className="h-16 w-16 rounded-full border border-black/10 bg-white" />
                            <div className="h-16 w-16 rounded-full border border-black/10 bg-white" />
                        </>
                    ) : (
                        <>
                            <MiniProgressRing
                                current={engagement.reviewed}
                                total={totalForEngagement}
                                kind={item.kind}
                                slug={item.slug}
                                filledColor={RING_FILLED_REVIEWED}
                            />
                            <MiniProgressRing
                                current={engagement.rated}
                                total={totalForEngagement}
                                kind={item.kind}
                                slug={item.slug}
                                filledColor={RING_FILLED_RATED}
                            />
                        </>
                    )}
                </div>
            </div>
        </button>
    );
}
