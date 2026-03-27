"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ScreenSpriteFighter from "@/components/mc/ScreenSpriteFighter";
import {
  buildMcPaperDollLayers,
  resolveMcPaperDollDefinition,
} from "@/components/mc/paperdoll/buildMcPaperDollLayers";
import {
  DEFAULT_MC_PAPERDOLL_LOADOUT,
  MC_PAPERDOLL_CATALOG,
} from "@/components/mc/paperdoll/mcPaperDollCatalog";
import type { McPaperDollLoadout } from "@/components/mc/paperdoll/mcPaperDollTypes";
import type { DotReplayFrame } from "@/lib/dot/mcDotReplayTypes";
import type { McBattleCardRow } from "@/components/mc/battles/mcBattleTypes";

const BASE_STAGE_HEIGHT_PX = 320;
const BASE_STAGE_WIDTH_PX = 920;
const FRAME_MS = 1000 / 60;

const CAMERA_MIN_SCALE_DESKTOP = 0.68;
const CAMERA_MIN_SCALE_MOBILE = 0.42;
const CAMERA_MAX_SCALE = 1.18;
const CAMERA_LERP = 0.14;
const CAMERA_VERTICAL_LERP = 0.12;

const CAMERA_EDGE_PADDING = 140;
const CAMERA_EDGE_SOFT_ZONE = 220;

const CAMERA_SIDE_PADDING = 120;
const CAMERA_TOP_PADDING = 80;
const CAMERA_BOTTOM_PADDING = 74;
const CAMERA_AIR_BOTTOM_PADDING = 26;

const CAMERA_GROUNDED_EPSILON = 0.06;

const BG_PARALLAX_X = 0.18;
const BG_PARALLAX_Y = 0.08;
const BG_PARALLAX_SCALE = 1.18;

type Props = {
  battle: McBattleCardRow;
  title?: string;
  compact?: boolean;
};

function getInterpolatedFrame(frames: DotReplayFrame[], t: number): DotReplayFrame | null {
  if (!frames.length) return null;
  if (t <= frames[0].t) return frames[0];
  if (t >= frames[frames.length - 1].t) return frames[frames.length - 1];

  for (let i = 0; i < frames.length - 1; i += 1) {
    const a = frames[i];
    const b = frames[i + 1];

    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t || 1;
      const localT = (t - a.t) / span;

      return {
        t,
        fighters: {
          left: {
            x: a.fighters.left.x + (b.fighters.left.x - a.fighters.left.x) * localT,
            y: a.fighters.left.y + (b.fighters.left.y - a.fighters.left.y) * localT,
            facing: localT < 0.5 ? a.fighters.left.facing : b.fighters.left.facing,
            action: localT < 0.5 ? a.fighters.left.action : b.fighters.left.action,
            hp: localT < 0.5 ? a.fighters.left.hp : b.fighters.left.hp,
          },
          right: {
            x: a.fighters.right.x + (b.fighters.right.x - a.fighters.right.x) * localT,
            y: a.fighters.right.y + (b.fighters.right.y - a.fighters.right.y) * localT,
            facing: localT < 0.5 ? a.fighters.right.facing : b.fighters.right.facing,
            action: localT < 0.5 ? a.fighters.right.action : b.fighters.right.action,
            hp: localT < 0.5 ? a.fighters.right.hp : b.fighters.right.hp,
          },
        },
      };
    }
  }

  return frames[frames.length - 1];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function normalizePaperdollLoadout(value: unknown): McPaperDollLoadout {
  const raw = (value ?? {}) as Partial<McPaperDollLoadout>;

  return {
    body:
      typeof raw.body === "string" && raw.body.trim()
        ? raw.body
        : DEFAULT_MC_PAPERDOLL_LOADOUT.body,
    hair: typeof raw.hair === "string" && raw.hair.trim() ? raw.hair : null,
    torso: typeof raw.torso === "string" && raw.torso.trim() ? raw.torso : null,
    bottoms: typeof raw.bottoms === "string" && raw.bottoms.trim() ? raw.bottoms : null,
    feet: typeof raw.feet === "string" && raw.feet.trim() ? raw.feet : null,
    hands: typeof raw.hands === "string" && raw.hands.trim() ? raw.hands : null,
    eyes: typeof raw.eyes === "string" && raw.eyes.trim() ? raw.eyes : null,
  };
}

