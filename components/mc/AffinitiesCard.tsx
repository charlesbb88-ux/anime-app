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
  const topAffinities = affinities.slice(0, 4);

  return (
    <div className="rounded-md border-2 border-black bg-white px-4 py-2 text-black">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-black">
          Affinities
        </div>
        <button
          type="button"
          className="text-xs font-medium text-black transition hover:text-black/70"
        >
          View All
        </button>
      </div>

      {topAffinities.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-black bg-white/20 p-4 text-sm text-black">
          No affinities yet.
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {topAffinities.map((affinity) => {
            const percent = safeNumber(affinity.progress_percent);
            const xp = safeNumber(affinity.tag_xp);

            return (
              <div
                key={affinity.tag_id}
                className="rounded-2xl border border-black bg-white/20 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-black">{affinity.tag_name}</div>
                    <div className="text-xs text-black">XP: {xp.toFixed(2)}</div>
                  </div>

                  <div className="rounded-lg border border-black bg-white/20 px-3 py-1 text-xs font-semibold text-black">
                    Lv {safeNumber(affinity.tag_level, 1)}
                  </div>
                </div>

                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full border border-black bg-black/10">
                  <div
                    className="h-full rounded-full bg-black"
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