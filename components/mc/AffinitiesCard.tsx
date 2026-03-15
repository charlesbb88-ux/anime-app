"use client";

export type AffinityRow = {
  tag_id: number;
  tag_name: string;
  tag_level: number;
  tag_xp: number;
  progress_percent: number;
};

type Props = {
  affinities: AffinityRow[];
};

function safeNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default function AffinitiesCard({ affinities }: Props) {
  const topAffinities = affinities.slice(0, 5);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-[0.2em] text-white/45">
          Affinities
        </div>
        <button
          type="button"
          className="text-xs font-medium text-white/55 transition hover:text-white"
        >
          View All
        </button>
      </div>

      {topAffinities.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
          No affinities yet.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {topAffinities.map((affinity) => {
            const percent = safeNumber(affinity.progress_percent);
            const xp = safeNumber(affinity.tag_xp);

            return (
              <div
                key={affinity.tag_id}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{affinity.tag_name}</div>
                    <div className="text-xs text-white/45">XP: {xp.toFixed(2)}</div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold">
                    Lv {safeNumber(affinity.tag_level, 1)}
                  </div>
                </div>

                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-white"
                    style={{
                      width: `${Math.max(0, Math.min(100, percent))}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}