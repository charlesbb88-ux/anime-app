"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { FALLBACK_BACKDROP_SRC } from "@/lib/fallbacks";

function normalizeBackdropUrl(url: string) {
    if (!url) return url;
    if (url.includes("https://image.tmdb.org/t/p/original/")) {
        return url.replace("/t/p/original/", "/t/p/w1280/");
    }
    return url;
}

type ArtRow = {
    url: string | null;
    is_primary: boolean | null;
    vote: number | null;
    width: number | null;
    kind?: string | null;
};

function pickBest(rows: ArtRow[]): string | null {
    if (!rows || rows.length === 0) return null;

    const sorted = [...rows].sort((a, b) => {
        const ap = a.is_primary ? 1 : 0;
        const bp = b.is_primary ? 1 : 0;
        if (bp !== ap) return bp - ap;

        const av = typeof a.vote === "number" ? a.vote : -1;
        const bv = typeof b.vote === "number" ? b.vote : -1;
        if (bv !== av) return bv - av;

        const aw = typeof a.width === "number" ? a.width : -1;
        const bw = typeof b.width === "number" ? b.width : -1;
        return bw - aw;
    });

    const topN = sorted.slice(0, Math.min(12, sorted.length));
    const pick = topN[Math.floor(Math.random() * topN.length)];
    const rawUrl = pick?.url ?? null;

    return rawUrl ? normalizeBackdropUrl(rawUrl) : null;
}

function looksLikeUuid(s: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        s
    );
}

function parseEpisodeNumber(s: string) {
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    const i = Math.trunc(n);
    if (i <= 0) return null;
    return i;
}

type Props = {
    animeId: string;

    // pass the TEXT from posts/reviews directly
    episodeRefText: string; // could be "12" or "uuid-string"

    overlaySrc?: string | null;
    backdropHeightClassName?: string;
};

export default function AnimeEpisodeHeaderBackdrop({
    animeId,
    episodeRefText,
    overlaySrc = "/overlays/my-overlay4.png",
    backdropHeightClassName = "h-[620px]",
}: Props) {
    const [backdropUrl, setBackdropUrl] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            setBackdropUrl(null);

            if (!animeId || !episodeRefText) return;

            let episodeId: string | null = null;

            // 1) If it looks like a uuid, treat it as the episode id directly
            if (looksLikeUuid(episodeRefText)) {
                episodeId = episodeRefText;
            } else {
                // 2) Otherwise treat it as an episode number, and resolve anime_episodes.id
                const epNum = parseEpisodeNumber(episodeRefText);
                if (epNum == null) return;

                const { data: epRow, error: epErr } = await supabase
                    .from("anime_episodes")
                    .select("id")
                    .eq("anime_id", animeId)
                    .eq("episode_number", epNum)
                    .maybeSingle();

                if (cancelled) return;

                episodeId = !epErr && epRow?.id ? String(epRow.id) : null;
            }

            if (!episodeId) return;

            // ✅ EPISODE POOL ONLY (no series fallback)
            const { data: epArts, error: epArtErr } = await supabase
                .from("anime_episode_artwork")
                .select("url, is_primary, vote, width, kind")
                .eq("anime_episode_id", episodeId)
                .in("kind", ["still", "1"])
                .limit(50);

            if (cancelled) return;

            if (epArtErr || !epArts || epArts.length === 0) {
                if (epArtErr) console.error("AnimeEpisodeHeaderBackdrop: anime_episode_artwork error:", epArtErr);
                setBackdropUrl(null);
                return;
            }

            setBackdropUrl(pickBest(epArts as ArtRow[]));
        }

        run();
        return () => {
            cancelled = true;
        };
    }, [animeId, episodeRefText]);

    const showBackdropImage = useMemo(
        () => typeof backdropUrl === "string" && backdropUrl.length > 0,
        [backdropUrl]
    );

    const showOverlay = useMemo(
        () => typeof overlaySrc === "string" && overlaySrc.length > 0,
        [overlaySrc]
    );

    return (
        <div className={`relative w-full overflow-hidden ${backdropHeightClassName} -mt-10`}>
            {showBackdropImage ? (
                <Image
                    src={backdropUrl as string}
                    alt=""
                    width={1920}
                    height={1080}
                    priority
                    sizes="100vw"
                    className="h-full w-full object-cover object-bottom"
                />
            ) : (
                <Image
                    src={FALLBACK_BACKDROP_SRC}
                    alt=""
                    width={1920}
                    height={1080}
                    priority
                    sizes="100vw"
                    className="h-full w-full object-cover"
                    style={{ objectPosition: "50% 13%" }} // 👈 fallback-only vertical adjust
                />
            )}

            {showOverlay ? (
                <img
                    src={overlaySrc as string}
                    alt=""
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                />
            ) : null}
        </div>
    );
}
