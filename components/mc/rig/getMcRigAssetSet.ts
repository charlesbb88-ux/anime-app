export type McRigAssetSet = {
  hips: string;
  torsoLower: string;
  torsoUpper: string;
  neck: string;
  head: string;
  armLeftUpper: string;
  armLeftForearm: string;
  leftHand: string;
  armRightUpper: string;
  armRightForearm: string;
  rightHand: string;
  legLeftThigh: string;
  legLeftShin: string;
  leftFoot: string;
  legRightThigh: string;
  legRightShin: string;
  rightFoot: string;
};

function resolveRigBodyFolder(bodyId?: string | null): string {
  switch (bodyId) {
    case "base_skin_light_01":
      return "/mc/rig/body/base_skin_light_01";
    case "base_skin_tan_01":
      return "/mc/rig/body/base_skin_tan_01";
    case "base_skin_brown_01":
      return "/mc/rig/body/base_skin_brown_01";
    case "base_skin_dark_01":
      return "/mc/rig/body/base_skin_dark_01";
    case "base_male_01":
      return "/mc/rig/body/base_male_01";
    default:
      return "/mc/rig/body/base_male_01";
  }
}

export function getMcRigAssetSet(bodyId?: string | null): McRigAssetSet {
  const base = resolveRigBodyFolder(bodyId);

  return {
    hips: `${base}/hips_v1.png`,
    torsoLower: `${base}/torso_lower_v1.png`,
    torsoUpper: `${base}/torso_upper_v1.png`,
    neck: `${base}/neck_v1.png`,
    head: `${base}/head_v1.png`,
    armLeftUpper: `${base}/arm_left_upper_v1.png`,
    armLeftForearm: `${base}/arm_left_forearm_v1.png`,
    leftHand: `${base}/left_hand_v1.png`,
    armRightUpper: `${base}/arm_right_upper_v1.png`,
    armRightForearm: `${base}/arm_right_forearm_v1.png`,
    rightHand: `${base}/right_hand_v1.png`,
    legLeftThigh: `${base}/leg_left_thigh_v1.png`,
    legLeftShin: `${base}/leg_left_shin_v1.png`,
    leftFoot: `${base}/left_foot_v1.png`,
    legRightThigh: `${base}/leg_right_thigh_v1.png`,
    legRightShin: `${base}/leg_right_shin_v1.png`,
    rightFoot: `${base}/right_foot_v1.png`,
  };
}