export function getMcRigHairSrc(hairId?: string | null): string | null {
  if (!hairId) {
    return null;
  }

  switch (hairId) {
    case "spiky_black_01":
      return "/mc/rig/hair/spiky_black_01/hair_v1.png";
    case "special_hair_01":
      return "/mc/rig/hair/special_hair_01/hair_v1.png";
    default:
      return null;
  }
}