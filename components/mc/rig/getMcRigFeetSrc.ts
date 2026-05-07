export function getMcRigFeetSrc(feetId?: string | null): string | null {
  if (!feetId) return null;

  switch (feetId) {
    case "brown_dress_shoes_01":
      return "/mc/rig/feet/brown_dress_shoes_01/feet_v1.png";
    default:
      return null;
  }
}