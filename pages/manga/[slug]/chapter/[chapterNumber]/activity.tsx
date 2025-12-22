// pages/manga/[slug]/chapter/[chapterNumber]/activity.tsx
"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import Link from "next/link";

import { supabase } from "@/lib/supabaseClient";

type ActivityItem =
    | {
        id: string;
        kind: "log";
        type: "manga_chapter";
        title: string;
        subLabel?: string;
        rating: number | null;
        note: string | null;
        logged_at: string;
        visibility: "public" | "friends" | "private";
    }
    | {
        id: string;
        kind: "review";
        type: "manga_chapter_review";
        title: string;
        subLabel?: string;
        logged_at: string; // created_at from reviews
        rating: number | null; // 0..100
        content: string | null;
        contains_spoilers: boolean;
    }
    | {
        id: string;
        kind: "mark";
        type: "watched" | "liked" | "watchlist" | "rating";
        title: string;
        subLabel?: string;
        logged_at: string;
        // ⭐ rating uses HALF-STARS stored as 1..10
        stars?: number | null;
    };

function getMangaDisplayTitle(manga: any): string {
    return (
        manga?.title_english ||
        manga?.title_preferred ||
        manga?.title_native ||
        manga?.title ||
        "Unknown manga"
    );
}

/* -------------------- Dates -------------------- */

function formatRelativeShort(iso: string) {
    const d = new Date(iso);
    const now = new Date();

    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return "now";
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHr < 24) return `${diffHr}h`;
    if (diffDay < 30) return `${diffDay}d`;

    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function formatOnFullDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
    });
}

/* -------------------- Half-star visuals -------------------- */

function clampInt(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, Math.round(n)));
}

function computeStarFillPercent(halfStars: number, starIndex: number) {
    const starHalfStart = (starIndex - 1) * 2; // 0,2,4,6,8
    const remaining = halfStars - starHalfStart;

    if (remaining >= 2) return 100 as const;
    if (remaining === 1) return 50 as const;
    return 0 as const;
}

function StarVisual({ filledPercent }: { filledPercent: 0 | 50 | 100 }) {
    return (
        <span className="relative inline-block">
            <span className="text-[18px] leading-none text-gray-600">★</span>

            {filledPercent > 0 && (
                <span
                    className="pointer-events-none absolute left-0 top-0 overflow-hidden text-[18px] leading-none text-emerald-400"
                    style={{ width: `${filledPercent}%` }}
                >
                    ★
                </span>
            )}
        </span>
    );
}

function HalfStarsRow({ halfStars }: { halfStars: number }) {
    const hs = clampInt(halfStars, 0, 10);

    return (
        <span className="ml-2 inline-flex items-center gap-[2px] align-middle">
            {Array.from({ length: 5 }).map((_, i) => {
                const starIndex = i + 1;
                const fill = computeStarFillPercent(hs, starIndex);
                return <StarVisual key={starIndex} filledPercent={fill} />;
            })}
        </span>
    );
}

