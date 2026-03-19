"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

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
};

function RigImage({ src, alt = "" }: RigImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
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

export default function CharacterRigAvatar() {
  return (
    <div className="relative h-[420px] w-full max-w-[320px] overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),rgba(255,255,255,0.02)_35%,rgba(0,0,0,0.18)_70%)]">
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent_30%,rgba(0,0,0,0.18))]" />

      <div className="absolute inset-0">
        {/* LEFT LEG CHAIN */}
        <RigNode origin="50% 60%" animate={{ y: [0, -1.0, 0], rotate: [0, 0.5, 0] }} delay={0.02}>
          <RigImage src="/mc/rig/starter/leg_left_thigh_v1.png" />

          <RigNode origin="50% 73%" animate={{ rotate: [0, 0.45, 0], y: [0, 0.2, 0] }} delay={0.03}>
            <RigImage src="/mc/rig/starter/leg_left_shin_v1.png" />

            <RigNode origin="50% 92%" animate={{ rotate: [0, 0.15, 0] }} delay={0.04}>
              <RigImage src="/mc/rig/starter/left_foot_v1.png" />
            </RigNode>
          </RigNode>
        </RigNode>

        {/* RIGHT LEG CHAIN */}
        <RigNode origin="50% 60%" animate={{ y: [0, -1.0, 0], rotate: [0, -0.5, 0] }} delay={0.02}>
          <RigImage src="/mc/rig/starter/leg_right_thigh_v1.png" />

          <RigNode origin="50% 73%" animate={{ rotate: [0, -0.45, 0], y: [0, 0.2, 0] }} delay={0.03}>
            <RigImage src="/mc/rig/starter/leg_right_shin_v1.png" />

            <RigNode origin="50% 92%" animate={{ rotate: [0, -0.15, 0] }} delay={0.04}>
              <RigImage src="/mc/rig/starter/right_foot_v1.png" />
            </RigNode>
          </RigNode>
        </RigNode>

        {/* HIPS + BODY CORE */}
        <RigNode origin="50% 60%" animate={{ y: [0, -1.2, 0], rotate: [0, 0.2, 0] }} delay={0.03}>
          <RigImage src="/mc/rig/starter/hips_v1.png" />

          <RigNode origin="50% 56%" animate={{ y: [0, -0.8, 0], rotate: [0, 0.25, 0] }} delay={0.04}>
            <RigImage src="/mc/rig/starter/torso_lower_v1.png" />

            {/* ARMS should attach under torso_upper movement */}
            <RigNode origin="50% 48%" animate={{ y: [0, -1.2, 0], rotate: [0, -0.35, 0] }} delay={0.05}>
              {/* left upper arm */}
              <RigNode origin="44% 41%" animate={{ rotate: [0, 1.0, 0], y: [0, -0.3, 0] }} delay={0.06}>
                <RigImage src="/mc/rig/starter/arm_left_upper_v1.png" />

                <RigNode origin="41% 51%" animate={{ rotate: [0, 1.2, 0] }} delay={0.07}>
                  <RigImage src="/mc/rig/starter/arm_left_forearm_v1.png" />

                  <RigNode origin="40% 60%" animate={{ rotate: [0, 1.0, 0] }} delay={0.08}>
                    <RigImage src="/mc/rig/starter/left_hand_v1.png" />
                  </RigNode>
                </RigNode>
              </RigNode>

              {/* right upper arm */}
              <RigNode origin="56% 41%" animate={{ rotate: [0, -1.0, 0], y: [0, -0.3, 0] }} delay={0.06}>
                <RigImage src="/mc/rig/starter/arm_right_upper_v1.png" />

                <RigNode origin="59% 51%" animate={{ rotate: [0, -1.2, 0] }} delay={0.07}>
                  <RigImage src="/mc/rig/starter/arm_right_forearm_v1.png" />

                  <RigNode origin="60% 60%" animate={{ rotate: [0, -1.0, 0] }} delay={0.08}>
                    <RigImage src="/mc/rig/starter/right_hand_v1.png" />
                  </RigNode>
                </RigNode>
              </RigNode>

              <RigImage src="/mc/rig/starter/torso_upper_v1.png" />

              <RigNode origin="50% 44%" animate={{ y: [0, -1.2, 0], rotate: [0, -0.15, 0] }} delay={0.06}>
                <RigImage src="/mc/rig/starter/neck_v1.png" />

                <RigNode origin="50% 40%" animate={{ y: [0, -1.4, 0], rotate: [0, 0.5, 0] }} delay={0.08}>
                  <RigImage src="/mc/rig/starter/head_v1.png" />
                </RigNode>
              </RigNode>
            </RigNode>
          </RigNode>
        </RigNode>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/30 to-transparent" />
    </div>
  );
}