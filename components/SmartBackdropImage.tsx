"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type Props = {
  /** The main image you want (ex: backdrop). */
  src?: string | null;

  /** Fallback image (ex: poster). */
  posterFallbackSrc?: string | null;

  /** Final fallback (ex: your local/static fallback). */
  finalFallbackSrc: string;

  alt?: string;

  width?: number;
  height?: number;
  priority?: boolean;
  sizes?: string;

  className?: string;

  /** Used only for the loading/none placeholder block. */
  placeholderClassName?: string;

  /** Applied only when rendering the POSTER fallback image. */
  posterFallbackObjectPosition?: string;

  /** Applied only when rendering the FINAL fallback image. */
  finalFallbackObjectPosition?: string;

  /** Applied only when rendering the PRIMARY image. */
  primaryObjectPosition?: string;

  /**
   * Prevent the final fallback from flashing while we haven't finished loading
   * the poster fallback (common when poster is fetched client-side).
   */
  deferFinalUntilPosterResolved?: boolean;

  /** Set true once the poster source is "final" (loaded or known to be missing). */
  posterResolved?: boolean;
};

type Stage = "primary" | "poster" | "final" | "none";

export default function SmartBackdropImage({
  src,
  posterFallbackSrc,
  finalFallbackSrc,
  alt = "",
  width = 1920,
  height = 1080,
  priority = true,
  sizes = "100vw",
  className = "h-full w-full object-cover object-bottom",
  placeholderClassName = "h-full w-full",

  posterFallbackObjectPosition,
  finalFallbackObjectPosition = "50% 13%",
  primaryObjectPosition,

  deferFinalUntilPosterResolved = false,
  posterResolved = true,
}: Props) {
  const primaryUnknown = typeof src === "undefined"; // undefined = not loaded yet
  const primary = !primaryUnknown && src && String(src).trim() ? String(src).trim() : null;
  const poster =
    posterFallbackSrc && String(posterFallbackSrc).trim()
      ? String(posterFallbackSrc).trim()
      : null;

  const desiredStage: Stage = useMemo(() => {
    // NEW: if the primary is still unknown (episode meta not loaded yet),
    // do NOT show poster/final yet (prevents hero/poster flash).
    if (primaryUnknown) return "none";

    if (primary) return "primary";
    if (poster) return "poster";

    // ✅ keep your existing behavior
    if (deferFinalUntilPosterResolved && !posterResolved) return "none";

    return "final";
  }, [primaryUnknown, primary, poster, deferFinalUntilPosterResolved, posterResolved]);

  const [stage, setStage] = useState<Stage>(desiredStage);

  // Reset stage whenever inputs change
  useEffect(() => {
    setStage(desiredStage);
  }, [desiredStage]);

  const currentSrc = useMemo(() => {
    if (stage === "primary") return primary;
    if (stage === "poster") return poster;
    if (stage === "final") return finalFallbackSrc;
    return null;
  }, [stage, primary, poster, finalFallbackSrc]);

  // If we're intentionally waiting, render a stable shimmer placeholder
  // (prevents hero/poster flashing while episode meta is still loading).
  if (stage === "none") {
    return (
      <div
        aria-hidden="true"
        className={[
          placeholderClassName,
          "relative overflow-hidden",
          "bg-black/5",
        ].join(" ")}
      >
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.25s_infinite] bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        <style jsx>{`
          @keyframes shimmer {
            0% {
              transform: translateX(-100%);
            }
            100% {
              transform: translateX(100%);
            }
          }
        `}</style>
      </div>
    );
  }

  if (!currentSrc) return null;

  const style =
    stage === "primary"
      ? primaryObjectPosition
        ? { objectPosition: primaryObjectPosition }
        : undefined
      : stage === "poster"
        ? posterFallbackObjectPosition
          ? { objectPosition: posterFallbackObjectPosition }
          : undefined
        : { objectPosition: finalFallbackObjectPosition };

  return (
    <Image
      src={currentSrc}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      sizes={sizes}
      className={className}
      style={style}
      onError={() => {
        // Move along the chain:
        if (stage === "primary") {
          if (poster) setStage("poster");
          else {
            if (deferFinalUntilPosterResolved && !posterResolved) setStage("none");
            else setStage("final");
          }
          return;
        }

        if (stage === "poster") {
          setStage("final");
          return;
        }

        // final failed — nothing else to do
      }}
    />
  );
}