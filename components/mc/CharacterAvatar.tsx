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

export default function CharacterAvatar({ layers }: Props) {
  const sortedLayers = [...layers].sort((a, b) => a.layer_order - b.layer_order);

  return (
    <div className="relative h-[420px] w-full max-w-[320px] overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),rgba(255,255,255,0.02)_35%,rgba(0,0,0,0.18)_70%)]">
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent_30%,rgba(0,0,0,0.18))]" />

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

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/30 to-transparent" />
    </div>
  );
}