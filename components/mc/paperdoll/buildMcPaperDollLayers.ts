import type { SpriteSet } from "@/components/mc/ScreenSpriteFighter";
import type {
  McPaperDollCatalog,
  McPaperDollDefinition,
  McPaperDollLoadout,
} from "./mcPaperDollTypes";

export function resolveMcPaperDollDefinition(
  catalog: McPaperDollCatalog,
  loadout: McPaperDollLoadout
): McPaperDollDefinition {
  const body = catalog.body[loadout.body];

  if (!body) {
    throw new Error(`Missing body sprite set for id "${loadout.body}"`);
  }

  return {
    body,
    eyes: loadout.eyes ? catalog.eyes[loadout.eyes] ?? null : null,
    hair: loadout.hair ? catalog.hair[loadout.hair] ?? null : null,
    torso: loadout.torso ? catalog.torso[loadout.torso] ?? null : null,
    bottoms: loadout.bottoms ? catalog.bottoms[loadout.bottoms] ?? null : null,
    feet: loadout.feet ? catalog.feet[loadout.feet] ?? null : null,
    hands: loadout.hands ? catalog.hands[loadout.hands] ?? null : null,
  };
}

export function buildMcPaperDollLayers(
  definition: McPaperDollDefinition
): SpriteSet[] {
  const ordered: Array<SpriteSet | null | undefined> = [
    definition.body,
    definition.eyes,
    definition.bottoms,
    definition.feet,
    definition.torso,
    definition.hands,
    definition.hair,
  ];

  return ordered.filter(Boolean) as SpriteSet[];
}