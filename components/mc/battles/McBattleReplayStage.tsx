"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
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
import McBattleHud from "@/components/mc/battles/McBattleHud";
import McBattleFighterIndicators, {
  getIndicatorMetrics,
  useIndicatorDeviceType,
} from "@/components/mc/battles/McBattleFighterIndicators";

const BASE_STAGE_HEIGHT_PX = 320;
const BASE_STAGE_WIDTH_PX = 920;
const FRAME_MS = 1000 / 60;

const CAMERA_MIN_SCALE_DESKTOP = 0.6;
const CAMERA_MIN_SCALE_MOBILE = 0.38;
const CAMERA_MAX_SCALE = 1.18;
const CAMERA_LERP = 0.14;
const CAMERA_VERTICAL_LERP = 0.12;

const CAMERA_EDGE_PADDING = 140;
const CAMERA_EDGE_SOFT_ZONE = 220;

const CAMERA_SIDE_PADDING = 120;
const CAMERA_TOP_PADDING = 110;
const CAMERA_BOTTOM_PADDING = 74;
const CAMERA_AIR_BOTTOM_PADDING = 40;
const CAMERA_ONE_AIRBORNE_BOTTOM_PADDING = 134;

const CAMERA_CLOSE_RANGE_WORLD_DISTANCE = 260;
const CAMERA_CLOSE_SIDE_PADDING_MIN = 0;
const CAMERA_CLOSE_FIGHTER_HALF_WIDTH_MIN = 8;
const CAMERA_CLOSE_ZOOM_BONUS = 1.45;

const CAMERA_GROUNDED_EPSILON = 0.06;

const BG_PARALLAX_X = 0.18;
const BG_PARALLAX_Y = 0.08;
const BG_PARALLAX_SCALE = 1.18;

const WORLD_RENDER_Y_OFFSET_PX = 22;
const PLATFORM_BOTTOM_PX = -185;
const FLOOR_LINE_BOTTOM_PX = 16;

const DEBUG_CAMERA = false;
const DEBUG_CAMERA_LOG_INTERVAL_MS = 180;

const DESKTOP_COMMIT_FPS = 30;
const MOBILE_COMMIT_FPS = 24;

type Props = {
  battle: McBattleCardRow;
  isActive?: boolean;
  replayNonce?: number;
};

type FighterSide = "left" | "right";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
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
    bottoms:
      typeof raw.bottoms === "string" && raw.bottoms.trim() ? raw.bottoms : null,
    feet: typeof raw.feet === "string" && raw.feet.trim() ? raw.feet : null,
    hands: typeof raw.hands === "string" && raw.hands.trim() ? raw.hands : null,
    eyes: typeof raw.eyes === "string" && raw.eyes.trim() ? raw.eyes : null,
  };
}

function areLoadoutsVisuallyIdentical(a: McPaperDollLoadout, b: McPaperDollLoadout) {
  return (
    a.body === b.body &&
    a.hair === b.hair &&
    a.torso === b.torso &&
    a.bottoms === b.bottoms &&
    a.feet === b.feet &&
    a.hands === b.hands &&
    a.eyes === b.eyes
  );
}

