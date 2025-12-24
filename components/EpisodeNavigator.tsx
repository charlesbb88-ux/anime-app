// components/EpisodeNavigator.tsx

"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

type Props = {
  slug: string;
  totalEpisodes?: number | null;
  currentEpisodeNumber?: number | null;
  className?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function EpisodeNavigator({
  slug,
  totalEpisodes,
  currentEpisodeNumber,
  className,
}: Props) {
  const router = useRouter();

  const total = typeof totalEpisodes === "number" ? totalEpisodes : null;
  const hasTotal =
    typeof total === "number" && Number.isFinite(total) && total > 0;

  const current =
    typeof currentEpisodeNumber === "number" ? currentEpisodeNumber : null;

  const currentSafe =
    typeof current === "number" && Number.isFinite(current) && current > 0
      ? current
      : null;

  const animeHref = `/anime/${encodeURIComponent(slug)}`;
  const episodeBase = `${animeHref}/episode`;

  // Robust "am I on the anime main page?" detection
  const rawPath = typeof router.asPath === "string" ? router.asPath : "";
  const cleanPath = rawPath.split("?")[0].replace(/\/+$/, "");
  const cleanAnimeHref = animeHref.replace(/\/+$/, "");
  const isOnAnimeMainPage = cleanPath === cleanAnimeHref;

  const canPrev = currentSafe !== null && currentSafe > 1;

  const canNext =
    hasTotal && currentSafe !== null
      ? currentSafe < (total as number)
      : currentSafe !== null;

  const prevEp = currentSafe !== null ? currentSafe - 1 : null;
  const nextEp = currentSafe !== null ? currentSafe + 1 : null;

  const episodes = useMemo(() => {
    if (!hasTotal) return [];
    const t = total as number;

    const HARD_CAP = 500;
    const capped = Math.min(t, HARD_CAP);

    if (capped <= 60) {
      return Array.from({ length: capped }, (_, i) => i + 1);
    }

    const windowSize = 41;
    const half = Math.floor(windowSize / 2);

    const center = currentSafe ?? 1;
    let start = center - half;
    let end = center + half;

    start = clamp(start, 1, capped);
    end = clamp(end, 1, capped);

    const actual = end - start + 1;
    if (actual < windowSize) {
      const missing = windowSize - actual;
      const shiftLeft = Math.min(missing, start - 1);
      start -= shiftLeft;
      const shiftRight = missing - shiftLeft;
      end = clamp(end + shiftRight, 1, capped);
    }

    const nums: number[] = [];
    for (let n = start; n <= end; n++) nums.push(n);

    const withEdges: (number | "…")[] = [];
    const first = 1;
    const last = capped;

    if (nums[0] !== first) {
      withEdges.push(first);
      if (nums[0] > first + 1) withEdges.push("…");
    }

    for (const n of nums) withEdges.push(n);

    if (nums[nums.length - 1] !== last) {
      if (nums[nums.length - 1] < last - 1) withEdges.push("…");
      withEdges.push(last);
    }

    return withEdges;
  }, [hasTotal, total, currentSafe]);

  const goToEpisode = (n: number) => {
    router.push(`${episodeBase}/${n}`);
  };

  return (
    <div
      className={[
        "w-full min-w-0 overflow-hidden rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-3",
        className ?? "",
      ].join(" ")}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-200">Episodes</div>
            <div className="text-xs text-gray-500">
              {hasTotal ? (
                <>
                  Total: <span className="text-gray-300">{total}</span>
                  {currentSafe !== null && (
                    <>
                      {" "}
                      • Current:{" "}
                      <span className="text-gray-300">{currentSafe}</span>
                    </>
                  )}
                </>
              ) : (
                <>
                  Total: <span className="text-gray-300">Unknown</span>
                  {currentSafe !== null && (
                    <>
                      {" "}
                      • Current:{" "}
                      <span className="text-gray-300">{currentSafe}</span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Main anime page button */}
            <Link
              href={animeHref}
              aria-disabled={isOnAnimeMainPage}
              className={[
                "rounded-md border px-2 py-1 text-xs font-medium",
                isOnAnimeMainPage
                  ? "border-blue-500/60 bg-blue-500/15 text-blue-200 cursor-default"
                  : "border-gray-800 bg-black/20 text-gray-200 hover:bg-black/35",
              ].join(" ")}
              onClick={(e) => {
                if (isOnAnimeMainPage) e.preventDefault();
              }}
            >
              Main page
            </Link>

            <Link
              href={`${episodeBase}/1`}
              className="rounded-md border border-gray-800 bg-black/20 px-2 py-1 text-xs font-medium text-gray-200 hover:bg-black/35"
            >
              First
            </Link>

            <Link
              href={
                canPrev && prevEp !== null
                  ? `${episodeBase}/${prevEp}`
                  : `${episodeBase}/1`
              }
              aria-disabled={!canPrev}
              className={[
                "rounded-md border border-gray-800 bg-black/20 px-2 py-1 text-xs font-medium",
                canPrev
                  ? "text-gray-200 hover:bg-black/35"
                  : "text-gray-600 cursor-not-allowed",
              ].join(" ")}
              onClick={(e) => {
                if (!canPrev) e.preventDefault();
              }}
            >
              Prev
            </Link>

            <Link
              href={
                canNext && nextEp !== null
                  ? `${episodeBase}/${nextEp}`
                  : `${episodeBase}/1`
              }
              aria-disabled={!canNext}
              className={[
                "rounded-md border border-gray-800 bg-black/20 px-2 py-1 text-xs font-medium",
                canNext
                  ? "text-gray-200 hover:bg-black/35"
                  : "text-gray-600 cursor-not-allowed",
              ].join(" ")}
              onClick={(e) => {
                if (!canNext) e.preventDefault();
              }}
            >
              Next
            </Link>

            {hasTotal ? (
              <Link
                href={`${episodeBase}/${total as number}`}
                className="rounded-md border border-gray-800 bg-black/20 px-2 py-1 text-xs font-medium text-gray-200 hover:bg-black/35"
              >
                Last
              </Link>
            ) : (
              <span className="rounded-md border border-gray-800 bg-black/10 px-2 py-1 text-xs font-medium text-gray-600">
                Last
              </span>
            )}
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="flex items-center gap-2 pr-2">
              {hasTotal ? (
                episodes.map((item, idx) => {
                  if (item === "…") {
                    return (
                      <span
                        key={`dots-${idx}`}
                        className="select-none px-1 text-xs text-gray-600"
                      >
                        …
                      </span>
                    );
                  }

                  const n = item as number;
                  const isActive = currentSafe !== null && n === currentSafe;

                  return (
                    <Link
                      key={n}
                      href={`${episodeBase}/${n}`}
                      className={[
                        "rounded-full border px-3 py-1 text-xs font-semibold",
                        isActive
                          ? "border-blue-500/60 bg-blue-500/15 text-blue-200"
                          : "border-gray-800 bg-black/20 text-gray-200 hover:bg-black/35",
                      ].join(" ")}
                    >
                      {n}
                    </Link>
                  );
                })
              ) : (
                <div className="text-xs text-gray-500">
                  Episode list will appear after total episodes are known.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