const MangaChapterActivityPage: NextPage = () => {
    const router = useRouter();
    const { slug, chapterNumber } = router.query as { slug?: string; chapterNumber?: string };

    const [loading, setLoading] = useState(true);
    const [pageTitle, setPageTitle] = useState<string>("Your activity");
    const [items, setItems] = useState<ActivityItem[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        async function run() {
            setLoading(true);
            setError(null);

            const {
                data: { user },
                error: userErr,
            } = await supabase.auth.getUser();

            if (!user || userErr) {
                router.replace("/login");
                return;
            }

            if (!slug || !chapterNumber) {
                if (mounted) setLoading(false);
                return;
            }

            const chapterNum = Number(chapterNumber);
            if (!Number.isInteger(chapterNum) || chapterNum <= 0) {
                setError("Invalid chapter number.");
                setLoading(false);
                return;
            }

            // ✅ fetch manga by slug
            const mangaRes = await supabase
                .from("manga")
                .select("id, slug, title, title_english, title_native, title_preferred")
                .eq("slug", slug)
                .maybeSingle();

            if (!mounted) return;

            const manga = mangaRes.data ?? null;

            if (mangaRes.error || !manga?.id) {
                setError("Manga not found.");
                setLoading(false);
                return;
            }

            // ✅ fetch chapter by manga_id + chapter_number
            // (Assumes your table is `manga_chapters` and it has `manga_id` + `chapter_number`)
            const chapterRes = await supabase
                .from("manga_chapters")
                .select("id, chapter_number, title")
                .eq("manga_id", manga.id)
                .eq("chapter_number", chapterNum)
                .maybeSingle();

            if (!mounted) return;

            const chapter = chapterRes.data ?? null;

            if (chapterRes.error || !chapter?.id) {
                setError("Chapter not found.");
                setLoading(false);
                return;
            }

            const mangaTitle = getMangaDisplayTitle(manga);
            const subLabel = chapter.chapter_number != null ? `Chapter ${chapter.chapter_number}` : "Chapter";

            setPageTitle(`Your activity · ${mangaTitle} · ${subLabel}`);

            const [
                chapterLogs,
                chapterReviews,
                watchedMark,
                likedMark,
                watchlistMark,
                ratingMark,
            ] = await Promise.all([
                // ✅ chapter logs (scoped to this chapter)
                supabase
                    .from("manga_chapter_logs")
                    .select("id, logged_at, rating, note, visibility")
                    .eq("user_id", user.id)
                    .eq("manga_id", manga.id)
                    .eq("manga_chapter_id", chapter.id)
                    .order("logged_at", { ascending: false }),

                // ✅ Reviews table: chapter review = manga_id set AND manga_chapter_id = chapter.id
                supabase
                    .from("reviews")
                    .select("id, created_at, rating, content, contains_spoilers")
                    .eq("user_id", user.id)
                    .eq("manga_id", manga.id)
                    .eq("manga_chapter_id", chapter.id)
                    .order("created_at", { ascending: false }),

                // ✅ marks scoped to this chapter
                supabase
                    .from("user_marks")
                    .select("id, created_at")
                    .eq("user_id", user.id)
                    .eq("kind", "watched")
                    .eq("manga_id", manga.id)
                    .eq("manga_chapter_id", chapter.id)
                    .is("anime_id", null)
                    .is("anime_episode_id", null)
                    .maybeSingle(),

                supabase
                    .from("user_marks")
                    .select("id, created_at")
                    .eq("user_id", user.id)
                    .eq("kind", "liked")
                    .eq("manga_id", manga.id)
                    .eq("manga_chapter_id", chapter.id)
                    .is("anime_id", null)
                    .is("anime_episode_id", null)
                    .maybeSingle(),

                supabase
                    .from("user_marks")
                    .select("id, created_at")
                    .eq("user_id", user.id)
                    .eq("kind", "watchlist")
                    .eq("manga_id", manga.id)
                    .eq("manga_chapter_id", chapter.id)
                    .is("anime_id", null)
                    .is("anime_episode_id", null)
                    .maybeSingle(),

                supabase
                    .from("user_marks")
                    .select("id, created_at, stars")
                    .eq("user_id", user.id)
                    .eq("kind", "rating")
                    .eq("manga_id", manga.id)
                    .eq("manga_chapter_id", chapter.id)
                    .is("anime_id", null)
                    .is("anime_episode_id", null)
                    .maybeSingle(),
            ]);

            if (!mounted) return;

            if (chapterLogs.error) console.error("Manga chapter activity: chapterLogs error", chapterLogs.error);
            if (chapterReviews.error) console.error("Manga chapter activity: chapterReviews error", chapterReviews.error);

            const merged: ActivityItem[] = [];

            // ✅ MARKS (chapter-scoped only)
            if (watchedMark.data?.id) {
                merged.push({
                    id: watchedMark.data.id,
                    kind: "mark",
                    type: "watched",
                    title: mangaTitle,
                    subLabel,
                    logged_at: watchedMark.data.created_at,
                });
            }

            if (likedMark.data?.id) {
                merged.push({
                    id: likedMark.data.id,
                    kind: "mark",
                    type: "liked",
                    title: mangaTitle,
                    subLabel,
                    logged_at: likedMark.data.created_at,
                });
            }

            if (watchlistMark.data?.id) {
                merged.push({
                    id: watchlistMark.data.id,
                    kind: "mark",
                    type: "watchlist",
                    title: mangaTitle,
                    subLabel,
                    logged_at: watchlistMark.data.created_at,
                });
            }

            if (ratingMark.data?.id) {
                merged.push({
                    id: ratingMark.data.id,
                    kind: "mark",
                    type: "rating",
                    title: mangaTitle,
                    subLabel,
                    logged_at: ratingMark.data.created_at,
                    stars: ratingMark.data.stars ?? null,
                });
            }

            // ✅ Reviews (chapter)
            chapterReviews.data?.forEach((row: any) => {
                merged.push({
                    id: row.id,
                    kind: "review",
                    type: "manga_chapter_review",
                    title: mangaTitle,
                    subLabel,
                    logged_at: row.created_at,
                    rating: typeof row.rating === "number" ? row.rating : null,
                    content: row.content ?? null,
                    contains_spoilers: Boolean(row.contains_spoilers),
                });
            });

            // ✅ Chapter logs
            chapterLogs.data?.forEach((row: any) => {
                merged.push({
                    id: row.id,
                    kind: "log",
                    type: "manga_chapter",
                    title: mangaTitle,
                    subLabel,
                    rating: row.rating,
                    note: row.note,
                    logged_at: row.logged_at,
                    visibility: row.visibility,
                });
            });

            merged.sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());

            setItems(merged);
            setLoading(false);
        }

        run();

        return () => {
            mounted = false;
        };
    }, [router, slug, chapterNumber]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
                Loading…
            </div>
        );
    }

    return (
        <main className="mx-auto max-w-3xl px-4 py-8">
            <div className="mb-4">
                <Link
                    href={slug && chapterNumber ? `/manga/${slug}/chapter/${chapterNumber}` : "/manga"}
                    className="text-xs text-blue-500 hover:text-blue-400"
                >
                    ← Back to chapter
                </Link>
            </div>

            <h1 className="mb-6 text-2xl font-semibold tracking-tight">{pageTitle}</h1>

            {error ? (
                <div className="text-sm text-red-300">{error}</div>
            ) : items.length === 0 ? (
                <div className="text-sm text-neutral-500">No activity yet.</div>
            ) : (
                <ul className="space-y-4">
                    {items.map((item) => {
                        if (item.kind === "mark" && item.type === "watched") {
                            return (
                                <li key={`watched-${item.id}`} className="rounded-md border border-neutral-800 p-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="text-sm font-medium">
                                            You marked{" "}
                                            <span className="font-bold text-black">{item.title}</span>
                                            {item.subLabel ? <span className="ml-2 text-neutral-400">· {item.subLabel}</span> : null}{" "}
                                            as read
                                        </div>

                                        <div className="text-xs text-neutral-500 whitespace-nowrap">
                                            {formatRelativeShort(item.logged_at)}
                                        </div>
                                    </div>
                                </li>
                            );
                        }

                        if (item.kind === "mark" && item.type === "liked") {
                            return (
                                <li key={`liked-${item.id}`} className="rounded-md border border-neutral-800 p-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="text-sm font-medium">
                                            You liked{" "}
                                            <span className="font-bold text-black">{item.title}</span>
                                            {item.subLabel ? <span className="ml-2 text-neutral-400">· {item.subLabel}</span> : null}
                                        </div>

                                        <div className="text-xs text-neutral-500 whitespace-nowrap">
                                            {formatRelativeShort(item.logged_at)}
                                        </div>
                                    </div>
                                </li>
                            );
                        }

                        if (item.kind === "mark" && item.type === "watchlist") {
                            return (
                                <li key={`watchlist-${item.id}`} className="rounded-md border border-neutral-800 p-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="text-sm font-medium">
                                            You added{" "}
                                            <span className="font-bold text-black">{item.title}</span>
                                            {item.subLabel ? <span className="ml-2 text-neutral-400">· {item.subLabel}</span> : null}{" "}
                                            to your watchlist
                                        </div>

                                        <div className="text-xs text-neutral-500 whitespace-nowrap">
                                            {formatRelativeShort(item.logged_at)}
                                        </div>
                                    </div>
                                </li>
                            );
                        }

                        if (item.kind === "mark" && item.type === "rating") {
                            const hs = clampInt(Number(item.stars ?? 0), 0, 10);

                            return (
                                <li key={`rating-${item.id}`} className="rounded-md border border-neutral-800 p-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="text-sm font-medium">
                                            You rated{" "}
                                            <span className="font-bold text-black">{item.title}</span>
                                            {item.subLabel ? <span className="ml-2 text-neutral-400">· {item.subLabel}</span> : null}
                                            {hs > 0 ? <HalfStarsRow halfStars={hs} /> : null}
                                        </div>

                                        <div className="text-xs text-neutral-500 whitespace-nowrap">
                                            {formatRelativeShort(item.logged_at)}
                                        </div>
                                    </div>
                                </li>
                            );
                        }

                        if (item.kind === "review") {
                            return (
                                <li key={`review-${item.id}`} className="rounded-md border border-neutral-800 p-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="text-sm font-medium">
                                            You reviewed{" "}
                                            <span className="font-bold text-black">{item.title}</span>
                                            {item.subLabel ? <span className="ml-2 text-neutral-400">· {item.subLabel}</span> : null}
                                        </div>

                                        <div className="text-xs text-neutral-500 whitespace-nowrap">
                                            {formatRelativeShort(item.logged_at)}
                                        </div>
                                    </div>

                                    {item.rating !== null && <div className="mt-2 text-sm">Rating: {item.rating}</div>}

                                    {item.content ? (
                                        <div className="mt-1 text-sm text-neutral-400 line-clamp-2">
                                            {item.content}
                                        </div>
                                    ) : null}
                                </li>
                            );
                        }

                        // ✅ logs (only)
                        if (item.kind === "log") {
                            return (
                                <li
                                    key={`log-${item.type}-${item.id}`}
                                    className="rounded-md border border-neutral-800 p-4"
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="text-sm font-medium">
                                            You read{" "}
                                            <span className="font-bold text-black">{item.title}</span>
                                            {item.subLabel ? (
                                                <span className="ml-2 text-neutral-400">· {item.subLabel}</span>
                                            ) : null}{" "}
                                            on {formatOnFullDate(item.logged_at)}
                                        </div>

                                        <div className="text-xs text-neutral-500 whitespace-nowrap">
                                            {formatRelativeShort(item.logged_at)}
                                        </div>
                                    </div>

                                    {item.rating !== null && <div className="mt-2 text-sm">Rating: {item.rating}</div>}

                                    {item.note ? (
                                        <div className="mt-1 text-sm text-neutral-400 line-clamp-2">{item.note}</div>
                                    ) : null}
                                </li>
                            );
                        }

                        return null;
                    })}
                </ul>
            )}
        </main>
    );
};

export default MangaChapterActivityPage;
