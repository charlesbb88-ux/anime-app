"use client";

type BaseStatRow = {
  stat_key: string;
  display_name: string;
  description: string | null;
  sort_order: number;
  account_level: number;
  base_value: number;
  growth_per_level: number;
  growth_curve: string;
  stat_value: number;
};

type StatsCardProps = {
  stats: BaseStatRow[];
};

export default function StatsCard({ stats }: StatsCardProps) {
  return (
    <div className="rounded-md border border-white/10 bg-black px-4 py-2">
      <div className="text-xs uppercase tracking-[0.2em] text-white/45">
        Base Stats
      </div>

      <div className="mt-2 grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.stat_key}
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2"
          >
            <div className="text-xs uppercase tracking-wide text-white/45">
              {stat.display_name}
            </div>

            <div className="mt-2 text-2xl font-bold">
              {stat.stat_value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}