"use client";

type CombatStatRow = {
  stat_key: string;
  display_name: string;
  sort_order: number;
  account_level: number;
  stat_value: number;
};

type CombatStatsCardProps = {
  stats: CombatStatRow[];
};

export default function CombatStatsCard({ stats }: CombatStatsCardProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="text-xs uppercase tracking-[0.2em] text-white/45">
        Combat Stats
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.stat_key}
            className="rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-white/75">
                {stat.display_name}
              </div>

              <div className="text-2xl font-bold text-white">
                {stat.stat_value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}