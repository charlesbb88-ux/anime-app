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

    const plateClipPath = isRight
        ? "polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)"
        : "polygon(0% 0%, 94% 0%, 100% 100%, 6% 100%)";

    const hudGradient = isRight
        ? "linear-gradient(180deg, #ff6565 0%, #ff4747 38%, #ce2323 100%)"
        : "linear-gradient(180deg, #55bbff 0%, #31adff 38%, #1f6fc6 100%)";

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
            className={`flex min-w-0 flex-1 items-center gap-0 transition-all duration-200 ${isRight ? "flex-row-reverse justify-start" : "justify-start"
                }`}
            style={{
                filter: isDamaged
                    ? "drop-shadow(0 0 10px rgba(239, 68, 68, 0.9)) drop-shadow(0 0 22px rgba(239, 68, 68, 0.55))"
                    : "none",
            }}
        >
            <div
                className={`relative shrink-0 rounded-full border border-black p-[2px] xs:p-[3px] sm:p-[4px] ${isDamaged ? "scale-110 sm:scale-120" : "scale-100"
                    }`}
                style={{
                    width: "clamp(34px, 9vw, 76px)",
                    height: "clamp(34px, 9vw, 76px)",
                    background: hudGradient,
                    boxShadow: isDamaged
                        ? "0 0 10px rgba(239, 68, 68, 0.9)"
                        : "0 0 6px rgba(255,255,255,0.15)",
                    zIndex: 2,
                }}
            >
                <div className="h-full w-full overflow-hidden rounded-full bg-black">
                    {avatarUrl ? (
                        <img
                            src={avatarUrl}
                            alt={`${username} avatar`}
                            className="h-full w-full object-cover"
                        />
                    ) : null}
                </div>
            </div>

            <div
                className={`relative flex min-w-0 flex-1 flex-col ${isRight
                    ? "items-end -mr-1 xs:-mr-2 sm:-mr-4"
                    : "-ml-1 xs:-ml-2 sm:-ml-4"
                    }`}
                style={{ zIndex: 1 }}
            >
                <div
                    className="absolute top-[2px] xs:top-[3px] sm:top-[4px] h-[14px] xs:h-[18px] sm:h-[24px] border-y border-black"
                    style={{
                        background: hudGradient,
                        boxShadow: "0 0 8px rgba(0,0,0,0.2)",
                        width: "clamp(10px, 3vw, 24px)",
                        left: isRight ? "auto" : 0,
                        right: isRight ? 0 : "auto",
                        transform: isRight
                            ? "translateX(5px)"
                            : "translateX(-5px)",
                        zIndex: 0,
                    }}
                >
                    <div
                        className="absolute inset-0"
                        style={{
                            background:
                                "linear-gradient(to bottom, rgba(255,255,255,0.28), rgba(255,255,255,0.08) 45%, transparent 70%)",
                            pointerEvents: "none",
                        }}
                    />
                </div>

                <div
                    className={`relative w-full overflow-hidden border border-black px-1.5 xs:px-2 sm:px-3 text-[7px] xs:text-[8px] sm:text-[12px] font-extrabold uppercase tracking-[0.02em] text-black ${isRight ? "text-right" : "text-left"
                        }`}
                    style={{
                        width: "min(100%, clamp(82px, 24vw, 220px))",
                        clipPath: plateClipPath,
                        background: hudGradient,
                        boxShadow: isDamaged
                            ? "0 0 10px rgba(255,255,255,0.2), 0 0 14px rgba(239, 68, 68, 0.45)"
                            : "0 0 8px rgba(0,0,0,0.35)",
                        textShadow: "0 1px 0 rgba(255,255,255,0.25)",
                        zIndex: 1,
                    }}
                >
                    <div
                        className="absolute inset-0"
                        style={{
                            background:
                                "linear-gradient(to bottom, rgba(255,255,255,0.35), rgba(255,255,255,0.08) 40%, transparent 55%)",
                            pointerEvents: "none",
                        }}
                    />

                    <div
                        className={`relative z-10 truncate leading-none py-[1px] xs:py-[2px] sm:py-0 ${isRight
                            ? "pr-2 xs:pr-3 sm:pr-[18px]"
                            : "pl-2 xs:pl-3 sm:pl-[18px]"
                            }`}
                    >
                        {username}
                    </div>
                </div>

                <div
                    className="w-full"
                    style={{
                        maxWidth: "clamp(88px, 27vw, 256px)",
                    }}
                >
                    <div
                        className="relative overflow-hidden border border-white/10 bg-gray-900"
                        style={{
                            height: "clamp(6px, 1.6vw, 14px)",
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
                                        ? isRight
                                            ? "linear-gradient(90deg, #ef4444, #b91c1c)"
                                            : "linear-gradient(270deg, #ef4444, #b91c1c)"
                                        : isRight
                                            ? "linear-gradient(90deg, #22c55e, #15803d)"
                                            : "linear-gradient(270deg, #22c55e, #15803d)",
                                }}
                            />
                        </div>

                        <div
                            className="absolute top-0 left-0 right-0 h-[30%]"
                            style={{
                                background:
                                    "linear-gradient(to bottom, rgba(255,255,255,0.25), transparent)",
                                clipPath: frameClipPath,
                                pointerEvents: "none",
                            }}
                        />

                        <div
                            className={`absolute inset-0 flex items-center text-[5px] sm:text-[9px] font-semibold ${isRight
                                ? "justify-end pr-2 sm:pr-5"
                                : "justify-start pl-2 sm:pl-5"
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
        <div className="pointer-events-none absolute top-1 xs:top-2 left-0 right-0 px-1.5 xs:px-2 sm:px-4">
            <div className="flex items-start justify-between gap-1 xs:gap-2 sm:gap-4">
                <div className="min-w-0 flex-1 max-w-[calc(50%-2px)] xs:max-w-[calc(50%-4px)] sm:max-w-none">
                    <FighterHud
                        username={left.username}
                        avatarUrl={left.avatarUrl}
                        currentHp={left.currentHp}
                        maxHp={left.maxHp}
                        hpPercent={left.hpPercent}
                        align="left"
                    />
                </div>

                <div className="min-w-0 flex-1 max-w-[calc(50%-2px)] xs:max-w-[calc(50%-4px)] sm:max-w-none">
                    <FighterHud
                        username={right.username}
                        avatarUrl={right.avatarUrl}
                        currentHp={right.currentHp}
                        maxHp={right.maxHp}
                        hpPercent={right.hpPercent}
                        align="right"
                    />
                </div>
            </div>
        </div>
    );
}