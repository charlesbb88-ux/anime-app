"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { generateMcDotReplay } from "@/lib/dot/generateMcDotReplay";
import type { DotReplayFrame, FighterSide, McDotReplay } from "@/lib/dot/mcDotReplayTypes";

const STAGE_HEIGHT_PX = 320;
const STAGE_WIDTH_PX = 920;
const DOT_SIZE = 30;
const FRAME_MS = 1000 / 60;

const CAMERA_MIN_SCALE = 0.68;
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
const GROUND_SCREEN_Y = STAGE_HEIGHT_PX - 46;

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

function toScreenX(x: number, stageWidth: number) {
    const normalized = (x + stageWidth / 2) / stageWidth;
    return normalized * STAGE_WIDTH_PX;
}

function toScreenY(y: number) {
    const ground = STAGE_HEIGHT_PX - 46;
    return ground - y * 90;
}

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function Dot({
    side,
    x,
    y,
    action,
    facing,
    flash,
}: {
    side: FighterSide;
    x: number;
    y: number;
    action: string;
    facing: "left" | "right";
    flash: boolean;
}) {
    const screenX = toScreenX(x, 14);
    const screenY = toScreenY(y);

    const scale =
        action === "attack"
            ? 1.18
            : action === "hit"
                ? 0.82
                : action === "jump"
                    ? 1.08
                    : 1;

    return (
        <div
            className="absolute"
            style={{
                left: screenX - DOT_SIZE / 2,
                top: screenY - DOT_SIZE / 2,
                width: DOT_SIZE,
                height: DOT_SIZE,
                transform: `scale(${scale})`,
                transition: "transform 60ms linear",
            }}
        >
            <div
                className={`relative h-full w-full rounded-full border-2 ${
                    side === "left" ? "bg-red-500 border-red-200" : "bg-blue-500 border-blue-200"
                } ${flash ? "ring-4 ring-white/80" : ""}`}
            >
                <div
                    className="absolute top-1/2 h-[2px] w-4 bg-white"
                    style={{
                        left: facing === "right" ? "100%" : undefined,
                        right: facing === "left" ? "100%" : undefined,
                        transform: "translateY(-50%)",
                        opacity: 0.8,
                    }}
                />
            </div>

            <div className="pointer-events-none absolute left-1/2 top-[-24px] -translate-x-1/2 whitespace-nowrap text-[11px] font-medium text-white">
                {action}
            </div>
        </div>
    );
}

