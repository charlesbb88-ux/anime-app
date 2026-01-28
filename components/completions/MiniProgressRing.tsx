"use client";

import React, { useMemo } from "react";
import ProgressRing from "./ProgressRing";

type CompletionKind = "anime" | "manga";

type Props = {
  current: number;
  total: number;

  kind?: CompletionKind;
  slug?: string | null;

  filledColor?: string;
  size?: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export default function MiniProgressRing({
  current,
  total,
  kind,
  slug,
  filledColor = "#0EA5E9",
  size = 64,
}: Props) {
  const stroke = Math.max(10, Math.round(size * 0.22));

  const pctLabel = useMemo(() => {
    const t = Math.max(0, Number.isFinite(total) ? total : 0);
    const c = clamp(Number.isFinite(current) ? current : 0, 0, t);
    const pct = t > 0 ? Math.round((c / t) * 100) : 0;
    return `${pct}%`;
  }, [current, total]);

  const fontSize = Math.round(size * 0.18);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* ring (we hide ProgressRing’s text by setting font sizes to 0) */}
      <ProgressRing
        current={current}
        total={total}
        size={size}
        stroke={stroke}
        segmentCap={48}
        gapDeg={1.1}
        kind={kind}
        slug={slug}
        filledColor={filledColor}
        showHoverInCenter={false}
        centerLabel=""
        centerTopFontSize={0}
        centerBottomFontSize={0}
        centerLabelFontSize={0}
        emptyFillColor="#ffffff"
        emptyInnerStrokeColor="#d1d5db"
        emptyInnerStrokeWidth={2}
        hoveredOutlineColor="#111827"
        hoveredOutlineWidth={1}
      />

      {/* ✅ our own perfectly centered percent */}
      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        <div
          className="font-extrabold text-slate-900"
          style={{ fontSize, lineHeight: 1 }}
        >
          {pctLabel}
        </div>
      </div>
    </div>
  );
}
