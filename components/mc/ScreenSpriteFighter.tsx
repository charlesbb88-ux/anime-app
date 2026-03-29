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

export type SpriteAnim = {
  src: string;
  frames: number;
  fps: number;
  loop: boolean;
};

export type SpriteSet = {
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

function getUniqueImageSrcsFromLayers(layers: SpriteSet[]) {
  const srcs = new Set<string>();

  for (const layer of layers) {
    srcs.add(layer.idle.src);
    srcs.add(layer.run.src);
    srcs.add(layer.jump.src);
    srcs.add(layer.attack.src);
    srcs.add(layer.hit.src);
    srcs.add(layer.recover.src);
    srcs.add(layer.defeat_fall.src);
    srcs.add(layer.defeat_ground.src);
  }

  return Array.from(srcs);
}

export default function ScreenSpriteFighter({
  screenX,
  screenY,
  facing,
  action,
  layers,
  sourceFrameWidth,
  sourceFrameHeight,
  renderWidth,
  renderHeight,
  flash = false,
  yOffset = 0,
  isActive = true,
}: {
  screenX: number;
  screenY: number;
  facing: "left" | "right";
  action: DotAction;
  layers: SpriteSet[];
  sourceFrameWidth: number;
  sourceFrameHeight: number;
  renderWidth: number;
  renderHeight: number;
  flash?: boolean;
  yOffset?: number;
  isActive?: boolean;
}) {
  const animKey = mapAction(action);

  const activeLayerAnims = useMemo(() => {
    return layers.map((layer) => layer[animKey]);
  }, [layers, animKey]);

  const masterAnim = activeLayerAnims.find(
    (anim) => !!anim?.src && anim.frames > 0 && anim.fps > 0
  );

  const [allLoaded, setAllLoaded] = useState(false);
  const [tickCount, setTickCount] = useState(0);

  const animStartRef = useRef<number>(performance.now());
  const currentAnimRef = useRef<string>("");
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const imagesRef = useRef<Record<string, HTMLImageElement>>({});
  const failedRef = useRef<Record<string, boolean>>({});

  const pausedElapsedMsRef = useRef(0);
  const pauseStartedAtRef = useRef<number | null>(null);

  const animIdentity = useMemo(() => {
    return [
      animKey,
      ...activeLayerAnims.map((anim) =>
        anim ? `${anim.src}|${anim.frames}|${anim.fps}|${anim.loop ? 1 : 0}` : "missing"
      ),
    ].join("::");
  }, [animKey, activeLayerAnims]);

  const frame = useMemo(() => {
    if (!masterAnim) return 0;

    if (currentAnimRef.current !== animIdentity) {
      currentAnimRef.current = animIdentity;
      animStartRef.current = performance.now();
      pausedElapsedMsRef.current = 0;
      pauseStartedAtRef.current = isActive ? null : performance.now();
      return 0;
    }

    const elapsed = isActive
      ? performance.now() - animStartRef.current - pausedElapsedMsRef.current
      : pauseStartedAtRef.current != null
        ? pauseStartedAtRef.current - animStartRef.current - pausedElapsedMsRef.current
        : performance.now() - animStartRef.current - pausedElapsedMsRef.current;

    const safeElapsed = Math.max(0, elapsed);
    const raw = Math.floor((safeElapsed / 1000) * masterAnim.fps);

    return masterAnim.loop
      ? raw % masterAnim.frames
      : Math.min(raw, masterAnim.frames - 1);
  }, [masterAnim, animIdentity, tickCount, isActive]);

  useEffect(() => {
    let cancelled = false;

    const uniqueSrcs = getUniqueImageSrcsFromLayers(layers);

    if (uniqueSrcs.length === 0) {
      setAllLoaded(true);
      return;
    }

    setAllLoaded(false);

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
  }, [layers]);

  useEffect(() => {
    if (isActive) {
      if (pauseStartedAtRef.current != null) {
        pausedElapsedMsRef.current += performance.now() - pauseStartedAtRef.current;
        pauseStartedAtRef.current = null;
      }

      let mounted = true;

      const tick = () => {
        if (!mounted) return;

        setTickCount((value) => value + 1);
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);

      return () => {
        mounted = false;
        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };
    }

    if (pauseStartedAtRef.current == null) {
      pauseStartedAtRef.current = performance.now();
    }

    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    setTickCount((value) => value + 1);

    return () => {};
  }, [isActive, animIdentity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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

    const cropInset = 1;

    const sx = Math.round(frame * sourceFrameWidth) + cropInset;
    const sy = cropInset;
    const sw = sourceFrameWidth - cropInset * 2;
    const sh = sourceFrameHeight - cropInset * 2;

    const drawAllLayers = () => {
      for (const anim of activeLayerAnims) {
        if (!anim?.src) continue;

        const img = imagesRef.current[anim.src];
        if (!img) continue;

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cssWidth, cssHeight);
      }
    };

    if (facing === "left") {
      ctx.save();
      ctx.translate(cssWidth, 0);
      ctx.scale(-1, 1);
      drawAllLayers();
      ctx.restore();
    } else {
      drawAllLayers();
    }

    if (flash) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillRect(0, 0, cssWidth, cssHeight);
      ctx.restore();
    }
  }, [
    activeLayerAnims,
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

  const anyCurrentLayerReady = activeLayerAnims.some((anim) => !!imagesRef.current[anim?.src]);

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
      {!anyCurrentLayerReady ? (
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