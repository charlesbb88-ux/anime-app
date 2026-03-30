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
    <div className="rounded-md border-2 border-black bg-white px-4 py-2 text-black">
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-black">
        Combat Stats
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2">
        {stats.map((stat) => (
          <div
            key={stat.stat_key}
            className="rounded-2xl border border-black bg-white/20 px-4 py-2"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-black">
                {stat.display_name}
              </div>

              <div className="text-2xl font-bold text-black">
                {stat.stat_value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}