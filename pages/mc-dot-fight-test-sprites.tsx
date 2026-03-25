"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ScreenSpriteFighter from "@/components/mc/ScreenSpriteFighter";
import type { DotReplayFrame, McDotReplay } from "@/lib/dot/mcDotReplayTypes";
import { supabase } from "@/lib/supabaseClient";

const BASE_STAGE_HEIGHT_PX = 320;
const BASE_STAGE_WIDTH_PX = 920;
const FRAME_MS = 1000 / 60;

const CAMERA_MIN_SCALE_DESKTOP = 0.68;
const CAMERA_MIN_SCALE_MOBILE = 0.42;
const CAMERA_MAX_SCALE = 1.18;
const CAMERA_LERP = 0.14;
const CAMERA_VERTICAL_LERP = 0.12;

const HITSTOP_MS = 70;
const HIT_ZOOM_BOOST = 0.08;
const HIT_SHAKE_X = 14;
const HIT_SHAKE_Y = 8;
const HIT_SHAKE_DECAY_MS = 180;

const CAMERA_EDGE_PADDING = 140;
const CAMERA_EDGE_SOFT_ZONE = 220;

const CAMERA_SIDE_PADDING = 120;
const CAMERA_TOP_PADDING = 80;
const CAMERA_BOTTOM_PADDING = 74;
const CAMERA_AIR_BOTTOM_PADDING = 26;

const CAMERA_GROUNDED_EPSILON = 0.06;

const BG_PARALLAX_X = 0.18;
const BG_PARALLAX_Y = 0.08;
const BG_PARALLAX_SCALE = 1.08;

const FIGHTER_LEFT = {
    idle: { src: "/mc/sprites/a/idle.png", frames: 5, fps: 8, loop: true },
    run: { src: "/mc/sprites/a/run.png", frames: 5, fps: 12, loop: true },
    jump: { src: "/mc/sprites/a/jump.png", frames: 5, fps: 10, loop: true },
    attack: { src: "/mc/sprites/a/attack.png", frames: 5, fps: 14, loop: true },
    hit: { src: "/mc/sprites/a/hit.png", frames: 5, fps: 12, loop: false },
    recover: { src: "/mc/sprites/a/recover.png", frames: 5, fps: 10, loop: true },
    defeat_fall: { src: "/mc/sprites/a/defeat_fall.png", frames: 5, fps: 10, loop: false },
    defeat_ground: { src: "/mc/sprites/a/defeat_ground.png", frames: 1, fps: 1, loop: false },
};

