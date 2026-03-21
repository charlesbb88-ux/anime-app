import type { McBoneKey } from "@/lib/mcFighterSkeleton";

export type McFighterPartSprite = {
  bone_key: McBoneKey;
  image_url: string;
  width: number;
  height: number;
  z_index: number;
};

export const MC_STARTER_FIGHTER_PARTS: McFighterPartSprite[] = [
  {
    bone_key: "hips",
    image_url: "/mc/rig/starter/hips_v1.png",
    width: 260,
    height: 360,
    z_index: 40,
  },
  {
    bone_key: "torso",
    image_url: "/mc/rig/starter/torso_lower_v1.png",
    width: 260,
    height: 360,
    z_index: 20,
  },
  {
    bone_key: "torso",
    image_url: "/mc/rig/starter/torso_upper_v1.png",
    width: 260,
    height: 360,
    z_index: 50,
  },
  {
    bone_key: "neck",
    image_url: "/mc/rig/starter/neck_v1.png",
    width: 260,
    height: 360,
    z_index: 55,
  },
  {
    bone_key: "head",
    image_url: "/mc/rig/starter/head_v1.png",
    width: 260,
    height: 360,
    z_index: 60,
  },

  {
    bone_key: "upper_arm_left",
    image_url: "/mc/rig/starter/arm_left_upper_v1.png",
    width: 260,
    height: 360,
    z_index: 30,
  },
  {
    bone_key: "forearm_left",
    image_url: "/mc/rig/starter/arm_left_forearm_v1.png",
    width: 260,
    height: 360,
    z_index: 31,
  },
  {
    bone_key: "hand_left",
    image_url: "/mc/rig/starter/left_hand_v1.png",
    width: 260,
    height: 360,
    z_index: 32,
  },

  {
    bone_key: "upper_arm_right",
    image_url: "/mc/rig/starter/arm_right_upper_v1.png",
    width: 260,
    height: 360,
    z_index: 30,
  },
  {
    bone_key: "forearm_right",
    image_url: "/mc/rig/starter/arm_right_forearm_v1.png",
    width: 260,
    height: 360,
    z_index: 31,
  },
  {
    bone_key: "hand_right",
    image_url: "/mc/rig/starter/right_hand_v1.png",
    width: 260,
    height: 360,
    z_index: 32,
  },

  {
    bone_key: "thigh_left",
    image_url: "/mc/rig/starter/leg_left_thigh_v1.png",
    width: 260,
    height: 360,
    z_index: 10,
  },
  {
    bone_key: "shin_left",
    image_url: "/mc/rig/starter/leg_left_shin_v1.png",
    width: 260,
    height: 360,
    z_index: 11,
  },
  {
    bone_key: "foot_left",
    image_url: "/mc/rig/starter/left_foot_v1.png",
    width: 260,
    height: 360,
    z_index: 12,
  },

  {
    bone_key: "thigh_right",
    image_url: "/mc/rig/starter/leg_right_thigh_v1.png",
    width: 260,
    height: 360,
    z_index: 10,
  },
  {
    bone_key: "shin_right",
    image_url: "/mc/rig/starter/leg_right_shin_v1.png",
    width: 260,
    height: 360,
    z_index: 11,
  },
  {
    bone_key: "foot_right",
    image_url: "/mc/rig/starter/right_foot_v1.png",
    width: 260,
    height: 360,
    z_index: 12,
  },
];