"use client";

import Link from "next/link";

type WatchlistItem = {
    kind: "anime" | "manga" | "anime_episode" | "manga_chapter";
    id: string;
    parentId: string;
    slug: string | null;
    posterUrl: string | null;
    title: string;
    addedAt: string | null;
    stars: number | null;
    liked: boolean;
    reviewed: boolean;
    chapterNumber: number | null;
    episodeNumber: number | null;
};

export default function ProfileWatchlistPhone({
    items,
    loading,
    countLabel,
}: {
    items: WatchlistItem[];
    loading: boolean;
    countLabel: number;
}) {
    return (
        <>
            <div className="-mt-4"></div>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <h2 className="text-xs font-semibold tracking-wide text-slate-900 uppercase">
                        Watchlist
                    </h2>
                    <span className="text-xs text-slate-500">{countLabel}</span>
                </div>

                {loading ? <span className="text-xs text-slate-500">Loading…</span> : null}
            </div>

            {loading ? (
                <div className="bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-600">
                    Loading watchlist…
                </div>
            ) : items.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-600">
                    Nothing on this watchlist yet.
                </div>
            ) : (
                // ✅ smaller min width so you get ~4 across on phones
                <div className="grid [grid-template-columns:repeat(auto-fill,minmax(78px,1fr))] gap-x-2 gap-y-3">
                    {items.map((it) => {
                        let href = "#";

                        // series routes
                        if (it.slug && it.kind === "anime") href = `/anime/${it.slug}`;
                        if (it.slug && it.kind === "manga") href = `/manga/${it.slug}`;

                        // chapter route
                        if (it.slug && it.kind === "manga_chapter" && it.chapterNumber != null) {
                            href = `/manga/${it.slug}/chapter/${it.chapterNumber}`;
                        }

                        // ✅ keep your current behavior for anime_episode (series fallback)
                        if (it.slug && it.kind === "anime_episode") {
                            href = `/anime/${it.slug}`;
                        }

                        return (
                            <Link
                                key={`${it.kind}:${it.id}`}
                                href={href}
                                title={it.title}
                                className="block"
                            >
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

                                {/* ✅ compact labels (still distinguish chapter/episode) */}
                                <div className="mt-1">
                                    <div className="text-[11px] font-semibold leading-snug text-black line-clamp-1">
                                        {it.title}
                                    </div>

                                    {it.kind === "manga_chapter" ? (
                                        <div className="text-[10px] leading-snug text-black">
                                            {it.chapterNumber != null ? `Ch. ${it.chapterNumber}` : "Ch."}
                                        </div>
                                    ) : it.kind === "anime_episode" ? (
                                        <div className="text-[10px] leading-snug text-black">
                                            {it.episodeNumber != null ? `Ep. ${it.episodeNumber}` : "Ep."}
                                        </div>
                                    ) : null}
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </>
    );
}
