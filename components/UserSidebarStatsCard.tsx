"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Props = {
    userId: string | null | undefined;
    title?: string;
    variant?: "grid" | "inline"; // ✅ new
};

type StatsRow = {
    anime_logged_count: number;
    manga_logged_count: number;
    reviews_count: number;
};

function formatCount(n: number | null | undefined) {
    const v = Number(n ?? 0);
    if (!Number.isFinite(v)) return "0";
    return v.toLocaleString();
}

export default function UserSidebarStatsCard({ userId, title = "Stats", variant = "grid" }: Props) {
    const [stats, setStats] = useState<StatsRow>({ anime_logged_count: 0, manga_logged_count: 0, reviews_count: 0 });
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            if (!userId) {
                setStats({ anime_logged_count: 0, manga_logged_count: 0, reviews_count: 0 });
                setErr(null);
                setLoading(false);
                return;
            }

            setLoading(true);
            setErr(null);

            try {
                const { data, error } = await supabase.rpc("get_user_sidebar_stats", { p_user_id: userId }).maybeSingle();
                if (error) throw error;

                const row = (data ?? null) as Partial<StatsRow> | null;

                const next: StatsRow = {
                    anime_logged_count: Number(row?.anime_logged_count ?? 0),
                    manga_logged_count: Number(row?.manga_logged_count ?? 0),
                    reviews_count: Number(row?.reviews_count ?? 0),
                };

                if (!cancelled) setStats(next);
            } catch (e: any) {
                if (!cancelled) {
                    setErr(e?.message ?? "Failed to load stats.");
                    setStats({ anime_logged_count: 0, manga_logged_count: 0, reviews_count: 0 });
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [userId]);

    // ✅ compact inline style (the one you want under username)
    if (variant === "inline") {
        return (
            <div style={{ fontSize: "0.82rem", color: "#666"}}>
                {loading ? (
                    <span style={{ color: "#777" }}>Loading…</span>
                ) : err ? (
                    <span style={{ color: "#b00000" }}>{err}</span>
                ) : (
                    <>
                        <span style={{ fontWeight: 800, color: "#111" }}>{formatCount(stats.anime_logged_count)}</span>
                        <span style={{ marginLeft: 4, color: "#666" }}>anime</span>

                        <span style={{ margin: "0 8px", color: "#999" }}>•</span>

                        <span style={{ fontWeight: 800, color: "#111" }}>{formatCount(stats.manga_logged_count)}</span>
                        <span style={{ marginLeft: 4, color: "#666" }}>manga</span>

                        <span style={{ margin: "0 8px", color: "#999" }}>•</span>

                        <span style={{ fontWeight: 800, color: "#111" }}>{formatCount(stats.reviews_count)}</span>
                        <span style={{ marginLeft: 4, color: "#666" }}>reviews</span>
                    </>
                )}
            </div>
        );
    }

    // default grid (kept for other uses)
    return (
        <div style={{ padding: "1rem 1.1rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <div style={{ fontSize: "0.95rem", fontWeight: 800 }}>{title}</div>
            </div>

            <div style={{ height: 10 }} />

            {loading ? <div style={{ fontSize: "0.9rem", color: "#777" }}>Loading…</div> : null}
            {!loading && err ? <div style={{ fontSize: "0.9rem", color: "#b00000" }}>{err}</div> : null}

            {!loading && !err ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.7rem" }}>
                    <div style={{ border: "1px solid #eee", background: "#fafafa", borderRadius: 10, padding: "0.75rem" }}>
                        <div style={{ fontSize: "0.78rem", color: "#777", fontWeight: 700 }}>Anime</div>
                        <div style={{ fontSize: "1.15rem", fontWeight: 900, marginTop: 4 }}>
                            {formatCount(stats.anime_logged_count)}
                        </div>
                    </div>

                    <div style={{ border: "1px solid #eee", background: "#fafafa", borderRadius: 10, padding: "0.75rem" }}>
                        <div style={{ fontSize: "0.78rem", color: "#777", fontWeight: 700 }}>Manga</div>
                        <div style={{ fontSize: "1.15rem", fontWeight: 900, marginTop: 4 }}>
                            {formatCount(stats.manga_logged_count)}
                        </div>
                    </div>

                    <div style={{ border: "1px solid #eee", background: "#fafafa", borderRadius: 10, padding: "0.75rem" }}>
                        <div style={{ fontSize: "0.78rem", color: "#777", fontWeight: 700 }}>Reviews</div>
                        <div style={{ fontSize: "1.15rem", fontWeight: 900, marginTop: 4 }}>
                            {formatCount(stats.reviews_count)}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
