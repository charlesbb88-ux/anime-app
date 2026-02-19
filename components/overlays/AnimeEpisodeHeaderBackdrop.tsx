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
  episodeRefText: string;
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
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setResolved(false);

      if (!animeId || !episodeRefText) {
        if (!cancelled) setResolved(true);
        return;
      }

      let episodeId: string | null = null;

      if (looksLikeUuid(episodeRefText)) {
        episodeId = episodeRefText;
      } else {
        const epNum = parseEpisodeNumber(episodeRefText);
        if (epNum == null) {
          if (!cancelled) setResolved(true);
          return;
        }

        const { data: epRow, error: epErr } = await supabase
          .from("anime_episodes")
          .select("id")
          .eq("anime_id", animeId)
          .eq("episode_number", epNum)
          .maybeSingle();

        if (cancelled) return;

        episodeId = !epErr && epRow?.id ? String(epRow.id) : null;
      }

      if (!episodeId) {
        if (!cancelled) {
          setBackdropUrl(null);
          setResolved(true);
        }
        return;
      }

      const { data: epArts, error: epArtErr } = await supabase
        .from("anime_episode_artwork")
        .select("url, is_primary, vote, width, kind")
        .eq("anime_episode_id", episodeId)
        .in("kind", ["still", "1"])
        .limit(50);

      if (cancelled) return;

      if (epArtErr || !epArts || epArts.length === 0) {
        if (epArtErr)
          console.error(
            "AnimeEpisodeHeaderBackdrop: anime_episode_artwork error:",
            epArtErr
          );

        setBackdropUrl(null);
        setResolved(true);
        return;
      }

      setBackdropUrl(pickBest(epArts as ArtRow[]));
      setResolved(true);
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
      {/* ✅ PHONE TEST KNOBS:
          1) height % controls how much of the image area is visible (brings bottom up)
          2) top px controls how far DOWN the image sits (only the image) */}
      <style jsx>{`
        .episode-image-frame {
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
          .episode-image-frame {
            height: 70%; /* (A) visible image area */
            top: 40px; /* (B) move image DOWN */
          }
        }
      `}</style>

      {!resolved ? null : (
        <div className="episode-image-frame">
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
              style={{ objectPosition: "50% 13%" }}
            />
          )}
        </div>
      )}

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