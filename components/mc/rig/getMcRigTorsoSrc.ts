export function getMcRigTorsoSrc(torsoId?: string | null): string | null {
  if (!torsoId) return null;

  switch (torsoId) {
    case "rolled_sleeve_suspenders_01":
      return "/mc/rig/torso/rolled_sleeve_suspenders_01/torso_v1.png";
    default:
      return null;
  }
}