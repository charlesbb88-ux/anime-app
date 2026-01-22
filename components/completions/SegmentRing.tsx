"use client";

import React, { useMemo } from "react";

type Props = {
  current: number;
  total: number;

  // Visual tuning (optional)
  size?: number;          // px
  stroke?: number;        // thickness
  segments?: number;      // how many blocks around the circle
  gapDegrees?: number;    // gap between blocks (in degrees)
  rounded?: boolean;      // rounded ends on each block
  className?: string;

  // Colors
  filledColor?: string;   // single color for completed blocks
  emptyColor?: string;    // color for incomplete blocks
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export default function SegmentRing({
  current,
  total,
  size = 140,
  stroke = 12,
  segments = 18,
  gapDegrees = 6,
  rounded = true,
  className = "",
  filledColor = "#22c55e", // green-500
  emptyColor = "#d1d5db",  // gray-300
}: Props) {
  const pct = total > 0 ? clamp(current / total, 0, 1) : 0;

  // how many segments are "on"
  const filledSegments = useMemo(() => {
    // Round to nearest segment. If you want "floor" instead, change Math.round -> Math.floor
    return clamp(Math.round(pct * segments), 0, segments);
  }, [pct, segments]);

  // SVG circle math
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  // Each segment occupies (arcLength - gapLength)
  const gapLen = (gapDegrees / 360) * circumference;
  const segLen = circumference / segments;
  const dashOn = Math.max(0, segLen - gapLen);
  const dashOff = Math.max(0, gapLen);

  // dasharray pattern repeats around the circle
  const dashArray = `${dashOn} ${dashOff}`;

  // Make only the first N segments visible by limiting dashoffset
  // Trick: We draw a full segmented circle in "emptyColor", then overlay another one in "filledColor"
  // and hide the remaining segments by pushing the dashes forward.
  const filledDashOffset = useMemo(() => {
    // How many segments remain unfilled
    const remaining = segments - filledSegments;

    // Move pattern so that remaining segments are "skipped" at the end
    // Offset in terms of segment length
    return remaining * segLen;
  }, [segments, filledSegments, segLen]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label="Progress"
    >
      {/* Rotate so it starts at top (12 o'clock) */}
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {/* Empty segmented ring */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={emptyColor}
          strokeWidth={stroke}
          strokeLinecap={rounded ? "round" : "butt"}
          strokeDasharray={dashArray}
        />

        {/* Filled segmented ring overlay */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={filledColor}
          strokeWidth={stroke}
          strokeLinecap={rounded ? "round" : "butt"}
          strokeDasharray={dashArray}
          strokeDashoffset={filledDashOffset}
        />
      </g>
    </svg>
  );
}
