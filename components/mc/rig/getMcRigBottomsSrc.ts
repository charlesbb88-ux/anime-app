export function getMcRigBottomsSrc(bottomsId?: string | null): string | null {
  if (!bottomsId) return null;

  switch (bottomsId) {
    case "beige_slacks_01":
      return "/mc/rig/bottoms/beige_slacks_01/bottoms_v1.png";
    default:
      return null;
  }
}