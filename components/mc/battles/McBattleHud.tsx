"use client";

import { useEffect, useRef, useState } from "react";

type FighterHudDisplayProps = {
    username: string;
    avatarUrl: string | null;
    currentHp: number;
    maxHp: number;
    hpPercent: number;
};

type FighterHudProps = FighterHudDisplayProps & {
    align: "left" | "right";
};

type Props = {
    left: FighterHudDisplayProps;
    right: FighterHudDisplayProps;
};

function FighterHud({
    username,
    avatarUrl,
    currentHp,
    maxHp,
    hpPercent,
    align,
}: FighterHudProps) {
    const isRight = align === "right";

    const frameClipPath = isRight
        ? "polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)"
        : "polygon(0% 0%, 94% 0%, 100% 100%, 6% 100%)";

    const [displayHpPercent, setDisplayHpPercent] = useState(hpPercent);
    const [isDamaged, setIsDamaged] = useState(false);

    const previousHpRef = useRef(currentHp);
    const damageFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    useEffect(() => {
        const previousHp = previousHpRef.current;

        if (currentHp < previousHp) {
            setIsDamaged(true);

            if (damageFlashTimeoutRef.current) {
                clearTimeout(damageFlashTimeoutRef.current);
            }

            damageFlashTimeoutRef.current = setTimeout(() => {
                setIsDamaged(false);
            }, 180);
        }

        previousHpRef.current = currentHp;

        return () => {
            if (damageFlashTimeoutRef.current) {
                clearTimeout(damageFlashTimeoutRef.current);
                damageFlashTimeoutRef.current = null;
            }
        };
    }, [currentHp]);

    useEffect(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        function animate() {
            setDisplayHpPercent((prev) => {
                const diff = hpPercent - prev;

                if (Math.abs(diff) < 0.35) {
                    return hpPercent;
                }

                return prev + diff * 0.18;
            });

            animationFrameRef.current = requestAnimationFrame(animate);
        }

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, [hpPercent]);

    const safeDisplayHpPercent = Math.max(0, Math.min(100, displayHpPercent));

    return (
        <div
            className={`flex items-center gap-2 px-2 py-1 transition-all duration-200 ${isRight ? "flex-row-reverse" : ""
                }`}
            style={{
                filter: isDamaged
                    ? "drop-shadow(0 0 10px rgba(239, 68, 68, 0.9)) drop-shadow(0 0 22px rgba(239, 68, 68, 0.55))"
                    : "none",
            }}
        >
            <div
                className={`h-13 w-13 overflow-hidden rounded-full bg-black border border-white/20 transition-transform duration-150 ${isDamaged ? "scale-110" : "scale-100"
                    }`}
                style={{
                    boxShadow: isDamaged
                        ? "0 0 10px rgba(239, 68, 68, 0.9)"
                        : "0 0 6px rgba(255,255,255,0.15)",
                }}
            >
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt={`${username} avatar`}
                        className="h-full w-full object-cover"
                    />
                ) : null}
            </div>

            <div className={`flex flex-col ${isRight ? "items-end" : ""}`}>
                <div className="text-xs text-white">{username}</div>

                <div className="w-64">
                    <div
                        className="relative h-4 overflow-hidden border border-white/10 bg-gray-900"
                        style={{
                            clipPath: frameClipPath,
                        }}
                    >
                        <div
                            className={`absolute inset-0 flex ${isRight ? "justify-end" : "justify-start"
                                }`}
                        >
                            <div
                                className="h-full transition-all duration-150"
                                style={{
                                    width: `${safeDisplayHpPercent}%`,
                                    background: isDamaged
                                        ? "linear-gradient(90deg, #ef4444, #b91c1c)"
                                        : "linear-gradient(90deg, #22c55e, #15803d)",
                                }}
                            />
                        </div>

                        <div
                            className="absolute top-0 left-0 right-0 h-[40%]"
                            style={{
                                background:
                                    "linear-gradient(to bottom, rgba(255,255,255,0.25), transparent)",
                                clipPath: frameClipPath,
                                pointerEvents: "none",
                            }}
                        />

                        <div
                            className={`absolute inset-0 flex items-center text-[9px] font-semibold ${isRight ? "justify-end pr-5" : "justify-start pl-5"
                                } ${isDamaged ? "text-red-100" : "text-white"}`}
                            style={{
                                textShadow: isDamaged
                                    ? "0 0 6px rgba(254, 202, 202, 0.95), 0 0 12px rgba(239, 68, 68, 0.8)"
                                    : "0 1px 2px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.75)",
                                pointerEvents: "none",
                            }}
                        >
                            {Math.round(currentHp)} / {maxHp}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function McBattleHud({ left, right }: Props) {
    return (
        <div className="pointer-events-none absolute top-2 left-0 right-0 flex justify-between px-4">
            <FighterHud
                username={left.username}
                avatarUrl={left.avatarUrl}
                currentHp={left.currentHp}
                maxHp={left.maxHp}
                hpPercent={left.hpPercent}
                align="left"
            />

            <FighterHud
                username={right.username}
                avatarUrl={right.avatarUrl}
                currentHp={right.currentHp}
                maxHp={right.maxHp}
                hpPercent={right.hpPercent}
                align="right"
            />
        </div>
    );
}