export default function McDotFightTestPage() {
    const [replay, setReplay] = useState<McDotReplay | null>(null);
    const [timeMs, setTimeMs] = useState(0);
    const [cameraX, setCameraX] = useState(0);
    const [cameraY, setCameraY] = useState(0);
    const [cameraScale, setCameraScale] = useState(1);

    const [impactZoom, setImpactZoom] = useState(0);
    const [shakeX, setShakeX] = useState(0);
    const [shakeY, setShakeY] = useState(0);
    const [playbackKey, setPlaybackKey] = useState(0);

    const rafRef = useRef<number | null>(null);
    const cameraXRef = useRef(0);
    const cameraYRef = useRef(0);
    const cameraScaleRef = useRef(1);
    const playbackTimeRef = useRef(0);
    const lastNowRef = useRef<number | null>(null);

    const hitStopUntilRef = useRef(0);
    const lastTriggeredHitRef = useRef<number | null>(null);

    const buildReplay = () => {
        const nextReplay = generateMcDotReplay();
        setReplay(nextReplay);
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

    const recentHit = useMemo(() => {
        if (!replay) return undefined;
        return replay.hitEvents.find((hit) => Math.abs(hit.t - timeMs) < 90);
    }, [replay, timeMs]);

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
        setShakeX(dir * HIT_SHAKE_X);
        setShakeY(-HIT_SHAKE_Y);
    }, [replay, timeMs]);

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
                const jitter = (Math.random() * 2 - 1) * 2.5;
                const next = prev * 0.72 + jitter * decay;
                return Math.abs(next) < 0.4 ? 0 : next;
            });

            setShakeY((prev) => {
                const jitter = (Math.random() * 2 - 1) * 1.8;
                const next = prev * 0.72 + jitter * decay;
                return Math.abs(next) < 0.4 ? 0 : next;
            });

            if (decay > 0.01 || Math.abs(shakeX) > 0.4 || Math.abs(shakeY) > 0.4 || impactZoom > 0.001) {
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
    }, [impactZoom, shakeX, shakeY, replay]);

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

        const fighterMinX = Math.min(leftPxX, rightPxX) - DOT_SIZE / 2;
        const fighterMaxX = Math.max(leftPxX, rightPxX) + DOT_SIZE / 2;

        const fighterMinY = Math.min(leftPxY, rightPxY) - DOT_SIZE / 2;
        const fighterMaxY = Math.max(leftPxY, rightPxY) + DOT_SIZE / 2;

        let framedMinX = fighterMinX - CAMERA_SIDE_PADDING;
        let framedMaxX = fighterMaxX + CAMERA_SIDE_PADDING;

        const leftDistToEdge = fighterMinX;
        const rightDistToEdge = STAGE_WIDTH_PX - fighterMaxX;

        if (leftDistToEdge < CAMERA_EDGE_SOFT_ZONE) {
            const t = 1 - leftDistToEdge / CAMERA_EDGE_SOFT_ZONE;
            framedMinX -= CAMERA_EDGE_PADDING * t;
        }

        if (rightDistToEdge < CAMERA_EDGE_SOFT_ZONE) {
            const t = 1 - rightDistToEdge / CAMERA_EDGE_SOFT_ZONE;
            framedMaxX += CAMERA_EDGE_PADDING * t;
        }

        const framedMinY = fighterMinY - CAMERA_TOP_PADDING;

        const framedMaxY = bothAirborne
            ? fighterMaxY + CAMERA_AIR_BOTTOM_PADDING
            : Math.max(fighterMaxY + CAMERA_AIR_BOTTOM_PADDING, GROUND_SCREEN_Y + CAMERA_BOTTOM_PADDING);

        const framedWidth = Math.max(220, framedMaxX - framedMinX);
        const framedHeight = Math.max(160, framedMaxY - framedMinY);

        const targetScale = clamp(
            Math.min(STAGE_WIDTH_PX / framedWidth, STAGE_HEIGHT_PX / framedHeight),
            CAMERA_MIN_SCALE,
            CAMERA_MAX_SCALE
        );

        const frameCenterX = (framedMinX + framedMaxX) / 2;
        const frameCenterY = (framedMinY + framedMaxY) / 2;

        const stageCenterX = STAGE_WIDTH_PX / 2;
        const stageCenterY = STAGE_HEIGHT_PX / 2;

        const targetCameraX = stageCenterX - frameCenterX;
        const targetCameraY = stageCenterY - frameCenterY;

        const nextCameraX =
            cameraXRef.current + (targetCameraX - cameraXRef.current) * CAMERA_LERP;

        const nextCameraY =
            cameraYRef.current + (targetCameraY - cameraYRef.current) * CAMERA_VERTICAL_LERP;

        const nextCameraScale =
            cameraScaleRef.current +
            (targetScale - cameraScaleRef.current) * CAMERA_LERP;

        cameraXRef.current = nextCameraX;
        cameraYRef.current = nextCameraY;
        cameraScaleRef.current = nextCameraScale;

        setCameraX(nextCameraX);
        setCameraY(nextCameraY);
        setCameraScale(nextCameraScale);
    }, [frame, replay]);

    const cameraTranslateX = cameraX;
    const cameraTranslateY = cameraY;

    const leftFlash = recentHit?.defender === "left";
    const rightFlash = recentHit?.defender === "right";

    if (!replay || !frame) {
        return <div className="min-h-screen bg-[#0a0a0a] p-6 text-white">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] p-6 text-white">
            <div className="mx-auto max-w-6xl">
                <div className="mb-5 flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={buildReplay}
                        className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
                    >
                        Generate New Fight
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

                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                        Winner: <span className="font-semibold">{replay.winner}</span>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                        Duration: <span className="font-semibold">{replay.durationMs} ms</span>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                        Time: <span className="font-semibold">{Math.round(timeMs)} ms</span>
                    </div>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-4">
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

                <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#151515] to-[#090909] p-6">
                    <div
                        className="relative mx-auto overflow-hidden rounded-2xl border border-white/10 bg-[#0f0f0f]"
                        style={{
                            width: STAGE_WIDTH_PX,
                            height: STAGE_HEIGHT_PX,
                            maxWidth: "100%",
                        }}
                    >
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
                                <div className="absolute inset-x-0 bottom-[44px] h-[2px] bg-white/20" />

                                <div className="absolute left-[10%] top-[18%] h-24 w-24 rounded-full bg-white/5 blur-2xl" />
                                <div className="absolute right-[12%] top-[16%] h-20 w-20 rounded-full bg-white/5 blur-2xl" />

                                <Dot
                                    side="left"
                                    x={frame.fighters.left.x}
                                    y={frame.fighters.left.y}
                                    action={frame.fighters.left.action}
                                    facing={frame.fighters.left.facing}
                                    flash={!!leftFlash}
                                />

                                <Dot
                                    side="right"
                                    x={frame.fighters.right.x}
                                    y={frame.fighters.right.y}
                                    action={frame.fighters.right.action}
                                    facing={frame.fighters.right.facing}
                                    flash={!!rightFlash}
                                />
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
            </div>
        </div>
    );
}