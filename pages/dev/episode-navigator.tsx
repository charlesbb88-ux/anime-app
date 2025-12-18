// pages/dev/episode-navigator.tsx
"use client";

import { useMemo, useState } from "react";

/* =======================
   Types + Utils
======================= */

type Item = {
  key: string;
  label: string;
  rating: number; // 0..5
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function StarRow({ rating, size = 10 }: { rating: number; size?: number }) {
  const r = clamp(Math.round(rating), 0, 5);
  return (
    <div className="flex items-center gap-[1px]" aria-label={`${r} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          style={{ fontSize: size }}
          className={i < r ? "text-yellow-300" : "text-gray-700"}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function Card({
  active,
  title,
  rating,
  onClick,
}: {
  active?: boolean;
  title: string;
  rating: number;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-lg border text-left shadow-sm",
        "px-2 py-1.5",
        active
          ? "border-blue-400 bg-blue-500/15"
          : "border-gray-800 bg-gray-950/50 hover:bg-gray-950/70",
      ].join(" ")}
      style={{ width: 78 }}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-semibold text-gray-100">
          {title}
        </span>
        <span className="text-[10px] text-gray-400">{rating}★</span>
      </div>

      <div className="mt-1">
        <StarRow rating={rating} size={10} />
      </div>
    </button>
  );
}

/* =======================
   Page
======================= */

export default function DevEpisodeNavigatorPage() {
  const items: Item[] = useMemo(
    () => [
      { key: "series", label: "Series", rating: 3 },
      { key: "ep-1", label: "E1", rating: 2 },
      { key: "ep-2", label: "E2", rating: 5 },
      { key: "ep-3", label: "E3", rating: 3 },
      { key: "ep-4", label: "E4", rating: 1 },
      { key: "ep-5", label: "E5", rating: 4 },
      { key: "ep-6", label: "E6", rating: 2 },
      { key: "ep-7", label: "E7", rating: 5 },
      { key: "ep-8", label: "E8", rating: 3 },
      { key: "ep-9", label: "E9", rating: 0 },
      { key: "ep-10", label: "E10", rating: 4 },
    ],
    []
  );

  const series = items[0];
  const [activeKey, setActiveKey] = useState<string>("series");

  /* =======================
     Layout Math
  ======================= */

  const laneHeight = 190;
  const pad = 12;
  const minY = pad;
  const maxY = laneHeight - pad;

  const yFromRating = (rating: number) => {
    const r = clamp(rating, 0, 5);
    const t = 1 - r / 5;
    return minY + t * (maxY - minY);
  };

  const baselineY = yFromRating(series.rating);

  /* =======================
     Render
  ======================= */

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-100">
        Episode Navigator — Wave Rail
      </h1>
      <p className="mt-1 text-sm text-gray-400">
        Episodes rise or fall relative to the series.
      </p>

      <section className="mt-6 rounded-2xl border border-gray-800 bg-gray-950/60 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-200">
            Wave Rail
          </h2>
          <span className="text-xs text-gray-500">
            {series.rating}★
          </span>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-gray-800 bg-black/30 p-4">
          {/* baseline */}
          <div
            className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-gray-700"
            style={{ top: baselineY }}
          />

          {/* wave rail */}
          <div
            className="relative"
            style={{
              height: laneHeight,
              display: "grid",
              gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
              gap: "10px",
            }}
          >
            {/* SVG wave */}
            <div className="pointer-events-none absolute inset-0">
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${items.length * 100} ${laneHeight}`}
                preserveAspectRatio="none"
              >
                <path
                  d={items
                    .map((it, idx) => {
                      const x = idx * 100 + 50;
                      const y = yFromRating(it.rating);
                      if (idx === 0) return `M ${x} ${y}`;
                      const px = (idx - 1) * 100 + 50;
                      const py = yFromRating(items[idx - 1].rating);
                      const cx = (px + x) / 2;
                      const cy = (py + y) / 2;
                      return `Q ${px} ${py} ${cx} ${cy} T ${x} ${y}`;
                    })
                    .join(" ")}
                  fill="none"
                  stroke="rgba(59,130,246,0.4)"
                  strokeWidth="2"
                />
              </svg>
            </div>

            {items.map((it) => {
              const active = it.key === activeKey;
              const y = yFromRating(it.rating);

              return (
                <div
                  key={it.key}
                  className="relative flex items-center justify-center"
                >
                  {/* wave dot */}
                  <div
                    className={[
                      "absolute left-1/2 -translate-x-1/2 rounded-full border",
                      active
                        ? "border-blue-300 bg-blue-500/30"
                        : "border-gray-700 bg-gray-900/60",
                    ].join(" ")}
                    style={{ top: y - 5, width: 10, height: 10 }}
                  />

                  {/* card */}
                  <div
                    className="absolute left-1/2 -translate-x-1/2"
                    style={{ top: y - 48 }}
                  >
                    <Card
                      active={active}
                      title={it.label}
                      rating={it.rating}
                      onClick={() => setActiveKey(it.key)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
