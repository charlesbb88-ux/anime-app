"use client";

import React, { useMemo, useState } from "react";

type CompletionKind = "anime" | "manga";

type Props = {
  current: number;
  total: number;
  size?: number;
  stroke?: number;

  kind?: CompletionKind;
  slug?: string | null;

  segmentCap?: number;

  // gap between segments in degrees
  gapDeg?: number;

  // how the hover label should look
  hoverFontSize?: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

export default function ProgressRing({
  current,
  total,
  size = 140,
  stroke = 22,
  kind,
  slug,
  segmentCap,
  gapDeg = 1.1, // smaller = tighter gaps
  hoverFontSize = 10,
}: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const safeTotal = Math.max(0, Number.isFinite(total) ? total : 0);
  const safeCurrent = clamp(Number.isFinite(current) ? current : 0, 0, safeTotal);
  const pct = safeTotal > 0 ? safeCurrent / safeTotal : 0;

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - stroke) / 2;

  const segments = useMemo(() => {
    const desired = safeTotal > 0 ? safeTotal : 1;
    const capped = segmentCap && segmentCap > 0 ? Math.min(desired, segmentCap) : desired;
    return Math.max(1, Math.floor(capped));
  }, [safeTotal, segmentCap]);

  const step = 360 / segments;
  const gap = clamp(gapDeg, 0, step * 0.8);

  const segMeta = useMemo(() => {
    const out: Array<{
      i: number;
      start: number;
      end: number;
      isFilled: boolean;
      hoverText: string; // what we show ON the segment
      label: string; // for aria
      href: string | null;
      midAngle: number;
      arcD: string;
      angleSpan: number;
    }> = [];

    for (let i = 0; i < segments; i++) {
      const start = safeTotal > 0 ? Math.floor((i * safeTotal) / segments) + 1 : 0;
      const end = safeTotal > 0 ? Math.floor(((i + 1) * safeTotal) / segments) : 0;

      const isFilled = safeTotal > 0 ? end <= safeCurrent : false;

      // ON-HOVER TEXT:
      // If this is 1:1 mapping, start==end and this is the actual episode/chapter number.
      // If capped/bucketed, show a range like "1–7".
      const hoverText = start === end ? `${start}` : `${start}–${end}`;

      const href =
        slug && start > 0
          ? kind === "manga"
            ? `/manga/${slug}/chapter/${start}`
            : `/anime/${slug}/episode/${start}`
          : null;

      const startAngle = i * step + gap / 2;
      const endAngle = (i + 1) * step - gap / 2;

      const angleSpan = endAngle - startAngle;
      const midAngle = (startAngle + endAngle) / 2;

      const arcD = angleSpan > 0 ? arcPath(cx, cy, r, startAngle, endAngle) : "";

      const label =
        kind === "manga"
          ? start === end
            ? `Chapter ${start}`
            : `Chapters ${start}–${end}`
          : start === end
            ? `Episode ${start}`
            : `Episodes ${start}–${end}`;

      out.push({ i, start, end, isFilled, hoverText, label, href, midAngle, arcD, angleSpan });
    }

    return out;
  }, [segments, safeTotal, safeCurrent, kind, slug, step, gap, cx, cy, r]);

  const filledColor = "#22c55e";
  const emptyColor = "#d1d5db";

  const percentLabel = Math.round(pct * 100);

  // where the hover text sits (center of the stroke)
  const textR = r; // the arc is drawn on this radius already
  const hovered = hoveredIdx != null ? segMeta[hoveredIdx] : null;

  const hoverPos = hovered
    ? polarToCartesian(cx, cy, textR, hovered.midAngle)
    : null;

  // if the segment is super tiny (tons of segments), text will look bad.
  // This hides it automatically when it would be unreadable.
  const hoverTextAllowed =
    hovered && hovered.angleSpan >= 7; // degrees threshold — tweak if you want

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* SEGMENTS */}
      <g>
        {segMeta.map((seg) => {
          if (!seg.arcD) return null;

          const strokeColor = seg.isFilled ? filledColor : emptyColor;

          const path = (
            <path
              d={seg.arcD}
              fill="none"
              stroke={strokeColor}
              strokeWidth={stroke}
              strokeLinecap="butt"
              className={seg.href ? "cursor-pointer hover:opacity-90" : undefined}
              onMouseEnter={() => setHoveredIdx(seg.i)}
              onMouseLeave={() => setHoveredIdx((prev) => (prev === seg.i ? null : prev))}
            />
          );

          return seg.href ? (
            <a key={seg.i} href={seg.href} aria-label={seg.label}>
              {path}
            </a>
          ) : (
            <g key={seg.i}>{path}</g>
          );
        })}
      </g>

      {/* HOVER NUMBER ON TOP OF THE SEGMENT */}
      {hoverTextAllowed && hoverPos ? (
        <text
          x={hoverPos.x}
          y={hoverPos.y}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontSize: hoverFontSize,
            fontWeight: 800,
            fill: "#111827",
            paintOrder: "stroke",
            stroke: "#ffffff",
            strokeWidth: 3,
          }}
          pointerEvents="none"
        >
          {hovered!.hoverText}
        </text>
      ) : null}

      {/* CENTER TEXT (keep as-is vibe) */}
      <text
        x={cx}
        y={cy - 2}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontSize: 14, fontWeight: 700, fill: "#111827" }}
      >
        {safeTotal > 0 ? `${safeCurrent} of ${safeTotal}` : "—"}
      </text>

      <text
        x={cx}
        y={cy + 16}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontSize: 11, fontWeight: 500, fill: "#6b7280" }}
      >
        {safeTotal > 0 ? `${percentLabel}%` : ""}
      </text>
    </svg>
  );
}
