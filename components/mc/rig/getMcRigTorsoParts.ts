export type McRigTorsoParts = {
  torsoLower: string | null;
  torsoUpper: string | null;
  armLeftUpper: string | null;
  armLeftForearm: string | null;
  armRightUpper: string | null;
  armRightForearm: string | null;
};

export function getMcRigTorsoParts(torsoId?: string | null): McRigTorsoParts {
  if (torsoId === "rolled_sleeve_suspenders_01") {
    const basePath = "/mc/rig/torso/rolled_sleeve_suspenders_01";

    return {
      torsoLower: `${basePath}/torso_lower_v1.png`,
      torsoUpper: `${basePath}/torso_upper_v1.png`,
      armLeftUpper: `${basePath}/arm_left_upper_v1.png`,
      armLeftForearm: `${basePath}/arm_left_forearm_v1.png`,
      armRightUpper: `${basePath}/arm_right_upper_v1.png`,
      armRightForearm: `${basePath}/arm_right_forearm_v1.png`,
    };
  }

  return {
    torsoLower: null,
    torsoUpper: null,
    armLeftUpper: null,
    armLeftForearm: null,
    armRightUpper: null,
    armRightForearm: null,
  };
}