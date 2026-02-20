"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { FALLBACK_BACKDROP_SRC } from "@/lib/fallbacks";
import SmartBackdropImage from "@/components/SmartBackdropImage";

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

    /** Optional: if you already have the poster URL, pass it and we won't fetch it. */
    posterUrl?: string | null;

    overlaySrc?: string | null;
    backdropHeightClassName?: string; // default matches MediaHeaderLayout
};

export default function AnimeSeriesHeaderBackdrop({
    animeId,
    posterUrl: posterUrlProp = null,
    overlaySrc = "/overlays/my-overlay4.png",
    backdropHeightClassName = "h-[620px]",
}: Props) {
    const [backdropUrl, setBackdropUrl] = useState<string | null>(null);
    const [posterUrl, setPosterUrl] = useState<string | null>(posterUrlProp);
    const [resolved, setResolved] = useState(false);

    // keep posterUrl in sync if parent passes it
    useEffect(() => {
        setPosterUrl(posterUrlProp ?? null);
    }, [posterUrlProp]);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            setResolved(false);

            if (!animeId) {
                if (!cancelled) setResolved(true);
                return;
            }

            // 1) Fetch backdrops
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
            } else {
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

            // 2) Fetch poster only if we don't already have one from props
            if (!posterUrlProp) {
                const { data: a, error: aErr } = await supabase
                    .from("anime")
                    .select("image_url")
                    .eq("id", animeId)
                    .maybeSingle();

                if (cancelled) return;

                if (aErr) {
                    console.error("AnimeSeriesHeaderBackdrop: anime poster fetch error:", aErr);
                    setPosterUrl(null);
                } else {
                    setPosterUrl(a?.image_url ?? null);
                }
            }

            setResolved(true);
        }

        run();
        return () => {
            cancelled = true;
        };
    }, [animeId, posterUrlProp]);

    const showOverlay = useMemo(
        () => typeof overlaySrc === "string" && overlaySrc.length > 0,
        [overlaySrc]
    );

    return (
        <div className={`relative w-full overflow-hidden ${backdropHeightClassName} -mt-10`}>
            {/* ✅ PHONE TEST KNOBS (SERIES):
          1) height % controls how much of the image area is visible (brings bottom up)
          2) top px controls how far DOWN the image sits (only the image) */}
            <style jsx>{`
        .series-image-frame {
          position: absolute;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          z-index: 0;
          top: 0;
        }

        /* 👇 CHANGE THESE TWO VALUES TO TEST (PHONE ONLY) */
        @media (max-width: 767px) {
          .series-image-frame {
            height: 70%; /* (A) visible image area */
            top: 40px; /* (B) move image DOWN */
          }
        }
      `}</style>

            {/* ✅ IMAGE ONLY (wrapped). Overlay stays full height. */}
            {!resolved ? null : (
                <div className="series-image-frame">
                    <SmartBackdropImage
                        src={backdropUrl}
                        posterFallbackSrc={posterUrl}
                        finalFallbackSrc={FALLBACK_BACKDROP_SRC}
                        alt=""
                        width={1920}
                        height={1080}
                        priority
                        sizes="100vw"
                        className="h-full w-full object-cover object-bottom"

                        posterFallbackObjectPosition="50% 45%"   // 👈 MOVE ONLY POSTER
                        finalFallbackObjectPosition="50% 13%"
                    />
                </div>
            )}

            {/* ✅ OVERLAY stays full height and does NOT move */}
            {showOverlay ? (
                <img
                    src={overlaySrc as string}
                    alt=""
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                    style={{ zIndex: 1 }}
                />
            ) : null}
        </div>
    );
}