function getInterpolatedFrameWithCursor(
  frames: DotReplayFrame[],
  t: number,
  cursorRef: React.MutableRefObject<number>
): DotReplayFrame | null {
  if (!frames.length) return null;
  if (t <= frames[0].t) {
    cursorRef.current = 0;
    return frames[0];
  }

  const lastIndex = frames.length - 1;
  if (t >= frames[lastIndex].t) {
    cursorRef.current = Math.max(0, lastIndex - 1);
    return frames[lastIndex];
  }

  let i = clamp(cursorRef.current, 0, Math.max(0, lastIndex - 1));

  while (i < lastIndex - 1 && t > frames[i + 1].t) {
    i += 1;
  }

  while (i > 0 && t < frames[i].t) {
    i -= 1;
  }

  cursorRef.current = i;

  const a = frames[i];
  const b = frames[i + 1];
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

export default function McBattleReplayStage({
  battle,
  isActive = true,
  replayNonce = 0,
}: Props) {
  const replay = battle.replay_data?.dot_replay ?? null;
  const indicatorDeviceType = useIndicatorDeviceType();

  const [viewportScale, setViewportScale] = useState(1);
  const [avatars, setAvatars] = useState<{ left: string | null; right: string | null }>(
    {
      left: null,
      right: null,
    }
  );
  const [displayFrame, setDisplayFrame] = useState<DotReplayFrame | null>(
    replay?.frames?.[0] ?? null
  );

  const rafRef = useRef<number | null>(null);
  const playbackTimeRef = useRef(0);
  const lastNowRef = useRef<number | null>(null);
  const stageViewportRef = useRef<HTMLDivElement | null>(null);
  const worldTranslateRef = useRef<HTMLDivElement | null>(null);
  const worldScaleRef = useRef<HTMLDivElement | null>(null);
  const bgParallaxRef = useRef<HTMLDivElement | null>(null);
  const fighterWrapperRefs = useRef<Record<FighterSide, HTMLDivElement | null>>({
    left: null,
    right: null,
  });
  const indicatorWrapperRefs = useRef<Record<FighterSide, HTMLDivElement | null>>({
    left: null,
    right: null,
  });
  const frameCursorRef = useRef(0);
  const currentFrameRef = useRef<DotReplayFrame | null>(replay?.frames?.[0] ?? null);
  const cameraXRef = useRef(0);
  const cameraYRef = useRef(0);
  const cameraScaleRef = useRef(1);
  const lastTriggeredHitRef = useRef<number | null>(null);
  const lastDebugLogAtRef = useRef(0);
  const lastCommitAtRef = useRef(0);

  const leftLoadout = useMemo(() => {
    return normalizePaperdollLoadout(battle?.challenger_snapshot?.paperdoll);
  }, [battle]);

  const rightLoadout = useMemo(() => {
    return normalizePaperdollLoadout(battle?.defender_snapshot?.paperdoll);
  }, [battle]);

  const shouldShowSameLoadoutIndicators = useMemo(() => {
    return areLoadoutsVisuallyIdentical(leftLoadout, rightLoadout);
  }, [leftLoadout, rightLoadout]);

  const leftLayers = useMemo(() => {
    const definition = resolveMcPaperDollDefinition(MC_PAPERDOLL_CATALOG, leftLoadout);
    return buildMcPaperDollLayers(definition);
  }, [leftLoadout]);

  const rightLayers = useMemo(() => {
    const definition = resolveMcPaperDollDefinition(MC_PAPERDOLL_CATALOG, rightLoadout);
    return buildMcPaperDollLayers(definition);
  }, [rightLoadout]);

  useEffect(() => {
    let isMounted = true;

    async function loadAvatars() {
      const { challenger_user_id, defender_user_id } = battle;

      const { data, error } = await supabase
        .from("profiles")
        .select("id, avatar_url")
        .in("id", [challenger_user_id, defender_user_id]);

      if (error) {
        console.error("Failed to load avatars", error);
        return;
      }

      if (!isMounted) return;

      const map: Record<string, string | null> = {};
      for (const row of data ?? []) {
        map[row.id] = row.avatar_url ?? null;
      }

      setAvatars({
        left: map[challenger_user_id] ?? null,
        right: map[defender_user_id] ?? null,
      });
    }

    loadAvatars();

    return () => {
      isMounted = false;
    };
  }, [battle]);

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

  const worldRenderYOffset = Math.round(WORLD_RENDER_Y_OFFSET_PX * viewportScale);

  const indicatorMetrics = useMemo(
    () => getIndicatorMetrics(indicatorDeviceType),
    [indicatorDeviceType]
  );

  const toScreenX = (x: number, worldStageWidth: number) => {
    const normalized = (x + worldStageWidth / 2) / worldStageWidth;
    return normalized * stageWidthPx;
  };

  const toScreenY = (y: number) => {
    const ground = stageHeightPx - 18 * viewportScale;
    return ground - y * 90 * viewportScale;
  };

  const updateFighterWrapper = (
    side: FighterSide,
    frameToUse: DotReplayFrame,
    shouldRenderOnTop: boolean
  ) => {
    const fighter = frameToUse.fighters[side];
    const wrapper = fighterWrapperRefs.current[side];
    if (!wrapper) return;

    const yOffset =
      fighter.action === "defeat_ground" ? defeatGroundYOffset : groundedYOffset;

    const left = Math.round(toScreenX(fighter.x, replay?.stageWidth ?? 0) - renderWidth / 2);
    const top = Math.round(toScreenY(fighter.y) - renderHeight + yOffset);

    wrapper.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    wrapper.style.zIndex = shouldRenderOnTop ? "2" : "1";
  };

  const updateIndicatorWrapper = (side: FighterSide, frameToUse: DotReplayFrame) => {
    const fighter = frameToUse.fighters[side];
    const wrapper = indicatorWrapperRefs.current[side];
    if (!wrapper || !replay) return;

    const screenX = Math.round(toScreenX(fighter.x, replay.stageWidth));
    const anchorY = Math.round(toScreenY(fighter.y) - indicatorMetrics.headOffset);

    wrapper.style.transform = `translate3d(${screenX}px, ${anchorY}px, 0)`;
  };

  const applyStaticPlacement = (frameToUse: DotReplayFrame | null) => {
    if (!replay || !frameToUse) return;

    const leftAction = frameToUse.fighters.left.action;
    const rightAction = frameToUse.fighters.right.action;

    const leftShouldRenderOnTop =
      rightAction === "defeat_ground" ||
      (leftAction !== "defeat_ground" && rightAction === "defeat_fall");

    const rightShouldRenderOnTop =
      leftAction === "defeat_ground" ||
      (rightAction !== "defeat_ground" && leftAction === "defeat_fall");

    updateFighterWrapper("left", frameToUse, leftShouldRenderOnTop);
    updateFighterWrapper("right", frameToUse, rightShouldRenderOnTop);

    if (shouldShowSameLoadoutIndicators) {
      updateIndicatorWrapper("left", frameToUse);
      updateIndicatorWrapper("right", frameToUse);
    }
  };

  useEffect(() => {
    playbackTimeRef.current = 0;
    lastNowRef.current = null;
    lastTriggeredHitRef.current = null;
    lastDebugLogAtRef.current = 0;
    lastCommitAtRef.current = 0;
    frameCursorRef.current = 0;

    const firstFrame = replay?.frames?.[0] ?? null;
    currentFrameRef.current = firstFrame;
    setDisplayFrame(firstFrame);

    cameraXRef.current = 0;
    cameraYRef.current = 0;
    cameraScaleRef.current = 1;

    if (worldTranslateRef.current) {
      worldTranslateRef.current.style.transform = `translateX(0px) translateY(${worldRenderYOffset}px)`;
    }

    if (worldScaleRef.current) {
      worldScaleRef.current.style.transform = "scale(1)";
    }

    if (bgParallaxRef.current) {
      bgParallaxRef.current.style.transform = `translateX(0px) translateY(0px) scale(${BG_PARALLAX_SCALE})`;
    }

    for (const side of ["left", "right"] as FighterSide[]) {
      const fighterEl = fighterWrapperRefs.current[side];
      if (fighterEl) {
        fighterEl.style.transform = "translate3d(-9999px,-9999px,0)";
        fighterEl.style.zIndex = "1";
      }

      const indicatorEl = indicatorWrapperRefs.current[side];
      if (indicatorEl) {
        indicatorEl.style.transform = "translate3d(-9999px,-9999px,0)";
      }
    }
  }, [replayNonce, replay, worldRenderYOffset]);

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

  useLayoutEffect(() => {
    if (!replay) return;
    const firstFrame = replay.frames?.[0] ?? null;
    applyStaticPlacement(firstFrame);
  }, [
    replay,
    viewportScale,
    renderWidth,
    renderHeight,
    groundedYOffset,
    defeatGroundYOffset,
    shouldShowSameLoadoutIndicators,
    indicatorMetrics.headOffset,
  ]);

  useEffect(() => {
    if (!replay) return;

    if (rafRef.current != null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (!isActive) {
      lastNowRef.current = null;
      const inactiveFrame = currentFrameRef.current ?? replay.frames?.[0] ?? null;
      applyStaticPlacement(inactiveFrame);
      return;
    }

    const commitIntervalMs = 1000 / (isNarrowScreen ? MOBILE_COMMIT_FPS : DESKTOP_COMMIT_FPS);

    const tick = (now: number) => {
      if (!isActive) return;

      if (lastNowRef.current == null) {
        lastNowRef.current = now;
      }

      const rawDelta = now - lastNowRef.current;
      lastNowRef.current = now;

      const deltaMs = Math.min(rawDelta, 50);
      playbackTimeRef.current += deltaMs;

      if (playbackTimeRef.current >= replay.durationMs) {
        playbackTimeRef.current = 0;
        lastTriggeredHitRef.current = null;
        lastDebugLogAtRef.current = 0;
        frameCursorRef.current = 0;
      }

      const frame = getInterpolatedFrameWithCursor(
        replay.frames,
        playbackTimeRef.current,
        frameCursorRef
      );

      currentFrameRef.current = frame;

      if (frame) {
        const leftPxX = toScreenX(frame.fighters.left.x, replay.stageWidth);
        const rightPxX = toScreenX(frame.fighters.right.x, replay.stageWidth);

        const leftPxY = toScreenY(frame.fighters.left.y);
        const rightPxY = toScreenY(frame.fighters.right.y);

        const leftGrounded = frame.fighters.left.y <= CAMERA_GROUNDED_EPSILON;
        const rightGrounded = frame.fighters.right.y <= CAMERA_GROUNDED_EPSILON;
        const someoneGrounded = leftGrounded || rightGrounded;
        const bothAirborne = !someoneGrounded;
        const oneAirborne = leftGrounded !== rightGrounded;

        const fighterDistanceWorld = Math.abs(frame.fighters.left.x - frame.fighters.right.x);

        const closeRangeT = clamp(
          1 - fighterDistanceWorld / CAMERA_CLOSE_RANGE_WORLD_DISTANCE,
          0,
          1
        );

        const baseFighterHalfWidth = 48 * viewportScale;
        const dynamicFighterHalfWidth = lerp(
          baseFighterHalfWidth,
          CAMERA_CLOSE_FIGHTER_HALF_WIDTH_MIN * viewportScale,
          closeRangeT
        );

        const fighterHeight = 96 * viewportScale;

        const fighterMinX = Math.min(leftPxX, rightPxX) - dynamicFighterHalfWidth;
        const fighterMaxX = Math.max(leftPxX, rightPxX) + dynamicFighterHalfWidth;

        const fighterMinY = Math.min(leftPxY, rightPxY) - fighterHeight;
        const fighterMaxY = Math.max(leftPxY, rightPxY);

        const dynamicSidePadding = lerp(
          CAMERA_SIDE_PADDING * viewportScale,
          CAMERA_CLOSE_SIDE_PADDING_MIN * viewportScale,
          closeRangeT
        );

        let framedMinX = fighterMinX - dynamicSidePadding;
        let framedMaxX = fighterMaxX + dynamicSidePadding;

        const leftDistToEdge = fighterMinX;
        const rightDistToEdge = stageWidthPx - fighterMaxX;

        let leftEdgeExtra = 0;
        let rightEdgeExtra = 0;

        if (leftDistToEdge < CAMERA_EDGE_SOFT_ZONE * viewportScale) {
          const t = 1 - leftDistToEdge / (CAMERA_EDGE_SOFT_ZONE * viewportScale);
          leftEdgeExtra = CAMERA_EDGE_PADDING * viewportScale * t;
          framedMinX -= leftEdgeExtra;
        }

        if (rightDistToEdge < CAMERA_EDGE_SOFT_ZONE * viewportScale) {
          const t = 1 - rightDistToEdge / (CAMERA_EDGE_SOFT_ZONE * viewportScale);
          rightEdgeExtra = CAMERA_EDGE_PADDING * viewportScale * t;
          framedMaxX += rightEdgeExtra;
        }

        const framedMinY = fighterMinY - CAMERA_TOP_PADDING * viewportScale;

        const airBiasMaxY = fighterMaxY + CAMERA_AIR_BOTTOM_PADDING * viewportScale;
        const groundBiasMaxY = groundScreenY + CAMERA_BOTTOM_PADDING * viewportScale;
        const oneAirborneMaxY = Math.max(
          fighterMaxY + CAMERA_ONE_AIRBORNE_BOTTOM_PADDING * viewportScale,
          lerp(airBiasMaxY, groundBiasMaxY, 0.55)
        );

        const framedMaxY = bothAirborne
          ? airBiasMaxY
          : oneAirborne
            ? oneAirborneMaxY
            : Math.max(airBiasMaxY, groundBiasMaxY);

        const framedWidth = Math.max(220 * viewportScale, framedMaxX - framedMinX);
        const framedHeight = Math.max(160 * viewportScale, framedMaxY - framedMinY);

        const widthScaleCandidate = stageWidthPx / framedWidth;
        const heightScaleCandidate = stageHeightPx / framedHeight;

        const rawTargetScaleBase = Math.min(widthScaleCandidate, heightScaleCandidate);
        const rawTargetScale =
          rawTargetScaleBase * lerp(1, CAMERA_CLOSE_ZOOM_BONUS, closeRangeT);

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
          cameraYRef.current + (targetCameraY - cameraYRef.current) * CAMERA_VERTICAL_LERP;

        const nextCameraScale =
          cameraScaleRef.current + (targetScale - cameraScaleRef.current) * CAMERA_LERP;

        cameraXRef.current = nextCameraX;
        cameraYRef.current = nextCameraY;
        cameraScaleRef.current = nextCameraScale;

        if (worldTranslateRef.current) {
          worldTranslateRef.current.style.transform = `translateX(${nextCameraX}px) translateY(${nextCameraY + worldRenderYOffset}px)`;
        }

        if (worldScaleRef.current) {
          worldScaleRef.current.style.transform = `scale(${nextCameraScale})`;
        }

        if (bgParallaxRef.current) {
          const backgroundParallaxX = -nextCameraX * BG_PARALLAX_X;
          const backgroundParallaxY = -nextCameraY * BG_PARALLAX_Y;
          bgParallaxRef.current.style.transform = `translateX(${backgroundParallaxX}px) translateY(${backgroundParallaxY}px) scale(${BG_PARALLAX_SCALE})`;
        }

        applyStaticPlacement(frame);

        if (DEBUG_CAMERA) {
          const debugNow = performance.now();
          if (debugNow - lastDebugLogAtRef.current >= DEBUG_CAMERA_LOG_INTERVAL_MS) {
            lastDebugLogAtRef.current = debugNow;

            console.log("[McBattleReplayStage camera]", {
              timeMs: round2(playbackTimeRef.current),
              viewportScale: round2(viewportScale),
              nextCameraX: round2(nextCameraX),
              nextCameraY: round2(nextCameraY),
              nextCameraScale: round2(nextCameraScale),
            });
          }
        }
      }

      const hit = replay.hitEvents.find(
        (item) =>
          playbackTimeRef.current >= item.t && playbackTimeRef.current < item.t + FRAME_MS
      );

      if (hit && lastTriggeredHitRef.current !== hit.t) {
        lastTriggeredHitRef.current = hit.t;
      }

      const nextFrame = currentFrameRef.current;
      if (nextFrame && now - lastCommitAtRef.current >= commitIntervalMs) {
        lastCommitAtRef.current = now;
        setDisplayFrame(nextFrame);
      }

      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [
    replay,
    isActive,
    replayNonce,
    viewportScale,
    stageWidthPx,
    stageHeightPx,
    groundScreenY,
    cameraMinScaleBase,
    worldRenderYOffset,
    isNarrowScreen,
    renderWidth,
    renderHeight,
    groundedYOffset,
    defeatGroundYOffset,
    shouldShowSameLoadoutIndicators,
    indicatorMetrics.headOffset,
  ]);

  const frame = displayFrame;

  const leftFighter = frame?.fighters?.left;
  const rightFighter = frame?.fighters?.right;

  const leftCurrentHp = leftFighter?.hp ?? 0;
  const rightCurrentHp = rightFighter?.hp ?? 0;

  const leftMaxHp = Math.max(1, battle.challenger_snapshot?.combat_stats?.hp ?? 1);
  const rightMaxHp = Math.max(1, battle.defender_snapshot?.combat_stats?.hp ?? 1);

  const leftHpPercent = Math.max(0, Math.min(100, (leftCurrentHp / leftMaxHp) * 100));
  const rightHpPercent = Math.max(0, Math.min(100, (rightCurrentHp / rightMaxHp) * 100));

  const challengerName = battle.challenger_snapshot?.username ?? "Challenger";
  const defenderName = battle.defender_snapshot?.username ?? "Defender";

  if (!replay) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70">
        Replay missing.
      </div>
    );
  }

  const leftAction = frame?.fighters.left.action ?? "idle";
  const rightAction = frame?.fighters.right.action ?? "idle";

  const leftLocalYOffset =
    leftAction === "defeat_ground" ? defeatGroundYOffset : groundedYOffset;
  const rightLocalYOffset =
    rightAction === "defeat_ground" ? defeatGroundYOffset : groundedYOffset;

  const localScreenX = Math.round(renderWidth / 2);
  const leftLocalScreenY = Math.round(renderHeight - leftLocalYOffset);
  const rightLocalScreenY = Math.round(renderHeight - rightLocalYOffset);

  return (
    <div
      ref={stageViewportRef}
      className="relative mx-auto block min-w-0 max-w-full w-full overflow-hidden rounded-xs bg-[#0f0f0f]"
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
            ref={bgParallaxRef}
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
              transform: `translateX(0px) translateY(0px) scale(${BG_PARALLAX_SCALE})`,
              transformOrigin: "center center",
              willChange: "transform",
            }}
          />
        </div>

        <div
          ref={worldTranslateRef}
          className="absolute inset-0"
          style={{
            transform: `translateX(0px) translateY(${worldRenderYOffset}px)`,
            willChange: "transform",
          }}
        >
          <div
            ref={worldScaleRef}
            className="absolute inset-0"
            style={{
              transform: "scale(1)",
              transformOrigin: "center center",
              willChange: "transform",
            }}
          >
            <div
              className="absolute left-0 right-0 pointer-events-none"
              style={{
                bottom: PLATFORM_BOTTOM_PX * viewportScale,
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
                bottom: FLOOR_LINE_BOTTOM_PX * viewportScale,
                height: Math.max(1, 2 * viewportScale),
              }}
            />

            <div
              ref={(node) => {
                fighterWrapperRefs.current.left = node;
              }}
              className="absolute left-0 top-0 pointer-events-none"
              style={{
                width: renderWidth,
                height: renderHeight,
                transform: "translate3d(-9999px,-9999px,0)",
                willChange: "transform",
              }}
            >
              <ScreenSpriteFighter
                screenX={localScreenX}
                screenY={leftLocalScreenY}
                facing={frame?.fighters.left.facing ?? "right"}
                action={leftAction}
                layers={leftLayers}
                sourceFrameWidth={768}
                sourceFrameHeight={1024}
                renderWidth={renderWidth}
                renderHeight={renderHeight}
                yOffset={leftLocalYOffset}
                flash={false}
                isActive={isActive}
              />
            </div>

            <div
              ref={(node) => {
                fighterWrapperRefs.current.right = node;
              }}
              className="absolute left-0 top-0 pointer-events-none"
              style={{
                width: renderWidth,
                height: renderHeight,
                transform: "translate3d(-9999px,-9999px,0)",
                willChange: "transform",
              }}
            >
              <ScreenSpriteFighter
                screenX={localScreenX}
                screenY={rightLocalScreenY}
                facing={frame?.fighters.right.facing ?? "left"}
                action={rightAction}
                layers={rightLayers}
                sourceFrameWidth={768}
                sourceFrameHeight={1024}
                renderWidth={renderWidth}
                renderHeight={renderHeight}
                yOffset={rightLocalYOffset}
                flash={false}
                isActive={isActive}
              />
            </div>

            {shouldShowSameLoadoutIndicators ? (
              <McBattleFighterIndicators
                deviceType={indicatorDeviceType}
                left={{
                  avatarUrl: avatars.left,
                  username: challengerName,
                  align: "left",
                }}
                right={{
                  avatarUrl: avatars.right,
                  username: defenderName,
                  align: "right",
                }}
                leftWrapperRef={(node) => {
                  indicatorWrapperRefs.current.left = node;
                }}
                rightWrapperRef={(node) => {
                  indicatorWrapperRefs.current.right = node;
                }}
              />
            ) : null}
          </div>
        </div>

        <McBattleHud
          left={{
            username: challengerName,
            avatarUrl: avatars.left,
            currentHp: leftCurrentHp,
            maxHp: leftMaxHp,
            hpPercent: leftHpPercent,
          }}
          right={{
            username: defenderName,
            avatarUrl: avatars.right,
            currentHp: rightCurrentHp,
            maxHp: rightMaxHp,
            hpPercent: rightHpPercent,
          }}
        />
      </div>
    </div>
  );
}