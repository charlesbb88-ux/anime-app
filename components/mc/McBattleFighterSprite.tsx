"use client";

import type { CharacterAvatarLayer } from "@/components/mc/avatarTypes";

type Props = {
  layers: CharacterAvatarLayer[];
};

function renderShapeLayer(layer: CharacterAvatarLayer) {
  const shape = layer.shape_data;

  if (!shape) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: `${shape.x ?? 0}%`,
        top: `${shape.y ?? 0}%`,
        width: `${shape.w ?? 0}%`,
        height: `${shape.h ?? 0}%`,
        transform: "translateX(-50%)",
        borderRadius: shape.radius ?? "0px",
        background: shape.background ?? "transparent",
        border: shape.border ?? "none",
        filter: shape.blur ? `blur(${shape.blur})` : undefined,
        opacity: shape.opacity ?? 1,
      }}
    />
  );
}

export default function McBattleFighterSprite({ layers }: Props) {
  const sortedLayers = [...layers].sort((a, b) => a.layer_order - b.layer_order);

  return (
    <div className="relative h-[360px] w-[260px]">
      {sortedLayers.map((layer) => (
        <div key={layer.asset_id} className="absolute inset-0">
          {layer.asset_kind === "image" && layer.image_url ? (
            <img
              src={layer.image_url}
              alt=""
              className="absolute inset-0 h-full w-full object-contain"
              draggable={false}
            />
          ) : (
            renderShapeLayer(layer)
          )}
        </div>
      ))}
    </div>
  );
}