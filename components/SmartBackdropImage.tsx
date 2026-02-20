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

  posterFallbackObjectPosition,
  finalFallbackObjectPosition = "50% 13%",
  primaryObjectPosition,

  deferFinalUntilPosterResolved = false,
  posterResolved = true,
}: Props) {
  const primary = src && String(src).trim() ? String(src).trim() : null;
  const poster =
    posterFallbackSrc && String(posterFallbackSrc).trim()
      ? String(posterFallbackSrc).trim()
      : null;

  const desiredStage: Stage = useMemo(() => {
    if (primary) return "primary";
    if (poster) return "poster";

    // ✅ key fix: don't show final yet if we *might* still get a poster
    if (deferFinalUntilPosterResolved && !posterResolved) return "none";

    return "final";
  }, [primary, poster, deferFinalUntilPosterResolved, posterResolved]);

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

  // If we're intentionally waiting, render nothing (overlay still renders in parent).
  if (stage === "none" || !currentSrc) return null;

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