import type { McBoneKey } from "@/lib/mcFighterSkeleton";

export type McBoneTransform = {
  x: number;
  y: number;
  rotation: number;
  scale_x: number;
  scale_y: number;
  origin_x: number;
  origin_y: number;
};

export type McPoseMap = Record<McBoneKey, McBoneTransform>;

export const MC_STARTER_NEUTRAL_POSE: McPoseMap = {
  root: {
    x: 0,
    y: 0,
    rotation: 0,
    scale_x: 1,
    scale_y: 1,
    origin_x: 50,
    origin_y: 100,
  },

  hips: {
    x: 0,
    y: 0,
    rotation: 0,
    scale_x: 1,
    scale_y: 1,
    origin_x: 50,
    origin_y: 60,
  },

  torso: {
    x: 0,
    y: -6,
    rotation: 0,
    scale_x: 1,
    scale_y: 1,
    origin_x: 50,
    origin_y: 56,
  },

  neck: {
    x: 0,
    y: -6,
    rotation: 0,
    scale_x: 1,
    scale_y: 1,
    origin_x: 50,
    origin_y: 44,
  },

  head: {
    x: 0,
    y: -8,
    rotation: 0,
    scale_x: 1,
    scale_y: 1,
    origin_x: 50,
    origin_y: 40,
  },

  shoulder_left: {
    x: 0,
    y: 0,
    rotation: 0,
    scale_x: 1,
    scale_y: 1,
    origin_x: 44,
    origin_y: 41,
  },

  upper_arm_left: {
    x: 0,
    y: 0,
    rotation: 0,
    scale_x: 1,
    scale_y: 1,
    origin_x: 44,
    origin_y: 41,
  },

  forearm_left: {
    x: 0,
    y: 0,
    rotation: 0,
    scale_x: 1,
    scale_y: 1,
    origin_x: 41,
    origin_y: 51,
  },

  hand_left: {
    x: 0,
    y: 0,
    rotation: 0,
    scale_x: 1,
    scale_y: 1,
    origin_x: 40,
    origin_y: 60,
  },

  shoulder_right: {
    x: 0,
    y: 0,
    rotation: 0,
    scale_x: 1,
    scale_y: 1,
    origin_x: 56,
    origin_y: 41,
  },

  upper_arm_right: {
    x: 0,
    y: 0,
    rotation: 0,
    scale_x: 1,
    scale_y: 1,
    origin_x: 56,
    origin_y: 41,
  },

  forearm_right: {
    x: 0,
    y: 0,
    rotation: 0,
    scale_x: 1,
    scale_y: 1,
    origin_x: 59,
    origin_y: 51,
  },

  hand_right: {
    x: 0,
    y: 0,
    rotation: 0,
    scale_x: 1,
    scale_y: 1,
    origin_x: 60,
    origin_y: 60,
  },

  thigh_left: {
    x: 0,
    y: 0,
    rotation: 0,
    scale_x: 1,
    scale_y: 1,
    origin_x: 50,
    origin_y: 60,
  },

  shin_left: {
    x: 0,
    y: 0,
    rotation: 0,
    scale_x: 1,
    scale_y: 1,
    origin_x: 50,
    origin_y: 73,
  },

  foot_left: {
    x: 0,
    y: 0,
    rotation: 0,
    scale_x: 1,
    scale_y: 1,
    origin_x: 50,
    origin_y: 92,
  },

  thigh_right: {
    x: 0,
    y: 0,
    rotation: 0,
    scale_x: 1,
    scale_y: 1,
    origin_x: 50,
    origin_y: 60,
  },

  shin_right: {
    x: 0,
    y: 0,
    rotation: 0,
    scale_x: 1,
    scale_y: 1,
    origin_x: 50,
    origin_y: 73,
  },

  foot_right: {
    x: 0,
    y: 0,
    rotation: 0,
    scale_x: 1,
    scale_y: 1,
    origin_x: 50,
    origin_y: 92,
  },
};