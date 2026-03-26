import type { SpriteSet } from "@/components/mc/ScreenSpriteFighter";

export type McPaperDollSlot =
  | "body"
  | "eyes"
  | "hair"
  | "torso"
  | "bottoms"
  | "feet"
  | "hands";

export type McPaperDollDefinition = {
  body: SpriteSet;
  eyes?: SpriteSet | null;
  hair?: SpriteSet | null;
  torso?: SpriteSet | null;
  bottoms?: SpriteSet | null;
  feet?: SpriteSet | null;
  hands?: SpriteSet | null;
};

export type McPaperDollLoadout = {
  body: string;
  eyes?: string | null;
  hair?: string | null;
  torso?: string | null;
  bottoms?: string | null;
  feet?: string | null;
  hands?: string | null;
};

export type McPaperDollCatalog = {
  body: Record<string, SpriteSet>;
  eyes: Record<string, SpriteSet>;
  hair: Record<string, SpriteSet>;
  torso: Record<string, SpriteSet>;
  bottoms: Record<string, SpriteSet>;
  feet: Record<string, SpriteSet>;
  hands: Record<string, SpriteSet>;
};