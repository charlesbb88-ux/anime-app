"use client";

import type { ReactNode } from "react";

type TransformValues = {
  x?: number;
  y?: number;
  rotate?: number;
  scaleX?: number;
  scaleY?: number;
};

type RigNodeProps = {
  origin: string;
  transform?: TransformValues;
  children: ReactNode;
};

type RigImageProps = {
  src: string;
  alt?: string;
};

type PoseKey = "idle" | "attack";

type Props = {
  facing?: "left" | "right";
  scale?: number;
  pose?: PoseKey;
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

function RigNode({ origin, transform, children }: RigNodeProps) {
  const x = transform?.x ?? 0;
  const y = transform?.y ?? 0;
  const rotate = transform?.rotate ?? 0;
  const scaleX = transform?.scaleX ?? 1;
  const scaleY = transform?.scaleY ?? 1;

  return (
    <div
      className="absolute inset-0"
      style={{
        transformOrigin: origin,
        transform: `translate(${x}px, ${y}px) rotate(${rotate}deg) scale(${scaleX}, ${scaleY})`,
      }}
    >
      {children}
    </div>
  );
}

export default function McBattleRig({
  facing = "right",
  scale = 1,
  pose = "idle",
}: Props) {
  const isAttack = pose === "attack";

  return (
    <div
      className="relative h-[560px] w-[420px] overflow-visible"
      style={{
        transform: `${facing === "left" ? "scaleX(-1) " : ""}scale(${scale})`,
        transformOrigin: "bottom center",
      }}
    >
      {/* LEFT LEG CHAIN */}
      <RigNode
        origin="50% 60%"
        transform={isAttack ? { x: 6, rotate: -8 } : undefined}
      >
        <RigImage src="/mc/rig/starter/leg_left_thigh_v1.png" />

        <RigNode
          origin="50% 73%"
          transform={isAttack ? { rotate: 10 } : undefined}
        >
          <RigImage src="/mc/rig/starter/leg_left_shin_v1.png" />

          <RigNode
            origin="50% 92%"
            transform={isAttack ? { rotate: 4 } : undefined}
          >
            <RigImage src="/mc/rig/starter/left_foot_v1.png" />
          </RigNode>
        </RigNode>
      </RigNode>

      {/* RIGHT LEG CHAIN */}
      <RigNode
        origin="50% 60%"
        transform={isAttack ? { x: -4, rotate: 10 } : undefined}
      >
        <RigImage src="/mc/rig/starter/leg_right_thigh_v1.png" />

        <RigNode
          origin="50% 73%"
          transform={isAttack ? { rotate: -8 } : undefined}
        >
          <RigImage src="/mc/rig/starter/leg_right_shin_v1.png" />

          <RigNode
            origin="50% 92%"
            transform={isAttack ? { rotate: -4 } : undefined}
          >
            <RigImage src="/mc/rig/starter/right_foot_v1.png" />
          </RigNode>
        </RigNode>
      </RigNode>

      {/* HIPS + BODY CORE */}
      <RigNode
        origin="50% 60%"
        transform={isAttack ? { x: 10, y: -4, rotate: 6 } : undefined}
      >
        <RigNode
          origin="50% 56%"
          transform={isAttack ? { y: -4, rotate: 6 } : undefined}
        >
          <RigImage src="/mc/rig/starter/torso_lower_v1.png" />

          <RigNode
            origin="50% 48%"
            transform={isAttack ? { y: -4, rotate: -4 } : undefined}
          >
            {/* left upper arm */}
            <RigNode
              origin="44% 41%"
              transform={isAttack ? { rotate: 18, y: -4 } : undefined}
            >
              <RigImage src="/mc/rig/starter/arm_left_upper_v1.png" />

              <RigNode
                origin="41% 51%"
                transform={isAttack ? { rotate: 18 } : undefined}
              >
                <RigImage src="/mc/rig/starter/arm_left_forearm_v1.png" />

                <RigNode
                  origin="40% 60%"
                  transform={isAttack ? { rotate: 12 } : undefined}
                >
                  <RigImage src="/mc/rig/starter/left_hand_v1.png" />
                </RigNode>
              </RigNode>
            </RigNode>

            {/* right upper arm */}
            <RigNode
              origin="56% 41%"
              transform={isAttack ? { rotate: -42, x: 8, y: -6 } : undefined}
            >
              <RigImage src="/mc/rig/starter/arm_right_upper_v1.png" />

              <RigNode
                origin="59% 51%"
                transform={isAttack ? { rotate: -34, x: 8, y: -4 } : undefined}
              >
                <RigImage src="/mc/rig/starter/arm_right_forearm_v1.png" />

                <RigNode
                  origin="60% 60%"
                  transform={isAttack ? { rotate: -14, x: 4 } : undefined}
                >
                  <RigImage src="/mc/rig/starter/right_hand_v1.png" />
                </RigNode>
              </RigNode>
            </RigNode>

            <RigNode
              origin="50% 44%"
              transform={isAttack ? { y: -4, rotate: -6 } : undefined}
            >
              <RigImage src="/mc/rig/starter/neck_v1.png" />

              <RigNode
                origin="50% 40%"
                transform={isAttack ? { y: -4, rotate: -10, x: 4 } : undefined}
              >
                <RigImage src="/mc/rig/starter/head_v1.png" />
              </RigNode>
            </RigNode>

            <RigImage src="/mc/rig/starter/torso_upper_v1.png" />
          </RigNode>
        </RigNode>

        <RigImage src="/mc/rig/starter/hips_v1.png" />
      </RigNode>
    </div>
  );
}