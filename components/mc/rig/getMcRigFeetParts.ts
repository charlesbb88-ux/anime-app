export type McRigFeetParts = {
  leftFoot: string | null;
  rightFoot: string | null;
};

export function getMcRigFeetParts(feetId?: string | null): McRigFeetParts {
  if (feetId === "brown_dress_shoes_01") {
    const basePath = "/mc/rig/feet/brown_dress_shoes_01";

    return {
      leftFoot: `${basePath}/left_foot_v1.png`,
      rightFoot: `${basePath}/right_foot_v1.png`,
    };
  }

  return {
    leftFoot: null,
    rightFoot: null,
  };
}