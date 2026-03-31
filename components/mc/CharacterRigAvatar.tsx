"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { getMcRigAssetSet } from "@/components/mc/rig/getMcRigAssetSet";
import { getMcRigHairSrc } from "@/components/mc/rig/getMcRigHairSrc";

type MotionValues = {
    y?: number[];
    rotate?: number[];
    scaleX?: number[];
    scaleY?: number[];
};

type RigNodeProps = {
    origin: string;
    animate?: MotionValues;
    delay?: number;
    children: ReactNode;
};

type RigImageProps = {
    src: string;
    alt?: string;
    hideOnError?: boolean;
};

type Props = {
    isZoomed?: boolean;
    bodyId?: string | null;
    hairId?: string | null;
};

function getDefaultRigFallbackSrc(src: string): string | null {
    if (!src.startsWith("/mc/rig/body/")) {
        return null;
    }

    return src.replace(/\/mc\/rig\/body\/[^/]+\//, "/mc/rig/body/base_male_01/");
}

function RigImage({ src, alt = "", hideOnError = false }: RigImageProps) {
    const [currentSrc, setCurrentSrc] = useState(src);
    const [isHidden, setIsHidden] = useState(false);

    useEffect(() => {
        setCurrentSrc(src);
        setIsHidden(false);
    }, [src]);

    if (isHidden) {
        return null;
    }

    return (
        <img
            src={currentSrc}
            alt={alt}
            draggable={false}
            onError={() => {
                if (hideOnError) {
                    setIsHidden(true);
                    return;
                }

                const fallbackSrc = getDefaultRigFallbackSrc(src);

                if (!fallbackSrc) {
                    return;
                }

                if (currentSrc !== fallbackSrc) {
                    setCurrentSrc(fallbackSrc);
                }
            }}
            className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
        />
    );
}

function RigNode({ origin, animate, delay = 0, children }: RigNodeProps) {
    return (
        <motion.div
            className="absolute inset-0"
            style={{ transformOrigin: origin }}
            animate={animate}
            transition={{
                duration: 1.85,
                repeat: Infinity,
                ease: "easeInOut",
                delay,
            }}
        >
            {children}
        </motion.div>
    );
}

export default function CharacterRigAvatar({
    isZoomed = true,
    bodyId,
    hairId,
}: Props) {
    const rig = useMemo(() => getMcRigAssetSet(bodyId), [bodyId]);
    const hairSrc = useMemo(() => getMcRigHairSrc(hairId), [hairId]);

    return (
        <div className="relative h-[560px] w-full max-w-[420px] overflow-hidden rounded-[2rem] border border-black border-2 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),rgba(255,255,255,0.02)_35%,rgba(0,0,0,0.18)_70%)]">
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent_30%,rgba(0,0,0,0.18))]" />

            <div
                className={`absolute inset-0 transition-transform duration-300 ${isZoomed
                    ? "scale-[1.3] translate-y-[-23px] sm:scale-[1.12] sm:translate-y-[-20px]"
                    : "scale-75 translate-y-0"
                    }`}
            >
                {/* LEFT LEG CHAIN */}
                <RigNode origin="50% 60%" animate={{ y: [0, -1.0, 0], rotate: [0, 0.5, 0] }} delay={0.02}>
                    <RigImage src={rig.legLeftThigh} />

                    <RigNode origin="50% 73%" animate={{ rotate: [0, 0.45, 0], y: [0, 0.2, 0] }} delay={0.03}>
                        <RigImage src={rig.legLeftShin} />

                        <RigNode origin="50% 92%" animate={{ rotate: [0, 0.15, 0] }} delay={0.04}>
                            <RigImage src={rig.leftFoot} />
                        </RigNode>
                    </RigNode>
                </RigNode>

                {/* RIGHT LEG CHAIN */}
                <RigNode origin="50% 60%" animate={{ y: [0, -1.0, 0], rotate: [0, -0.5, 0] }} delay={0.02}>
                    <RigImage src={rig.legRightThigh} />

                    <RigNode origin="50% 73%" animate={{ rotate: [0, -0.45, 0], y: [0, 0.2, 0] }} delay={0.03}>
                        <RigImage src={rig.legRightShin} />

                        <RigNode origin="50% 92%" animate={{ rotate: [0, -0.15, 0] }} delay={0.04}>
                            <RigImage src={rig.rightFoot} />
                        </RigNode>
                    </RigNode>
                </RigNode>

                {/* HIPS + BODY CORE */}
                <RigNode origin="50% 60%" animate={{ y: [0, -1.2, 0], rotate: [0, 0.2, 0] }} delay={0.03}>
                    {/* lower torso first = behind */}
                    <RigNode origin="50% 56%" animate={{ y: [0, -0.8, 0], rotate: [0, 0.25, 0] }} delay={0.04}>
                        <RigImage src={rig.torsoLower} />

                        {/* ARMS should attach under torso_upper movement */}
                        <RigNode origin="50% 48%" animate={{ y: [0, -1.2, 0], rotate: [0, -0.35, 0] }} delay={0.05}>
                            {/* left upper arm */}
                            <RigNode origin="44% 41%" animate={{ rotate: [0, 1.0, 0], y: [0, -0.3, 0] }} delay={0.06}>
                                <RigImage src={rig.armLeftUpper} />

                                <RigNode origin="41% 51%" animate={{ rotate: [0, 1.2, 0] }} delay={0.07}>
                                    <RigImage src={rig.armLeftForearm} />

                                    <RigNode origin="40% 60%" animate={{ rotate: [0, 1.0, 0] }} delay={0.08}>
                                        <RigImage src={rig.leftHand} />
                                    </RigNode>
                                </RigNode>
                            </RigNode>

                            {/* right upper arm */}
                            <RigNode origin="56% 41%" animate={{ rotate: [0, -1.0, 0], y: [0, -0.3, 0] }} delay={0.06}>
                                <RigImage src={rig.armRightUpper} />

                                <RigNode origin="59% 51%" animate={{ rotate: [0, -1.2, 0] }} delay={0.07}>
                                    <RigImage src={rig.armRightForearm} />

                                    <RigNode origin="60% 60%" animate={{ rotate: [0, -1.0, 0] }} delay={0.08}>
                                        <RigImage src={rig.rightHand} />
                                    </RigNode>
                                </RigNode>
                            </RigNode>

                            <RigNode origin="50% 44%" animate={{ y: [0, -1.2, 0], rotate: [0, -0.15, 0] }} delay={0.06}>
                                <RigImage src={rig.neck} />

                                <RigNode origin="50% 40%" animate={{ y: [0, -1.4, 0], rotate: [0, 0.5, 0] }} delay={0.08}>
                                    <RigImage src={rig.head} />
                                    {hairSrc ? <RigImage src={hairSrc} alt="hair" hideOnError /> : null}
                                </RigNode>
                            </RigNode>

                            <RigImage src={rig.torsoUpper} />
                        </RigNode>
                    </RigNode>

                    {/* hips last = in front */}
                    <RigImage src={rig.hips} />
                </RigNode>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/30 to-transparent" />
        </div>
    );
}