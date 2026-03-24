import React, { useEffect, useMemo, useRef, useState } from "react";

export type DotAction =
  | "idle"
  | "run"
  | "jump"
  | "attack"
  | "hit"
  | "recover";

export type FacingDirection = "left" | "right";

type SpriteAnimDef = {
  src: string;
  frames: number;
  fps: number;
  loop: boolean;
};

type SpriteSet = {
  idle: SpriteAnimDef;
  run: SpriteAnimDef;
  jump: SpriteAnimDef;
  attack: SpriteAnimDef;
  hit: SpriteAnimDef;
  recover: SpriteAnimDef;
};

type SpriteFighterProps = {
  x: number;
  y: number;
  facing: FacingDirection;
  action: DotAction;
  hp?: number;

  stageWidth: number;
  stageHeightPx: number;

  spriteWidthPx?: number;
  spriteHeightPx?: number;
  groundOffsetPx?: number;

  cameraX?: number;
  cameraScale?: number;

  spriteSet: SpriteSet;

  className?: string;
};

const DEFAULT_WIDTH = 120;
const DEFAULT_HEIGHT = 120;
const DEFAULT_GROUND_OFFSET = 0;

function actionToAnim(action: DotAction): keyof SpriteSet {
  switch (action) {
    case "idle":
      return "idle";
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
    default:
      return "idle";
  }
}

export default function SpriteFighter({
  x,
  y,
  facing,
  action,
  stageWidth,
  stageHeightPx,
  spriteWidthPx = DEFAULT_WIDTH,
  spriteHeightPx = DEFAULT_HEIGHT,
  groundOffsetPx = DEFAULT_GROUND_OFFSET,
  cameraX = 0,
  cameraScale = 1,
  spriteSet,
  className,
}: SpriteFighterProps) {
  const animKey = actionToAnim(action);
  const anim = spriteSet[animKey];

  const [frameIndex, setFrameIndex] = useState(0);

  const activeAnimKeyRef = useRef<keyof SpriteSet>(animKey);
  const animStartTimeRef = useRef<number>(performance.now());
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (activeAnimKeyRef.current !== animKey) {
      activeAnimKeyRef.current = animKey;
      animStartTimeRef.current = performance.now();
      setFrameIndex(0);
    }
  }, [animKey]);

  useEffect(() => {
    let mounted = true;

    const tick = () => {
      if (!mounted) return;

      const now = performance.now();
      const elapsed = now - animStartTimeRef.current;
      const totalFrames = Math.max(1, anim.frames);
      const fps = Math.max(1, anim.fps);
      const rawFrame = Math.floor((elapsed / 1000) * fps);

      let nextFrame = 0;

      if (anim.loop) {
        nextFrame = rawFrame % totalFrames;
      } else {
        nextFrame = Math.min(rawFrame, totalFrames - 1);
      }

      setFrameIndex((prev) => (prev === nextFrame ? prev : nextFrame));
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      mounted = false;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [anim]);

  const pixelsPerWorldUnit = useMemo(() => {
    return stageHeightPx / 8;
  }, [stageHeightPx]);

  const leftPx = useMemo(() => {
    const screenCenterX = stageWidth / 2;
    const cameraAdjustedX = (x - cameraX) * cameraScale + screenCenterX;
    return cameraAdjustedX * pixelsPerWorldUnit - spriteWidthPx / 2;
  }, [x, cameraX, cameraScale, stageWidth, pixelsPerWorldUnit, spriteWidthPx]);

  const bottomPx = useMemo(() => {
    return y * pixelsPerWorldUnit + groundOffsetPx;
  }, [y, pixelsPerWorldUnit, groundOffsetPx]);

  const backgroundSizeX = `${anim.frames * 100}%`;
  const backgroundPosX =
    anim.frames <= 1
      ? "0%"
      : `${(frameIndex / (anim.frames - 1)) * 100}%`;

  const flipScale = facing === "right" ? 1 : -1;

  return (
    <div
      className={className}
      style={{
        position: "absolute",
        left: `${leftPx}px`,
        bottom: `${bottomPx}px`,
        width: `${spriteWidthPx}px`,
        height: `${spriteHeightPx}px`,
        pointerEvents: "none",
        transform: `scaleX(${flipScale})`,
        transformOrigin: "center bottom",
        imageRendering: "pixelated",
        willChange: "transform, left, bottom",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundImage: `url(${anim.src})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${backgroundSizeX} 100%`,
          backgroundPosition: `${backgroundPosX} 0%`,
        }}
      />
    </div>
  );
}

export type { SpriteSet, SpriteAnimDef };