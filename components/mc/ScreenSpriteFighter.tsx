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

  // Cache all loaded images by src
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});
  const failedRef = useRef<Record<string, boolean>>({});

  // Only reset animation timing when action actually changes
  useEffect(() => {
    if (currentAnimRef.current !== animKey) {
      currentAnimRef.current = animKey;
      animStartRef.current = performance.now();
      setFrame(0);
    }
  }, [animKey]);

  // Preload the entire sprite set once
  useEffect(() => {
    let cancelled = false;

    const uniqueSrcs = Array.from(
      new Set(
        Object.values(spriteSet).map((entry) => entry.src)
      )
    );

    const loadPromises = uniqueSrcs.map((src) => {
      return new Promise<void>((resolve) => {
        if (imagesRef.current[src] || failedRef.current[src]) {
          resolve();
          return;
        }

        const img = new Image();
        img.src = src;

        img.onload = () => {
          imagesRef.current[src] = img;
          resolve();
        };

        img.onerror = () => {
          console.error("Failed to load sprite:", src);
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

  // Frame ticker
  useEffect(() => {
    let mounted = true;

    const tick = () => {
      if (!mounted) return;

      const elapsed = performance.now() - animStartRef.current;
      const raw = Math.floor((elapsed / 1000) * anim.fps);

      const next = anim.loop
        ? raw % anim.frames
        : Math.min(raw, anim.frames - 1);

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

  // Draw current frame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = renderWidth;
    canvas.height = renderHeight;

    ctx.clearRect(0, 0, renderWidth, renderHeight);

    const img = imagesRef.current[anim.src];
    if (!img) {
      return;
    }

    ctx.imageSmoothingEnabled = true;

    const sx = frame * sourceFrameWidth;
    const sy = 0;
    const sw = sourceFrameWidth;
    const sh = sourceFrameHeight;

    if (facing === "left") {
      ctx.save();
      ctx.translate(renderWidth, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(
        img,
        sx,
        sy,
        sw,
        sh,
        0,
        0,
        renderWidth,
        renderHeight
      );
      ctx.restore();
    } else {
      ctx.drawImage(
        img,
        sx,
        sy,
        sw,
        sh,
        0,
        0,
        renderWidth,
        renderHeight
      );
    }

    if (flash) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillRect(0, 0, renderWidth, renderHeight);
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

  const left = useMemo(() => screenX - renderWidth / 2, [screenX, renderWidth]);
  const top = useMemo(
    () => screenY - renderHeight + yOffset,
    [screenY, renderHeight, yOffset]
  );

  const currentImageReady = !!imagesRef.current[anim.src];

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left,
        top,
        width: renderWidth,
        height: renderHeight,
        willChange: "left, top",
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
            width: renderWidth,
            height: renderHeight,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}