export type McRigBottomsParts = {
  hips: string | null;
  legLeftThigh: string | null;
  legLeftShin: string | null;
  legRightThigh: string | null;
  legRightShin: string | null;
};

export function getMcRigBottomsParts(
  bottomsId?: string | null
): McRigBottomsParts {
  if (bottomsId === "beige_slacks_01") {
    const basePath = "/mc/rig/bottoms/beige_slacks_01";

    return {
      hips: `${basePath}/hips_v1.png`,
      legLeftThigh: `${basePath}/leg_left_thigh_v1.png`,
      legLeftShin: `${basePath}/leg_left_shin_v1.png`,
      legRightThigh: `${basePath}/leg_right_thigh_v1.png`,
      legRightShin: `${basePath}/leg_right_shin_v1.png`,
    };
  }

  return {
    hips: null,
    legLeftThigh: null,
    legLeftShin: null,
    legRightThigh: null,
    legRightShin: null,
  };
}