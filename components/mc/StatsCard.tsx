"use client";

const stats = [
  { label: "ATK", value: 0 },
  { label: "DEF", value: 0 },
  { label: "SPD", value: 0 },
  { label: "INT", value: 0 },
  { label: "END", value: 0 },
  { label: "LUK", value: 0 },
];

export default function StatsCard() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="text-xs uppercase tracking-[0.2em] text-white/45">Base Stats</div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <div className="text-xs uppercase tracking-wide text-white/45">
              {stat.label}
            </div>
            <div className="mt-2 text-2xl font-bold">{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}