const FIGHTER_RIGHT = {
    idle: { src: "/mc/sprites/b/idle.png", frames: 5, fps: 8, loop: true },
    run: { src: "/mc/sprites/b/run.png", frames: 5, fps: 12, loop: true },
    jump: { src: "/mc/sprites/b/jump.png", frames: 5, fps: 10, loop: true },
    attack: { src: "/mc/sprites/b/attack.png", frames: 5, fps: 14, loop: true },
    hit: { src: "/mc/sprites/b/hit.png", frames: 5, fps: 12, loop: false },
    recover: { src: "/mc/sprites/b/recover.png", frames: 5, fps: 10, loop: true },
    defeat_fall: { src: "/mc/sprites/b/defeat_fall.png", frames: 5, fps: 10, loop: false },
    defeat_ground: { src: "/mc/sprites/b/defeat_ground.png", frames: 1, fps: 1, loop: false },
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

export default function McDotFightTestPage() {
    const [battleRow, setBattleRow] = useState<any | null>(null);
    const [replay, setReplay] = useState<McDotReplay | null>(null);
    const [timeMs, setTimeMs] = useState(0);
    const [cameraX, setCameraX] = useState(0);
    const [cameraY, setCameraY] = useState(0);
    const [cameraScale, setCameraScale] = useState(1);

    const [impactZoom, setImpactZoom] = useState(0);
    const [shakeX, setShakeX] = useState(0);
    const [shakeY, setShakeY] = useState(0);
    const [playbackKey, setPlaybackKey] = useState(0);

    const [viewportScale, setViewportScale] = useState(1);

    const rafRef = useRef<number | null>(null);
    const cameraXRef = useRef(0);
    const cameraYRef = useRef(0);
    const cameraScaleRef = useRef(1);
    const playbackTimeRef = useRef(0);
    const lastNowRef = useRef<number | null>(null);
    const stageViewportRef = useRef<HTMLDivElement | null>(null);

    const hitStopUntilRef = useRef(0);
    const lastTriggeredHitRef = useRef<number | null>(null);

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

    const buildReplay = async () => {
        const { data, error } = await supabase
            .from("mc_battles")
            .select(`
                id,
                challenger_user_id,
                defender_user_id,
                winner_user_id,
                battle_result,
                replay_data
            `)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (error || !data) {
            setBattleRow(null);
            setReplay(null);
            return;
        }

        setBattleRow(data);
        setReplay(data.replay_data?.dot_replay ?? null);

        const nextReplay = data.replay_data?.dot_replay;
        if (!nextReplay) return;

        setTimeMs(0);
        cameraXRef.current = 0;
        cameraYRef.current = 0;
        cameraScaleRef.current = 1;

        hitStopUntilRef.current = 0;
        lastTriggeredHitRef.current = null;
        playbackTimeRef.current = 0;
        lastNowRef.current = null;

        setCameraX(0);
        setCameraY(0);
        setCameraScale(1);
        setImpactZoom(0);
        setShakeX(0);
        setShakeY(0);
    };

    useEffect(() => {
        buildReplay();
    }, []);

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
            const hitStopActive = now < hitStopUntilRef.current;

            if (!hitStopActive) {
                playbackTimeRef.current = Math.min(
                    playbackTimeRef.current + deltaMs,
                    replay.durationMs
                );
            }

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

    useEffect(() => {
        if (!replay) return;

        const hit = replay.hitEvents.find(
            (item) => timeMs >= item.t && timeMs < item.t + FRAME_MS
        );

        if (!hit) return;
        if (lastTriggeredHitRef.current === hit.t) return;

        lastTriggeredHitRef.current = hit.t;
        hitStopUntilRef.current = performance.now() + HITSTOP_MS;

        setImpactZoom(HIT_ZOOM_BOOST);

        const dir = hit.defender === "left" ? -1 : 1;
        setShakeX(dir * HIT_SHAKE_X * viewportScale);
        setShakeY(-HIT_SHAKE_Y * viewportScale);
    }, [replay, timeMs, viewportScale]);

    useEffect(() => {
        if (!replay) return;

        let rafId: number | null = null;
        let start: number | null = null;

        const tick = (now: number) => {
            if (start == null) start = now;
            const elapsed = now - start;
            const t = Math.min(elapsed / HIT_SHAKE_DECAY_MS, 1);

            const decay = 1 - t;

            setImpactZoom((prev) => {
                const next = prev * 0.78;
                return next < 0.001 ? 0 : next;
            });

            setShakeX((prev) => {
                const jitter = (Math.random() * 2 - 1) * 2.5 * viewportScale;
                const next = prev * 0.72 + jitter * decay;
                return Math.abs(next) < 0.4 ? 0 : next;
            });

            setShakeY((prev) => {
                const jitter = (Math.random() * 2 - 1) * 1.8 * viewportScale;
                const next = prev * 0.72 + jitter * decay;
                return Math.abs(next) < 0.4 ? 0 : next;
            });

            if (
                decay > 0.01 ||
                Math.abs(shakeX) > 0.4 ||
                Math.abs(shakeY) > 0.4 ||
                impactZoom > 0.001
            ) {
                rafId = window.requestAnimationFrame(tick);
            }
        };

        if (impactZoom > 0 || shakeX !== 0 || shakeY !== 0) {
            rafId = window.requestAnimationFrame(tick);
        }

        return () => {
            if (rafId != null) {
                window.cancelAnimationFrame(rafId);
            }
        };
    }, [impactZoom, shakeX, shakeY, replay, viewportScale]);

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

        // Use original file camera proxy box, scaled
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

        // Edge-aware minimum zoom only when airborne near a side
        const edgeDistance = Math.min(leftDistToEdge, rightDistToEdge);
        const edgeT = clamp(
            1 - edgeDistance / (CAMERA_EDGE_SOFT_ZONE * viewportScale),
            0,
            1
        );

        const airborneEdgeMinScale =
            someoneGrounded
                ? cameraMinScaleBase
                : lerp(cameraMinScaleBase, Math.min(0.92, CAMERA_MAX_SCALE), edgeT * 0.9);

        const cameraMinScale = airborneEdgeMinScale;

        const targetScale = clamp(
            rawTargetScale,
            cameraMinScale,
            CAMERA_MAX_SCALE
        );

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

    const backgroundParallaxX = -(cameraTranslateX + shakeX) * BG_PARALLAX_X;
    const backgroundParallaxY = -(cameraTranslateY + shakeY) * BG_PARALLAX_Y;

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white">
            <div className="mx-auto max-w-6xl">
                <div className="flex flex-wrap items-center gap-3 py-4">
                    <button
                        type="button"
                        onClick={buildReplay}
                        className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
                    >
                        Load Latest Battle
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            playbackTimeRef.current = 0;
                            lastNowRef.current = null;
                            hitStopUntilRef.current = 0;
                            lastTriggeredHitRef.current = null;

                            setTimeMs(0);
                            setImpactZoom(0);
                            setShakeX(0);
                            setShakeY(0);

                            cameraXRef.current = 0;
                            cameraYRef.current = 0;
                            cameraScaleRef.current = 1;

                            setCameraX(0);
                            setCameraY(0);
                            setCameraScale(1);

                            setPlaybackKey((prev) => prev + 1);
                        }}
                        className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
                    >
                        Replay
                    </button>

                    {replay && (
                        <>
                            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                                Winner: <span className="font-semibold">{replay.winner}</span>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                                Duration: <span className="font-semibold">{replay.durationMs} ms</span>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                                Time: <span className="font-semibold">{Math.round(timeMs)} ms</span>
                            </div>
                        </>
                    )}
                </div>

                {battleRow && (
                    <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/80">
                        <div className="mb-2 text-sm font-medium text-white">Loaded Battle Row</div>

                        <div>Battle ID: {battleRow.id}</div>
                        <div>Challenger: {battleRow.challenger_user_id}</div>
                        <div>Defender: {battleRow.defender_user_id}</div>
                        <div>Winner User ID: {battleRow.winner_user_id}</div>

                        <div className="mt-3 text-sm font-medium text-white">Battle Result</div>
                        <pre className="mt-1 overflow-auto rounded-lg border border-white/10 bg-black/20 p-3 text-[11px]">
                            {JSON.stringify(battleRow.battle_result, null, 2)}
                        </pre>

                        <div className="mt-3 text-sm font-medium text-white">Replay Data Summary</div>
                        <div>Replay Kind: {battleRow.replay_data?.replay_kind ?? "missing"}</div>
                        <div>Left Side: {battleRow.replay_data?.fighter_side_map?.left ?? "missing"}</div>
                        <div>Right Side: {battleRow.replay_data?.fighter_side_map?.right ?? "missing"}</div>
                        <div>
                            Frame Count: {battleRow.replay_data?.dot_replay?.frames?.length ?? 0}
                        </div>
                        <div>
                            Hit Event Count: {battleRow.replay_data?.dot_replay?.hitEvents?.length ?? 0}
                        </div>
                        <div>
                            Event Count: {battleRow.replay_data?.dot_replay?.events?.length ?? 0}
                        </div>
                    </div>
                )}

                {replay && frame ? (
                    <>
                        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className="mb-2 text-sm font-medium">Left Fighter</div>
                                <div className="mb-2 h-3 overflow-hidden rounded-full bg-white/10">
                                    <div
                                        className="h-full bg-red-500"
                                        style={{ width: `${frame.fighters.left.hp}%` }}
                                    />
                                </div>
                                <div className="text-xs text-white/70">
                                    HP {frame.fighters.left.hp} • x {frame.fighters.left.x.toFixed(2)} • y{" "}
                                    {frame.fighters.left.y.toFixed(2)} • {frame.fighters.left.action}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className="mb-2 text-sm font-medium">Right Fighter</div>
                                <div className="mb-2 h-3 overflow-hidden rounded-full bg-white/10">
                                    <div
                                        className="h-full bg-blue-500"
                                        style={{ width: `${frame.fighters.right.hp}%` }}
                                    />
                                </div>
                                <div className="text-xs text-white/70">
                                    HP {frame.fighters.right.hp} • x {frame.fighters.right.x.toFixed(2)} • y{" "}
                                    {frame.fighters.right.y.toFixed(2)} • {frame.fighters.right.action}
                                </div>
                            </div>
                        </div>

                        <div
                            ref={stageViewportRef}
                            className="relative mx-auto w-full overflow-hidden bg-[#0f0f0f]"
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
                                            left: "-4%",
                                            top: "-4%",
                                            width: "108%",
                                            height: "108%",
                                            backgroundImage: 'url("/mc/backgrounds/arena-bg.png")',
                                            backgroundSize: "100% 100%",
                                            backgroundPosition: "center",
                                            backgroundRepeat: "no-repeat",
                                            transform: `translateX(${backgroundParallaxX}px) translateY(${backgroundParallaxY}px) scale(${BG_PARALLAX_SCALE})`,
                                            transformOrigin: "center center",
                                            transition: "transform 50ms linear",
                                        }}
                                    />
                                </div>

                                <div
                                    className="absolute inset-0"
                                    style={{
                                        transform: `translateX(${cameraTranslateX + shakeX}px) translateY(${cameraTranslateY + shakeY}px)`,
                                        transition: "transform 50ms linear",
                                    }}
                                >
                                    <div
                                        className="absolute inset-0"
                                        style={{
                                            transform: `scale(${cameraScale + impactZoom})`,
                                            transformOrigin: "center center",
                                            transition: "transform 50ms linear",
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

                                        <div
                                            className="absolute rounded-full bg-white/5"
                                            style={{
                                                left: "10%",
                                                top: "18%",
                                                width: 96 * viewportScale,
                                                height: 96 * viewportScale,
                                                filter: `blur(${40 * viewportScale}px)`,
                                            }}
                                        />

                                        <div
                                            className="absolute rounded-full bg-white/5"
                                            style={{
                                                right: "12%",
                                                top: "16%",
                                                width: 80 * viewportScale,
                                                height: 80 * viewportScale,
                                                filter: `blur(${40 * viewportScale}px)`,
                                            }}
                                        />

                                        {!leftShouldRenderOnTop && (
                                            <ScreenSpriteFighter
                                                screenX={toScreenX(frame.fighters.left.x, replay.stageWidth)}
                                                screenY={toScreenY(frame.fighters.left.y)}
                                                facing={frame.fighters.left.facing}
                                                action={frame.fighters.left.action}
                                                spriteSet={FIGHTER_LEFT}
                                                sourceFrameWidth={768}
                                                sourceFrameHeight={1024}
                                                renderWidth={renderWidth}
                                                renderHeight={renderHeight}
                                                yOffset={
                                                    frame.fighters.left.action === "defeat_ground"
                                                        ? defeatGroundYOffset
                                                        : groundedYOffset
                                                }
                                                flash={false}
                                            />
                                        )}

                                        {!rightShouldRenderOnTop && (
                                            <ScreenSpriteFighter
                                                screenX={toScreenX(frame.fighters.right.x, replay.stageWidth)}
                                                screenY={toScreenY(frame.fighters.right.y)}
                                                facing={frame.fighters.right.facing}
                                                action={frame.fighters.right.action}
                                                spriteSet={FIGHTER_RIGHT}
                                                sourceFrameWidth={768}
                                                sourceFrameHeight={1024}
                                                renderWidth={renderWidth}
                                                renderHeight={renderHeight}
                                                yOffset={
                                                    frame.fighters.right.action === "defeat_ground"
                                                        ? defeatGroundYOffset
                                                        : groundedYOffset
                                                }
                                                flash={false}
                                            />
                                        )}

                                        {leftShouldRenderOnTop && (
                                            <ScreenSpriteFighter
                                                screenX={toScreenX(frame.fighters.left.x, replay.stageWidth)}
                                                screenY={toScreenY(frame.fighters.left.y)}
                                                facing={frame.fighters.left.facing}
                                                action={frame.fighters.left.action}
                                                spriteSet={FIGHTER_LEFT}
                                                sourceFrameWidth={768}
                                                sourceFrameHeight={1024}
                                                renderWidth={renderWidth}
                                                renderHeight={renderHeight}
                                                yOffset={
                                                    frame.fighters.left.action === "defeat_ground"
                                                        ? defeatGroundYOffset
                                                        : groundedYOffset
                                                }
                                                flash={false}
                                            />
                                        )}

                                        {rightShouldRenderOnTop && (
                                            <ScreenSpriteFighter
                                                screenX={toScreenX(frame.fighters.right.x, replay.stageWidth)}
                                                screenY={toScreenY(frame.fighters.right.y)}
                                                facing={frame.fighters.right.facing}
                                                action={frame.fighters.right.action}
                                                spriteSet={FIGHTER_RIGHT}
                                                sourceFrameWidth={768}
                                                sourceFrameHeight={1024}
                                                renderWidth={renderWidth}
                                                renderHeight={renderHeight}
                                                yOffset={
                                                    frame.fighters.right.action === "defeat_ground"
                                                        ? defeatGroundYOffset
                                                        : groundedYOffset
                                                }
                                                flash={false}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className="mb-3 text-sm font-medium">Replay Events</div>
                            <div className="max-h-[260px] overflow-auto space-y-2 text-xs text-white/75">
                                {replay.events.map((event, index) => (
                                    <div
                                        key={`${event.type}-${index}`}
                                        className="rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                                    >
                                        {JSON.stringify(event)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="py-10 text-white/70">Loading replay...</div>
                )}
            </div>
        </div>
    );
}