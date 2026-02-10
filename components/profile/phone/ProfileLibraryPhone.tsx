"use client";

import Link from "next/link";
import ReviewIcon from "@/components/icons/ReviewIcon";

type LibraryItem = {
    kind: "anime" | "manga";
    id: string;
    slug: string | null;
    posterUrl: string | null;
    title: string;

    stars: number | null;
    liked: boolean;

    reviewed: boolean;
    reviewPostId: string | null;

    markedAt: string | null;
};

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

function renderStars(stars: number) {
    const s = clamp(stars, 0, 5);
    const full = Math.floor(s);
    const half = s % 1 !== 0;

    let out = "";
    for (let i = 0; i < full; i++) out += "★";
    if (half) out += "½";
    return out;
}

export default function ProfileLibraryPhone({
    items,
    loading,
}: {
    items: LibraryItem[];
    loading: boolean;
}) {
    function itemHref(it: LibraryItem) {
        if (!it.slug) return "#";
        return it.kind === "anime" ? `/anime/${it.slug}` : `/manga/${it.slug}`;
    }

    return (
        <>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <h2 className="text-xs font-semibold tracking-wide text-slate-900 uppercase">
                        Watched / Read
                    </h2>
                    <span className="text-xs text-slate-500">{items.length}</span>
                </div>

                {loading ? <span className="text-xs text-slate-500">Loading…</span> : null}
            </div>

            {loading ? (
                <div className="bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-600">
                    Loading library…
                </div>
            ) : items.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-600">
                    Nothing in this library yet.
                </div>
            ) : (
                // ✅ phone grid: smaller min width so ~4 per row
                <div className="grid [grid-template-columns:repeat(auto-fill,minmax(78px,1fr))] gap-x-2 gap-y-3">
                    {items.map((it) => {
                        const href = itemHref(it);

                        return (
                            <div key={`${it.kind}:${it.id}`} className="block">
                                <Link href={href} title={it.title} className="block">
                                    <div className="relative w-full aspect-[2/3] overflow-hidden rounded-[4px] bg-slate-200 border border-black">
                                        {it.posterUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={it.posterUrl}
                                                alt={it.title}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <span className="text-[10px] text-slate-500">No poster</span>
                                            </div>
                                        )}
                                    </div>
                                </Link>

                                <div className="mt-1 flex items-center justify-between">
                                    <div className="min-h-[12px] leading-none">
                                        {(() => {
                                            const hasStars = typeof it.stars === "number" && it.stars > 0;

                                            return (
                                                <div className="flex items-start">
                                                    {hasStars ? (
                                                        <span className="text-[12px] text-slate-1000 tracking-tight leading-none">
                                                            {renderStars(it.stars as number)}
                                                        </span>
                                                    ) : null}

                                                    {it.liked ? (
                                                        <span
                                                            className={[
                                                                "text-[13px] text-slate-1000 leading-none",
                                                                hasStars ? "ml-1 relative top-[.5px]" : "",
                                                            ].join(" ")}
                                                            aria-label="Liked"
                                                            title="Liked"
                                                        >
                                                            ♥
                                                        </span>
                                                    ) : null}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    <div className="flex items-center gap-1">
                                        {it.reviewed ? (
                                            it.reviewPostId ? (
                                                <Link
                                                    href={`/posts/${it.reviewPostId}`}
                                                    className="text-slate-600 hover:text-slate-900"
                                                >
                                                    <ReviewIcon size={11} />
                                                </Link>
                                            ) : (
                                                <span className="text-slate-600" aria-label="Reviewed" title="Reviewed">
                                                    <ReviewIcon size={11} />
                                                </span>
                                            )
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
}
