import React from "react";

type Props = {
  current: number;
  total: number;
  size?: number; // px
  stroke?: number; // px
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export default function ProgressRing({ current, total, size = 120, stroke = 10 }: Props) {
  const safeTotal = Math.max(0, total);
  const safeCurrent = clamp(current, 0, safeTotal);

  const pct = safeTotal === 0 ? 0 : safeCurrent / safeTotal;

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (1 - pct);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="block">
        {/* track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(0,0,0,0.15)"
          strokeWidth={stroke}
        />
        {/* progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(0,0,0,0.85)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={dash}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>

      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="text-sm font-semibold text-slate-900">
            {safeCurrent} <span className="text-slate-500">of</span> {safeTotal}
          </div>
          <div className="text-[11px] text-slate-600">{Math.round(pct * 100)}%</div>
        </div>
      </div>
    </div>
  );
}
