export type McRigHandsParts = {
  leftHand: string | null;
  rightHand: string | null;
};

export function getMcRigHandsParts(handsId?: string | null): McRigHandsParts {
  if (handsId === "tie_wrap_01") {
    const basePath = "/mc/rig/hands/tie_wrap_01";

    return {
      leftHand: `${basePath}/left_hand_v1.png`,
      rightHand: `${basePath}/right_hand_v1.png`,
    };
  }

  return {
    leftHand: null,
    rightHand: null,
  };
}