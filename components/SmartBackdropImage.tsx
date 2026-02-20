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

    posterFallbackObjectPosition?: string;

    /** Applied only when rendering the FINAL fallback image. */
    finalFallbackObjectPosition?: string;

    /** Applied when rendering src/posterFallbackSrc (defaults to object-bottom like your backdrop). */
    objectPosition?: string;
};

type Stage = "primary" | "poster" | "final";

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
    finalFallbackObjectPosition = "50% 13%",
    objectPosition,
    posterFallbackObjectPosition, // ✅ ADD THIS
}: Props) {
    const primary = src && String(src).trim() ? String(src).trim() : null;
    const poster = posterFallbackSrc && String(posterFallbackSrc).trim() ? String(posterFallbackSrc).trim() : null;

    const [stage, setStage] = useState<Stage>(() => {
        if (primary) return "primary";
        if (poster) return "poster";
        return "final";
    });

    // Reset stage whenever inputs change
    useEffect(() => {
        if (primary) setStage("primary");
        else if (poster) setStage("poster");
        else setStage("final");
    }, [primary, poster]);

    const currentSrc = useMemo(() => {
        if (stage === "primary") return primary;
        if (stage === "poster") return poster;
        return finalFallbackSrc;
    }, [stage, primary, poster, finalFallbackSrc]);

    const isFinal = stage === "final";

    return (
        <Image
            src={currentSrc as string}
            alt={alt}
            width={width}
            height={height}
            priority={priority}
            sizes={sizes}
            className={className}
            style={
                stage === "poster"
                    ? posterFallbackObjectPosition
                        ? { objectPosition: posterFallbackObjectPosition }
                        : undefined
                    : stage === "final"
                        ? { objectPosition: finalFallbackObjectPosition }
                        : objectPosition
                            ? { objectPosition }
                            : undefined
            }
            onError={() => {
                // Move along the chain:
                if (stage === "primary") {
                    if (poster) setStage("poster");
                    else setStage("final");
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