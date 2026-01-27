"use client";

import React, { useId, useMemo, useState } from "react";

type CompletionKind = "anime" | "manga";

type Props = {
  current: number;
  total: number;

  /** overall svg size (px) */
  size?: number;

  /** thickness of the ring (px) */
  stroke?: number;

  /** used to build hrefs + aria labels */
  kind?: CompletionKind;
  slug?: string | null;

  /** cap number of segments (ex: show at most 18 slices even if total=200) */
  segmentCap?: number;

  /** gap between segments in degrees */
  gapDeg?: number;

  /** center text sizes */
  centerLabelFontSize?: number;
  centerTopFontSize?: number;
  centerBottomFontSize?: number;

  /** label shown ABOVE the numbers in the center */
  centerLabel?: string;

  /** if true, hovering a segment shows its range in the center */
  showHoverInCenter?: boolean;

  /** colors */
  filledColor?: string;

  /** empty segments look */
  emptyFillColor?: string; // usually modal bg
  emptyInnerStrokeColor?: string; // the gray outline color
  emptyInnerStrokeWidth?: number; // thickness of the INSIDE border

  /** hover outline (also inside-only) */
  hoveredOutlineColor?: string;
  hoveredOutlineWidth?: number;
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

function donutSlicePath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number
) {
  const outerStart = polarToCartesian(cx, cy, rOuter, startAngle);
  const outerEnd = polarToCartesian(cx, cy, rOuter, endAngle);
  const innerEnd = polarToCartesian(cx, cy, rInner, endAngle);
  const innerStart = polarToCartesian(cx, cy, rInner, startAngle);

  const delta = endAngle - startAngle;
  const largeArcFlag = delta <= 180 ? "0" : "1";

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${rInner} ${rInner} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

export default function ProgressRing({
  current,
  total,
  size = 140,
  stroke = 22,

  kind,
  slug,

  segmentCap,
  gapDeg = 1.1,

  centerLabel = "",
  centerLabelFontSize = 11,
  centerTopFontSize = 14,
  centerBottomFontSize = 11,

  showHoverInCenter = true,

  filledColor = "#22c55e",

  emptyFillColor = "#ffffff",
  emptyInnerStrokeColor = "#d1d5db",
  emptyInnerStrokeWidth = 3,

  hoveredOutlineColor = "#111827",
  hoveredOutlineWidth = 2,
}: Props) {
  const reactId = useId();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const safeTotal = Math.max(0, Number.isFinite(total) ? total : 0);
  const safeCurrent = clamp(Number.isFinite(current) ? current : 0, 0, safeTotal);
  const pct = safeTotal > 0 ? safeCurrent / safeTotal : 0;
  const percentLabel = Math.round(pct * 100);

  const cx = size / 2;
  const cy = size / 2;

  // ring geometry
  const rMid = (size - stroke) / 2;
  const rOuter = rMid + stroke / 2;
  const rInner = rMid - stroke / 2;

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
      label: string;
      href: string | null;
      d: string;
      angleSpan: number;
    }> = [];

    for (let i = 0; i < segments; i++) {
      const start = safeTotal > 0 ? Math.floor((i * safeTotal) / segments) + 1 : 0;
      const end = safeTotal > 0 ? Math.floor(((i + 1) * safeTotal) / segments) : 0;

      const isFilled = safeTotal > 0 ? end <= safeCurrent : false;

      const href =
        slug && start > 0
          ? kind === "manga"
            ? `/manga/${slug}/chapter/${start}`
            : `/anime/${slug}/episode/${start}`
          : null;

      const startAngle = i * step + gap / 2;
      const endAngle = (i + 1) * step - gap / 2;
      const angleSpan = endAngle - startAngle;

      const d = angleSpan > 0 ? donutSlicePath(cx, cy, rOuter, rInner, startAngle, endAngle) : "";

      const label =
        kind === "manga"
          ? start === end
            ? `Chapter ${start}`
            : `Chapters ${start}–${end}`
          : start === end
            ? `Episode ${start}`
            : `Episodes ${start}–${end}`;

      out.push({ i, start, end, isFilled, label, href, d, angleSpan });
    }

    return out;
  }, [segments, safeTotal, safeCurrent, kind, slug, step, gap, cx, cy, rOuter, rInner]);

  const hovered = hoveredIdx != null ? segMeta[hoveredIdx] : null;

  // What you see in the center:
  // 1) label (new) above
  // 2) main number line
  // 3) bottom detail line (hover label or %)
  const centerTopText =
    showHoverInCenter && hovered && safeTotal > 0
      ? hovered.start === hovered.end
        ? `${hovered.start}`
        : `${hovered.start}–${hovered.end}`
      : safeTotal > 0
        ? `${safeCurrent} / ${safeTotal}`
        : "—";

  const centerBottomText =
    showHoverInCenter && hovered && safeTotal > 0 ? hovered.label : safeTotal > 0 ? `${percentLabel}%` : "";

  // inside-only stroke helper
  const insideStrokePaintWidth = (w: number) => Math.max(0.5, w * 2);

  // Center text layout (scaled)
  const hasLabel = Boolean(centerLabel && centerLabel.trim().length > 0);
  const labelY = cy - centerTopFontSize - 12;
  const topY = cy - 2;
  const bottomY = cy + (centerBottomFontSize + 6);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Progress ring">
      {segMeta.map((seg) => {
        if (!seg.d) return null;

        const isHovered = hoveredIdx === seg.i;
        const clipId = `${reactId}-clip-${seg.i}`;

        const fill = seg.isFilled ? filledColor : emptyFillColor;

        const showEmptyBorder = !seg.isFilled && emptyInnerStrokeWidth > 0;
        const showHoverOutline = isHovered && hoveredOutlineWidth > 0;

        const content = (
          <g
            onMouseEnter={() => setHoveredIdx(seg.i)}
            onMouseLeave={() => setHoveredIdx((prev) => (prev === seg.i ? null : prev))}
            className={seg.href ? "cursor-pointer" : undefined}
          >
            <defs>
              <clipPath id={clipId}>
                <path d={seg.d} />
              </clipPath>
            </defs>

            {/* base tile */}
            <path d={seg.d} fill={fill} />

            {/* EMPTY inside border */}
            {showEmptyBorder ? (
              <path
                d={seg.d}
                fill="none"
                stroke={emptyInnerStrokeColor}
                strokeWidth={insideStrokePaintWidth(emptyInnerStrokeWidth)}
                strokeLinejoin="round"
                clipPath={`url(#${clipId})`}
                pointerEvents="none"
                opacity={1}
              />
            ) : null}

            {/* Hover outline (inside-only) */}
            {showHoverOutline ? (
              <path
                d={seg.d}
                fill="none"
                stroke={hoveredOutlineColor}
                strokeWidth={insideStrokePaintWidth(hoveredOutlineWidth)}
                strokeLinejoin="round"
                clipPath={`url(#${clipId})`}
                pointerEvents="none"
                opacity={0.18}
              />
            ) : null}
          </g>
        );

        return seg.href ? (
          <a key={seg.i} href={seg.href} aria-label={seg.label}>
            {content}
          </a>
        ) : (
          <g key={seg.i} aria-label={seg.label}>
            {content}
          </g>
        );
      })}

      {/* CENTER LABEL (new, above the numbers) */}
      {hasLabel ? (
        <text
          x={cx}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: centerLabelFontSize, fontWeight: 700, fill: "#6b7280", letterSpacing: 0.2 }}
          pointerEvents="none"
        >
          {centerLabel}
        </text>
      ) : null}

      {/* CENTER TOP (numbers/range) */}
      <text
        x={cx}
        y={topY}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontSize: centerTopFontSize, fontWeight: 800, fill: "#111827" }}
        pointerEvents="none"
      >
        {centerTopText}
      </text>

      {/* CENTER BOTTOM (hover label or percent) */}
      <text
        x={cx}
        y={bottomY}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontSize: centerBottomFontSize, fontWeight: 500, fill: "#6b7280" }}
        pointerEvents="none"
      >
        {centerBottomText}
      </text>
    </svg>
  );
}