export default function McBattleReplayCard({
  battle,
  title,
  compact = false,
}: Props) {
  const replay = battle.replay_data?.dot_replay ?? null;

  const [timeMs, setTimeMs] = useState(0);
  const [cameraX, setCameraX] = useState(0);
  const [cameraY, setCameraY] = useState(0);
  const [cameraScale, setCameraScale] = useState(1);
  const [playbackKey, setPlaybackKey] = useState(0);
  const [viewportScale, setViewportScale] = useState(1);

  const rafRef = useRef<number | null>(null);
  const cameraXRef = useRef(0);
  const cameraYRef = useRef(0);
  const cameraScaleRef = useRef(1);
  const playbackTimeRef = useRef(0);
  const lastNowRef = useRef<number | null>(null);
  const stageViewportRef = useRef<HTMLDivElement | null>(null);
  const lastTriggeredHitRef = useRef<number | null>(null);

  const leftLoadout = useMemo(() => {
    return normalizePaperdollLoadout(battle?.challenger_snapshot?.paperdoll);
  }, [battle]);

  const rightLoadout = useMemo(() => {
    return normalizePaperdollLoadout(battle?.defender_snapshot?.paperdoll);
  }, [battle]);

  const leftLayers = useMemo(() => {
    const definition = resolveMcPaperDollDefinition(MC_PAPERDOLL_CATALOG, leftLoadout);
    return buildMcPaperDollLayers(definition);
  }, [leftLoadout]);

  const rightLayers = useMemo(() => {
    const definition = resolveMcPaperDollDefinition(MC_PAPERDOLL_CATALOG, rightLoadout);
    return buildMcPaperDollLayers(definition);
  }, [rightLoadout]);

  const stageWidthPx = Math.round(BASE_STAGE_WIDTH_PX * viewportScale);
  const stageHeightPx = Math.round(BASE_STAGE_HEIGHT_PX * viewportScale);
  const groundScreenY = stageHeightPx - 18 * viewportScale;

  const isNarrowScreen = stageWidthPx < 700;
  const cameraMinScaleBase = isNarrowScreen
    ? CAMERA_MIN_SCALE_MOBILE
    : CAMERA_MIN_SCALE_DESKTOP;

  const fighterScaleMultiplier = isNarrowScreen ? 0.82 : 1;

  const renderWidth = Math.round(130 * viewportScale * fighterScaleMultiplier);
  const renderHeight = Math.round(173 * viewportScale * fighterScaleMultiplier);
  const groundedYOffset = Math.round(8 * viewportScale * fighterScaleMultiplier);
  const defeatGroundYOffset = Math.round(28 * viewportScale * fighterScaleMultiplier);

  const toScreenX = (x: number, worldStageWidth: number) => {
    const normalized = (x + worldStageWidth / 2) / worldStageWidth;
    return normalized * stageWidthPx;
  };

  const toScreenY = (y: number) => {
    const ground = stageHeightPx - 18 * viewportScale;
    return ground - y * 90 * viewportScale;
  };

  useLayoutEffect(() => {
    if (!replay) return;

    let frame1: number | null = null;
    let frame2: number | null = null;
    let frame3: number | null = null;

    const updateViewportScale = () => {
      const el = stageViewportRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const availableWidth = rect.width;
      const availableHeight = rect.height;

      if (!availableWidth || !availableHeight) return;

      const nextScale = availableWidth / BASE_STAGE_WIDTH_PX;

      setViewportScale((prev) => {
        if (Math.abs(prev - nextScale) < 0.0001) return prev;
        return nextScale;
      });
    };

    updateViewportScale();

    frame1 = window.requestAnimationFrame(() => {
      updateViewportScale();

      frame2 = window.requestAnimationFrame(() => {
        updateViewportScale();

        frame3 = window.requestAnimationFrame(() => {
          updateViewportScale();
        });
      });
    });

    const observer = new ResizeObserver(() => {
      updateViewportScale();
    });

    const el = stageViewportRef.current;
    if (el) observer.observe(el);

    const handleWindowResize = () => {
      updateViewportScale();
    };

    window.addEventListener("resize", handleWindowResize);

    return () => {
      if (frame1 != null) window.cancelAnimationFrame(frame1);
      if (frame2 != null) window.cancelAnimationFrame(frame2);
      if (frame3 != null) window.cancelAnimationFrame(frame3);
      observer.disconnect();
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [replay]);

  useEffect(() => {
    if (!replay) return;

    if (rafRef.current != null) {
      window.cancelAnimationFrame(rafRef.current);
    }

    playbackTimeRef.current = 0;
    lastNowRef.current = null;
    setTimeMs(0);

    const tick = (now: number) => {
      if (!replay) return;

      if (lastNowRef.current == null) {
        lastNowRef.current = now;
      }

      const rawDelta = now - lastNowRef.current;
      lastNowRef.current = now;

      const deltaMs = Math.min(rawDelta, 50);

      playbackTimeRef.current = Math.min(
        playbackTimeRef.current + deltaMs,
        replay.durationMs
      );

      setTimeMs(playbackTimeRef.current);

      if (playbackTimeRef.current < replay.durationMs) {
        rafRef.current = window.requestAnimationFrame(tick);
      }
    };

    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, [replay, playbackKey]);

  const frame = useMemo(() => {
    if (!replay) return null;
    return getInterpolatedFrame(replay.frames, timeMs);
  }, [replay, timeMs]);

  const leftAction = frame?.fighters.left.action;
  const rightAction = frame?.fighters.right.action;

  const leftShouldRenderOnTop =
    rightAction === "defeat_ground" ||
    (leftAction !== "defeat_ground" && rightAction === "defeat_fall");

  const rightShouldRenderOnTop =
    leftAction === "defeat_ground" ||
    (rightAction !== "defeat_ground" && leftAction === "defeat_fall");

  const fighterRenderList = !frame
    ? []
    : [
      {
        key: "left",
        shouldRenderOnTop: leftShouldRenderOnTop,
        fighter: frame.fighters.left,
        layers: leftLayers,
      },
      {
        key: "right",
        shouldRenderOnTop: rightShouldRenderOnTop,
        fighter: frame.fighters.right,
        layers: rightLayers,
      },
    ].sort((a, b) => {
      if (a.shouldRenderOnTop === b.shouldRenderOnTop) return 0;
      return a.shouldRenderOnTop ? 1 : -1;
    });

  useEffect(() => {
    if (!replay) return;

    const hit = replay.hitEvents.find(
      (item) => timeMs >= item.t && timeMs < item.t + FRAME_MS
    );

    if (!hit) return;
    if (lastTriggeredHitRef.current === hit.t) return;

    lastTriggeredHitRef.current = hit.t;
  }, [replay, timeMs]);

  useEffect(() => {
    if (!frame || !replay) return;

    const leftPxX = toScreenX(frame.fighters.left.x, replay.stageWidth);
    const rightPxX = toScreenX(frame.fighters.right.x, replay.stageWidth);

    const leftPxY = toScreenY(frame.fighters.left.y);
    const rightPxY = toScreenY(frame.fighters.right.y);

    const leftGrounded = frame.fighters.left.y <= CAMERA_GROUNDED_EPSILON;
    const rightGrounded = frame.fighters.right.y <= CAMERA_GROUNDED_EPSILON;
    const someoneGrounded = leftGrounded || rightGrounded;
    const bothAirborne = !someoneGrounded;

    const fighterHalfWidth = 48 * viewportScale;
    const fighterHeight = 96 * viewportScale;

    const fighterMinX = Math.min(leftPxX, rightPxX) - fighterHalfWidth;
    const fighterMaxX = Math.max(leftPxX, rightPxX) + fighterHalfWidth;

    const fighterMinY = Math.min(leftPxY, rightPxY) - fighterHeight;
    const fighterMaxY = Math.max(leftPxY, rightPxY);

    let framedMinX = fighterMinX - CAMERA_SIDE_PADDING * viewportScale;
    let framedMaxX = fighterMaxX + CAMERA_SIDE_PADDING * viewportScale;

    const leftDistToEdge = fighterMinX;
    const rightDistToEdge = stageWidthPx - fighterMaxX;

    if (leftDistToEdge < CAMERA_EDGE_SOFT_ZONE * viewportScale) {
      const t = 1 - leftDistToEdge / (CAMERA_EDGE_SOFT_ZONE * viewportScale);
      framedMinX -= CAMERA_EDGE_PADDING * viewportScale * t;
    }

    if (rightDistToEdge < CAMERA_EDGE_SOFT_ZONE * viewportScale) {
      const t = 1 - rightDistToEdge / (CAMERA_EDGE_SOFT_ZONE * viewportScale);
      framedMaxX += CAMERA_EDGE_PADDING * viewportScale * t;
    }

    const framedMinY = fighterMinY - CAMERA_TOP_PADDING * viewportScale;

    const framedMaxY = bothAirborne
      ? fighterMaxY + CAMERA_AIR_BOTTOM_PADDING * viewportScale
      : Math.max(
        fighterMaxY + CAMERA_AIR_BOTTOM_PADDING * viewportScale,
        groundScreenY + CAMERA_BOTTOM_PADDING * viewportScale
      );

    const framedWidth = Math.max(220 * viewportScale, framedMaxX - framedMinX);
    const framedHeight = Math.max(160 * viewportScale, framedMaxY - framedMinY);

    const rawTargetScale = Math.min(
      stageWidthPx / framedWidth,
      stageHeightPx / framedHeight
    );

    const edgeDistance = Math.min(leftDistToEdge, rightDistToEdge);
    const edgeT = clamp(
      1 - edgeDistance / (CAMERA_EDGE_SOFT_ZONE * viewportScale),
      0,
      1
    );

    const airborneEdgeMinScale = someoneGrounded
      ? cameraMinScaleBase
      : lerp(cameraMinScaleBase, Math.min(0.92, CAMERA_MAX_SCALE), edgeT * 0.9);

    const cameraMinScale = airborneEdgeMinScale;
    const targetScale = clamp(rawTargetScale, cameraMinScale, CAMERA_MAX_SCALE);

    const frameCenterX = (framedMinX + framedMaxX) / 2;
    const frameCenterY = (framedMinY + framedMaxY) / 2;

    const stageCenterX = stageWidthPx / 2;
    const stageCenterY = stageHeightPx / 2;

    const targetCameraX = stageCenterX - frameCenterX;
    const targetCameraY = stageCenterY - frameCenterY;

    const nextCameraX =
      cameraXRef.current + (targetCameraX - cameraXRef.current) * CAMERA_LERP;

    const nextCameraY =
      cameraYRef.current +
      (targetCameraY - cameraYRef.current) * CAMERA_VERTICAL_LERP;

    const nextCameraScale =
      cameraScaleRef.current +
      (targetScale - cameraScaleRef.current) * CAMERA_LERP;

    cameraXRef.current = nextCameraX;
    cameraYRef.current = nextCameraY;
    cameraScaleRef.current = nextCameraScale;

    setCameraX(nextCameraX);
    setCameraY(nextCameraY);
    setCameraScale(nextCameraScale);
  }, [
    frame,
    replay,
    viewportScale,
    stageWidthPx,
    stageHeightPx,
    groundScreenY,
    cameraMinScaleBase,
  ]);

  const cameraTranslateX = cameraX;
  const cameraTranslateY = cameraY;
  const backgroundParallaxX = -cameraTranslateX * BG_PARALLAX_X;
  const backgroundParallaxY = -cameraTranslateY * BG_PARALLAX_Y;

  const challengerName = battle.challenger_snapshot?.username ?? "Challenger";
  const defenderName = battle.defender_snapshot?.username ?? "Defender";

  const winnerName =
    battle.winner_user_id === battle.challenger_user_id
      ? challengerName
      : battle.winner_user_id === battle.defender_user_id
        ? defenderName
        : "Unknown";

  if (!replay) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70">
        Replay missing.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">
            {title ?? `${challengerName} vs ${defenderName}`}
          </div>
          <div className="mt-1 text-xs text-white/55">
            Winner: {winnerName}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            playbackTimeRef.current = 0;
            lastNowRef.current = null;
            lastTriggeredHitRef.current = null;

            setTimeMs(0);

            cameraXRef.current = 0;
            cameraYRef.current = 0;
            cameraScaleRef.current = 1;

            setCameraX(0);
            setCameraY(0);
            setCameraScale(1);

            setPlaybackKey((prev) => prev + 1);
          }}
          className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
        >
          Replay
        </button>
      </div>

      {!compact && (
        <div className="mb-3 text-xs text-white/50">
          {challengerName} vs {defenderName} • {replay.durationMs} ms
        </div>
      )}

      <div
        ref={stageViewportRef}
        className="relative mx-auto w-full overflow-hidden rounded-xs bg-[#0f0f0f]"
        style={{
          aspectRatio: `${BASE_STAGE_WIDTH_PX} / ${BASE_STAGE_HEIGHT_PX}`,
        }}
      >
        <div
          className="relative overflow-hidden bg-[#0f0f0f]"
          style={{
            width: stageWidthPx,
            height: stageHeightPx,
          }}
        >
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                left: "-10%",
                top: "-10%",
                width: "120%",
                height: "120%",
                backgroundImage: 'url("/mc/backgrounds/arena-bg.png")',
                backgroundSize: "100% 100%",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                transform: `translateX(${backgroundParallaxX}px) translateY(${backgroundParallaxY}px) scale(${BG_PARALLAX_SCALE})`,
                transformOrigin: "center center",
              }}
            />
          </div>

          <div
            className="absolute inset-0"
            style={{
              transform: `translateX(${cameraTranslateX}px) translateY(${cameraTranslateY}px)`,
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                transform: `scale(${cameraScale})`,
                transformOrigin: "center center",
              }}
            >
              <div
                className="absolute left-0 right-0 pointer-events-none"
                style={{
                  bottom: -185 * viewportScale,
                  height: stageHeightPx,
                  backgroundImage: 'url("/mc/backgrounds/arena-platform.png")',
                  backgroundSize: "100% 100%",
                  backgroundPosition: "center bottom",
                  backgroundRepeat: "no-repeat",
                }}
              />

              <div
                className="absolute inset-x-0 bg-white/20"
                style={{
                  bottom: 16 * viewportScale,
                  height: Math.max(1, 2 * viewportScale),
                }}
              />

              {fighterRenderList.map((item) => (
                <ScreenSpriteFighter
                  key={item.key}
                  screenX={toScreenX(item.fighter.x, replay.stageWidth)}
                  screenY={toScreenY(item.fighter.y)}
                  facing={item.fighter.facing}
                  action={item.fighter.action}
                  layers={item.layers}
                  sourceFrameWidth={768}
                  sourceFrameHeight={1024}
                  renderWidth={renderWidth}
                  renderHeight={renderHeight}
                  yOffset={
                    item.fighter.action === "defeat_ground"
                      ? defeatGroundYOffset
                      : groundedYOffset
                  }
                  flash={false}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}