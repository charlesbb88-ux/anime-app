export type McBoneKey =
  | "root"
  | "hips"
  | "torso"
  | "neck"
  | "head"
  | "shoulder_left"
  | "upper_arm_left"
  | "forearm_left"
  | "hand_left"
  | "shoulder_right"
  | "upper_arm_right"
  | "forearm_right"
  | "hand_right"
  | "thigh_left"
  | "shin_left"
  | "foot_left"
  | "thigh_right"
  | "shin_right"
  | "foot_right";

export type McBoneDefinition = {
  key: McBoneKey;
  parent_key: McBoneKey | null;
};

export const MC_FIGHTER_BONES: McBoneDefinition[] = [
  { key: "root", parent_key: null },

  { key: "hips", parent_key: "root" },
  { key: "torso", parent_key: "hips" },
  { key: "neck", parent_key: "torso" },
  { key: "head", parent_key: "neck" },

  { key: "shoulder_left", parent_key: "torso" },
  { key: "upper_arm_left", parent_key: "shoulder_left" },
  { key: "forearm_left", parent_key: "upper_arm_left" },
  { key: "hand_left", parent_key: "forearm_left" },

  { key: "shoulder_right", parent_key: "torso" },
  { key: "upper_arm_right", parent_key: "shoulder_right" },
  { key: "forearm_right", parent_key: "upper_arm_right" },
  { key: "hand_right", parent_key: "forearm_right" },

  { key: "thigh_left", parent_key: "hips" },
  { key: "shin_left", parent_key: "thigh_left" },
  { key: "foot_left", parent_key: "shin_left" },

  { key: "thigh_right", parent_key: "hips" },
  { key: "shin_right", parent_key: "thigh_right" },
  { key: "foot_right", parent_key: "shin_right" },
];