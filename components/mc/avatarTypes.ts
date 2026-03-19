export type ShapeData = {
  shape?: "ellipse" | "rect" | "line";
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  radius?: string;
  background?: string;
  border?: string;
  blur?: string;
  opacity?: number;
};

export type CharacterAvatarLayer = {
  asset_id: number;
  asset_key: string;
  slot_key: string;
  asset_kind: "shape" | "image";
  image_url: string | null;
  shape_data: ShapeData | null;
  layer_order: number;
};

export type CharacterLoadoutOption = {
  assetId: number;
  assetKey: string;
  displayName: string;
  slotKey: string;
  assetKind: "shape" | "image";
  imageUrl: string | null;
  shapeData: ShapeData | null;
  layerOrder: number;
  isEquipped: boolean;
};

export type CharacterLoadoutOptionGroup = {
  slotKey: string;
  slotLabel: string;
  options: CharacterLoadoutOption[];
};