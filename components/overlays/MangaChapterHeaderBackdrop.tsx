"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";

function normalizeBackdropUrl(url: string) {
  if (!url) return url;

  // TMDB original -> w1280 (faster)
  if (url.includes("https://image.tmdb.org/t/p/original/")) {
    return url.replace("/t/p/original/", "/t/p/w1280/");
  }

  return url;
}

type MangaCoverRow = {
  cached_url: string | null;
};

type Props = {
  mangaId: string;
  overlaySrc?: string | null;
  backdropHeightClassName?: string; // default matches MangaMediaHeaderLayout
};

export default function MangaChapterHeaderBackdrop({
  mangaId,
  overlaySrc = "/overlays/my-overlay4.png",
  backdropHeightClassName = "h-[620px]",
}: Props) {
  const [backdropUrl, setBackdropUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setBackdropUrl(null);
      if (!mangaId) return;

      // ✅ EXACT same pool as your chapter activity SSR:
      // public.manga_covers -> cached_url
      const { data, error } = await supabase
        .from("manga_covers")
        .select("cached_url")
        .eq("manga_id", mangaId)
        .not("cached_url", "is", null)
        .limit(200);

      if (cancelled) return;

      if (error || !data || data.length === 0) {
        if (error) console.error("MangaChapterHeaderBackdrop: manga_covers error:", error);
        setBackdropUrl(null);
        return;
      }

      const urls = (data as MangaCoverRow[])
        .map((r) => (typeof r.cached_url === "string" ? r.cached_url.trim() : ""))
        .filter(Boolean);

      if (urls.length === 0) {
        setBackdropUrl(null);
        return;
      }

      const pick = urls[Math.floor(Math.random() * urls.length)];
      setBackdropUrl(normalizeBackdropUrl(pick));
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [mangaId]);

  const showBackdropImage = useMemo(
    () => typeof backdropUrl === "string" && backdropUrl.length > 0,
    [backdropUrl]
  );

  const showOverlay = useMemo(
    () => typeof overlaySrc === "string" && overlaySrc.length > 0,
    [overlaySrc]
  );

  // ✅ Match MangaMediaHeaderLayout EXACTLY (crop + overlay offset)
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
          className="h-full w-full object-cover"
          style={{ objectPosition: "50% 20%" }}
        />
      ) : (
        <div className="h-full w-full bg-black" />
      )}

      {showOverlay ? (
        <img
          src={overlaySrc as string}
          alt=""
          className="pointer-events-none absolute -top-12 left-0 h-[calc(100%+3rem)] w-full object-cover"
        />
      ) : null}
    </div>
  );
}
