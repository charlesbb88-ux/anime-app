import type { McBoneKey } from "@/lib/mcFighterSkeleton";

export type McBoneLayout = {
  x: number;
  y: number;
};

export type McBoneLayoutMap = Record<McBoneKey, McBoneLayout>;

export const MC_STARTER_BONE_LAYOUT: McBoneLayoutMap = {
  root: { x: 0, y: 0 },

  hips: { x: 0, y: 0 },
  torso: { x: 0, y: -26 },
  neck: { x: 0, y: -36 },
  head: { x: 0, y: -46 },

  shoulder_left: { x: -18, y: -24 },
  upper_arm_left: { x: 0, y: 0 },
  forearm_left: { x: -18, y: 26 },
  hand_left: { x: -10, y: 26 },

  shoulder_right: { x: 18, y: -24 },
  upper_arm_right: { x: 0, y: 0 },
  forearm_right: { x: 18, y: 26 },
  hand_right: { x: 10, y: 26 },

  thigh_left: { x: -10, y: 22 },
  shin_left: { x: -2, y: 42 },
  foot_left: { x: 0, y: 34 },

  thigh_right: { x: 10, y: 22 },
  shin_right: { x: 2, y: 42 },
  foot_right: { x: 0, y: 34 },
};