import { createSpriteSetFromFolder } from "@/components/mc/paperdoll/createSpriteSetFromFolder";
import type {
  McPaperDollCatalog,
  McPaperDollLoadout,
} from "@/components/mc/paperdoll/mcPaperDollTypes";

export type McPaperDollOption = {
  id: string;
  label: string;
};

export const MC_BODY_OPTIONS: McPaperDollOption[] = [
  { id: "base_male_01", label: "Base" },
  { id: "base_skin_light_01", label: "Light" },
  { id: "base_skin_tan_01", label: "Tan" },
  { id: "base_skin_brown_01", label: "Brown" },
  { id: "base_skin_dark_01", label: "Dark" },
];

export const MC_HAIR_OPTIONS: McPaperDollOption[] = [
  { id: "spiky_black_01", label: "Spiky Black" },
];

export const DEFAULT_MC_PAPERDOLL_LOADOUT: McPaperDollLoadout = {
  body: "base_male_01",
  hair: null,
  torso: null,
  bottoms: null,
  feet: null,
  hands: null,
  eyes: null,
};

export const MC_PAPERDOLL_CATALOG: McPaperDollCatalog = {
  body: {
    base_male_01: createSpriteSetFromFolder(
    "/mc/paperdoll/body/base_male_01"
  ),
    base_skin_light_01: createSpriteSetFromFolder(
      "/mc/paperdoll/body/base_skin_light_01"
    ),
    base_skin_tan_01: createSpriteSetFromFolder(
      "/mc/paperdoll/body/base_skin_tan_01"
    ),
        base_skin_brown_01: createSpriteSetFromFolder(
      "/mc/paperdoll/body/base_skin_brown_01"
    ),
    base_skin_dark_01: createSpriteSetFromFolder(
      "/mc/paperdoll/body/base_skin_dark_01"
    ),
  },
  hair: {
    spiky_black_01: createSpriteSetFromFolder(
      "/mc/paperdoll/hair/spiky_black_01"
    ),
  },
  torso: {},
  bottoms: {},
  feet: {},
  hands: {},
  eyes: {},
};