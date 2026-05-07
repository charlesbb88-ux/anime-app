export function getMcRigHandsSrc(handsId?: string | null): string | null {
  if (!handsId) return null;

  switch (handsId) {
    case "tie_wrap_01":
      return "/mc/rig/hands/tie_wrap_01/hands_v1.png";
    default:
      return null;
  }
}