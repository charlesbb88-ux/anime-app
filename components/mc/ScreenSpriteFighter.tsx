"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type DotAction =
  | "idle"
  | "run"
  | "jump"
  | "attack"
  | "hit"
  | "recover"
  | "defeat_fall"
  | "defeat_ground";

type SpriteAnim = {
  src: string;
  frames: number;
  fps: number;
  loop: boolean;
};

type SpriteSet = {
  idle: SpriteAnim;
  run: SpriteAnim;
  jump: SpriteAnim;
  attack: SpriteAnim;
  hit: SpriteAnim;
  recover: SpriteAnim;
  defeat_fall: SpriteAnim;
  defeat_ground: SpriteAnim;
};

function mapAction(action: DotAction): keyof SpriteSet {
  switch (action) {
    case "run":
      return "run";
    case "jump":
      return "jump";
    case "attack":
      return "attack";
    case "hit":
      return "hit";
    case "recover":
      return "recover";
    case "defeat_fall":
      return "defeat_fall";
    case "defeat_ground":
      return "defeat_ground";
    default:
      return "idle";
  }
}

export default function ScreenSpriteFighter({
  screenX,
  screenY,
  facing,
  action,
  spriteSet,
  sourceFrameWidth,
  sourceFrameHeight,
  renderWidth,
  renderHeight,
  flash = false,
  yOffset = 0,
}: {
  screenX: number;
  screenY: number;
  facing: "left" | "right";
  action: DotAction;
  spriteSet: SpriteSet;
  sourceFrameWidth: number;
  sourceFrameHeight: number;
  renderWidth: number;
  renderHeight: number;
  flash?: boolean;
  yOffset?: number;
}) {
  const animKey = mapAction(action);
  const anim = spriteSet[animKey];

  const [frame, setFrame] = useState(0);
  const [allLoaded, setAllLoaded] = useState(false);

  const animStartRef = useRef<number>(performance.now());
  const currentAnimRef = useRef<keyof SpriteSet>(animKey);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const imagesRef = useRef<Record<string, HTMLImageElement>>({});
  const failedRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (currentAnimRef.current !== animKey) {
      currentAnimRef.current = animKey;
      animStartRef.current = performance.now();
      setFrame(0);
    }
  }, [animKey]);

  useEffect(() => {
    let cancelled = false;

    const uniqueSrcs = Array.from(new Set(Object.values(spriteSet).map((entry) => entry.src)));

    const loadPromises = uniqueSrcs.map((src) => {
      return new Promise<void>((resolve) => {
        if (imagesRef.current[src] || failedRef.current[src]) {
          resolve();
          return;
        }

        const img = new Image();
        img.decoding = "async";
        img.src = src;

        img.onload = () => {
          imagesRef.current[src] = img;
          resolve();
        };

        img.onerror = () => {
          failedRef.current[src] = true;
          resolve();
        };
      });
    });

    Promise.all(loadPromises).then(() => {
      if (!cancelled) {
        setAllLoaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [spriteSet]);

  useEffect(() => {
    let mounted = true;

    const tick = () => {
      if (!mounted) return;

      const elapsed = performance.now() - animStartRef.current;
      const raw = Math.floor((elapsed / 1000) * anim.fps);

      const next = anim.loop ? raw % anim.frames : Math.min(raw, anim.frames - 1);

      setFrame((prev) => (prev === next ? prev : next));
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      mounted = false;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [anim.frames, anim.fps, anim.loop, anim.src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = imagesRef.current[anim.src];
    if (!img) return;

    const cssWidth = Math.max(1, Math.round(renderWidth));
    const cssHeight = Math.max(1, Math.round(renderHeight));

    const dpr =
      typeof window !== "undefined"
        ? Math.max(1, Math.min(window.devicePixelRatio || 1, 2))
        : 1;

    const backingWidth = Math.max(1, Math.round(cssWidth * dpr));
    const backingHeight = Math.max(1, Math.round(cssHeight * dpr));

    if (canvas.width !== backingWidth) {
      canvas.width = backingWidth;
    }

    if (canvas.height !== backingHeight) {
      canvas.height = backingHeight;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, backingWidth, backingHeight);
    ctx.scale(dpr, dpr);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const sx = Math.round(frame * sourceFrameWidth);
    const sy = 0;
    const sw = sourceFrameWidth;
    const sh = sourceFrameHeight;

    if (facing === "left") {
      ctx.save();
      ctx.translate(cssWidth, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cssWidth, cssHeight);
      ctx.restore();
    } else {
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cssWidth, cssHeight);
    }

    if (flash) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillRect(0, 0, cssWidth, cssHeight);
      ctx.restore();
    }
  }, [
    anim.src,
    frame,
    facing,
    flash,
    renderWidth,
    renderHeight,
    sourceFrameWidth,
    sourceFrameHeight,
    allLoaded,
  ]);

  const left = useMemo(() => Math.round(screenX - renderWidth / 2), [screenX, renderWidth]);

  const top = useMemo(
    () => Math.round(screenY - renderHeight + yOffset),
    [screenY, renderHeight, yOffset]
  );

  const currentImageReady = !!imagesRef.current[anim.src];

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left,
        top,
        width: Math.round(renderWidth),
        height: Math.round(renderHeight),
        willChange: "transform",
        transform: "translateZ(0)",
      }}
    >
      {!currentImageReady ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 9999,
            background: "rgba(255,255,255,0.12)",
          }}
        />
      ) : (
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            imageRendering: "auto",
          }}
        />
      )}
    </div>
  );
}