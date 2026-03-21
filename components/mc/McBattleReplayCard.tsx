"use client";

import { useEffect, useMemo, useState } from "react";
import McBattleFighterSprite from "@/components/mc/McBattleFighterSprite";
import type { CharacterAvatarLayer, ShapeData } from "@/components/mc/avatarTypes";
import type { McBattleReplayData } from "@/lib/mcBattleReplayTypes";
import type { McBattleFighterSnapshot } from "@/lib/mcBattleTypes";

type Props = {
    challengerSnapshot: McBattleFighterSnapshot;
    defenderSnapshot: McBattleFighterSnapshot;
    replayData: McBattleReplayData;
    autoPlay?: boolean;
    stepIntervalMs?: number;
};

type BattleSideState = {
    name: string;
    title: string;
    maxHp: number;
    currentHp: number;
};

function safeNumber(value: unknown, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function clampPercent(value: number) {
    if (!Number.isFinite(value)) return 0;
    if (value < 0) return 0;
    if (value > 100) return 100;
    return value;
}

function toCharacterAvatarLayers(
    layers: McBattleFighterSnapshot["avatar"]["layers"]
): CharacterAvatarLayer[] {
    return layers.map((layer) => ({
        asset_id: layer.asset_id,
        asset_key: layer.asset_key,
        slot_key: layer.slot_key,
        asset_kind: layer.asset_kind,
        image_url: layer.image_url,
        shape_data: (layer.shape_data ?? null) as ShapeData | null,
        layer_order: layer.layer_order,
    }));
}

export default function McBattleReplayCard({
    challengerSnapshot,
    defenderSnapshot,
    replayData,
    autoPlay = true,
    stepIntervalMs = 700,
}: Props) {
    const initialChallengerHp = safeNumber(challengerSnapshot.combat_stats.hp, 0);
    const initialDefenderHp = safeNumber(defenderSnapshot.combat_stats.hp, 0);

    const [currentStepIndex, setCurrentStepIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(autoPlay);

    const [challengerState, setChallengerState] = useState<BattleSideState>({
        name: challengerSnapshot.username,
        title: challengerSnapshot.title,
        maxHp: initialChallengerHp,
        currentHp: initialChallengerHp,
    });

    const [defenderState, setDefenderState] = useState<BattleSideState>({
        name: defenderSnapshot.username,
        title: defenderSnapshot.title,
        maxHp: initialDefenderHp,
        currentHp: initialDefenderHp,
    });

    const timeline = replayData?.timeline ?? [];
    const challengerAvatarLayers = toCharacterAvatarLayers(challengerSnapshot.avatar.layers);
    const defenderAvatarLayers = toCharacterAvatarLayers(defenderSnapshot.avatar.layers);

    function resetReplayState() {
        setCurrentStepIndex(-1);
        setChallengerState({
            name: challengerSnapshot.username,
            title: challengerSnapshot.title,
            maxHp: initialChallengerHp,
            currentHp: initialChallengerHp,
        });
        setDefenderState({
            name: defenderSnapshot.username,
            title: defenderSnapshot.title,
            maxHp: initialDefenderHp,
            currentHp: initialDefenderHp,
        });
    }

    function rebuildReplayToStep(targetStepIndex: number) {
        let nextChallengerHp = initialChallengerHp;
        let nextDefenderHp = initialDefenderHp;

        for (let i = 0; i <= targetStepIndex; i += 1) {
            const event = timeline[i];
            if (!event) continue;

            if (event.target_side === "challenger") {
                nextChallengerHp = safeNumber(event.target_hp_after, nextChallengerHp);
            } else {
                nextDefenderHp = safeNumber(event.target_hp_after, nextDefenderHp);
            }
        }

        setChallengerState({
            name: challengerSnapshot.username,
            title: challengerSnapshot.title,
            maxHp: initialChallengerHp,
            currentHp: nextChallengerHp,
        });

        setDefenderState({
            name: defenderSnapshot.username,
            title: defenderSnapshot.title,
            maxHp: initialDefenderHp,
            currentHp: nextDefenderHp,
        });

        setCurrentStepIndex(targetStepIndex);
    }

    useEffect(() => {
        setIsPlaying(autoPlay);
        resetReplayState();
    }, [
        autoPlay,
        challengerSnapshot.username,
        challengerSnapshot.title,
        defenderSnapshot.username,
        defenderSnapshot.title,
        initialChallengerHp,
        initialDefenderHp,
    ]);

    useEffect(() => {
        if (!isPlaying) return;
        if (!timeline.length) return;

        if (currentStepIndex >= timeline.length - 1) {
            setIsPlaying(false);
            return;
        }

        const timeout = window.setTimeout(() => {
            const nextIndex = currentStepIndex + 1;
            rebuildReplayToStep(nextIndex);
        }, stepIntervalMs);

        return () => {
            window.clearTimeout(timeout);
        };
    }, [isPlaying, currentStepIndex, timeline, stepIntervalMs]);

    const activeEvent = currentStepIndex >= 0 ? timeline[currentStepIndex] : null;

    const challengerHpPercent = useMemo(() => {
        if (challengerState.maxHp <= 0) return 0;
        return clampPercent((challengerState.currentHp / challengerState.maxHp) * 100);
    }, [challengerState.currentHp, challengerState.maxHp]);

    const defenderHpPercent = useMemo(() => {
        if (defenderState.maxHp <= 0) return 0;
        return clampPercent((defenderState.currentHp / defenderState.maxHp) * 100);
    }, [defenderState.currentHp, defenderState.maxHp]);

    function handlePlayPause() {
        if (!timeline.length) return;

        if (currentStepIndex >= timeline.length - 1) {
            resetReplayState();
            setIsPlaying(true);
            return;
        }

        setIsPlaying((prev) => !prev);
    }

    function handleReset() {
        setIsPlaying(false);
        resetReplayState();
    }

    function handleStepBack() {
        setIsPlaying(false);

        if (currentStepIndex <= -1) {
            resetReplayState();
            return;
        }

        const nextIndex = currentStepIndex - 1;

        if (nextIndex < 0) {
            resetReplayState();
            return;
        }

        rebuildReplayToStep(nextIndex);
    }

    function handleStepForward() {
        setIsPlaying(false);

        if (!timeline.length) return;
        if (currentStepIndex >= timeline.length - 1) return;

        const nextIndex = currentStepIndex + 1;
        rebuildReplayToStep(nextIndex);
    }

    const challengerIsActing = activeEvent?.actor_side === "challenger";
    const defenderIsActing = activeEvent?.actor_side === "defender";
    const challengerIsHit = activeEvent?.target_side === "challenger";
    const defenderIsHit = activeEvent?.target_side === "defender";

    return (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-white">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-white/45">Battle Replay</div>
                    <div className="mt-1 text-sm text-white/70">
                        {activeEvent
                            ? `Step ${activeEvent.step}: ${activeEvent.actor_side} used ${activeEvent.action_type}`
                            : "Ready"}
                    </div>
                </div>

                <div className="text-xs text-white/45">
                    {timeline.length > 0
                        ? `${Math.max(currentStepIndex + 1, 0)} / ${timeline.length}`
                        : "0 / 0"}
                </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={handlePlayPause}
                    className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white transition hover:bg-white/15"
                >
                    {isPlaying ? "Pause" : currentStepIndex >= timeline.length - 1 ? "Replay" : "Play"}
                </button>

                <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white transition hover:bg-white/15"
                >
                    Reset
                </button>

                <button
                    type="button"
                    onClick={handleStepBack}
                    className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white transition hover:bg-white/15"
                >
                    Step Back
                </button>

                <button
                    type="button"
                    onClick={handleStepForward}
                    className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white transition hover:bg-white/15"
                >
                    Step Forward
                </button>
            </div>

            <div className="mb-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-white/40">Challenger</div>
                            <div className="mt-1 text-lg font-semibold">{challengerState.name}</div>
                            <div className="text-sm text-white/55">{challengerState.title}</div>
                        </div>
                        <div className="text-right text-sm text-white/70">
                            {challengerState.currentHp} / {challengerState.maxHp}
                        </div>
                    </div>

                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
                        <div
                            className="h-full rounded-full bg-white transition-all duration-500"
                            style={{ width: `${challengerHpPercent}%` }}
                        />
                    </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-white/40">Defender</div>
                            <div className="mt-1 text-lg font-semibold">{defenderState.name}</div>
                            <div className="text-sm text-white/55">{defenderState.title}</div>
                        </div>
                        <div className="text-right text-sm text-white/70">
                            {defenderState.currentHp} / {defenderState.maxHp}
                        </div>
                    </div>

                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
                        <div
                            className="h-full rounded-full bg-white transition-all duration-500"
                            style={{ width: `${defenderHpPercent}%` }}
                        />
                    </div>
                </div>
            </div>

            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06),rgba(255,255,255,0.015)_35%,rgba(0,0,0,0.4)_70%)]">
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent_35%,rgba(0,0,0,0.24))]" />
                <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-20 border-t border-white/5 bg-black/25" />

                <div className="relative h-[460px] w-full">
                    <div
                        className={`absolute bottom-[14px] left-[20%] transition-all duration-500 ${challengerIsActing ? "translate-x-[110px] scale-[1.06]" : "translate-x-0 scale-100"
                            } ${challengerIsHit ? "-translate-x-[18px]" : ""}`}
                    >
                        <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-white/0" />
                        <McBattleFighterSprite layers={challengerAvatarLayers} />
                    </div>

                    <div className="pointer-events-none absolute left-1/2 bottom-[24px] z-10 -translate-x-1/2 rounded-full border border-white/10 bg-black/40 px-5 py-3 text-sm font-semibold text-white/75">
                        VS
                    </div>

                    <div
                        className={`absolute bottom-[14px] right-[20%] transition-all duration-500 ${defenderIsActing ? "-translate-x-[110px] scale-[1.06]" : "translate-x-0 scale-100"
                            } ${defenderIsHit ? "translate-x-[18px]" : ""}`}
                    >
                        <div className="scale-x-[-1]">
                            <McBattleFighterSprite layers={defenderAvatarLayers} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/70">
                {activeEvent ? (
                    <div>
                        <span className="font-medium text-white">{activeEvent.actor_side}</span>
                        {" hit "}
                        <span className="font-medium text-white">{activeEvent.target_side}</span>
                        {" for "}
                        <span className="font-medium text-white">{activeEvent.damage}</span>
                        {" damage."}
                    </div>
                ) : (
                    <div>Waiting to begin replay.</div>
                )}
            </div>
        </div>
    );
}