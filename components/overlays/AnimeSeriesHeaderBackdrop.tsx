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

type AnimeArtworkRow = {
    url: string | null;
    is_primary: boolean | null;
    vote: number | null;
    width: number | null;
    kind: string | null;
};

type Props = {
    animeId: string;
    overlaySrc?: string | null;
    backdropHeightClassName?: string; // default matches MediaHeaderLayout
};

export default function AnimeSeriesHeaderBackdrop({
    animeId,
    overlaySrc = "/overlays/my-overlay4.png",
    backdropHeightClassName = "h-[620px]",
}: Props) {
    const [backdropUrl, setBackdropUrl] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            setBackdropUrl(null);
            if (!animeId) return;

            const { data, error } = await supabase
                .from("anime_artwork")
                .select("url, is_primary, vote, width, kind")
                .eq("anime_id", animeId)
                .in("kind", ["backdrop", "3"])
                .limit(50);

            if (cancelled) return;

            if (error || !data || data.length === 0) {
                if (error) console.error("AnimeSeriesHeaderBackdrop: anime_artwork error:", error);
                setBackdropUrl(null);
                return;
            }

            const arts = data as AnimeArtworkRow[];

            const sorted = [...arts].sort((a, b) => {
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

            setBackdropUrl(rawUrl ? normalizeBackdropUrl(rawUrl) : null);
        }

        run();
        return () => {
            cancelled = true;
        };
    }, [animeId]);

    const showBackdropImage = useMemo(
        () => typeof backdropUrl === "string" && backdropUrl.length > 0,
        [backdropUrl]
    );

    const showOverlay = useMemo(
        () => typeof overlaySrc === "string" && overlaySrc.length > 0,
        [overlaySrc]
    );

    // ✅ EXACT structure from MediaHeaderLayout
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
