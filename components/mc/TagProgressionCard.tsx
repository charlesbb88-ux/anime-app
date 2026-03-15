"use client";

type Props = {
  tag_id: number;
  tag_name: string;
  tag_level: number;
  tag_xp: number;
  progress_into_level: number;
  progress_needed_in_level: number;
  progress_percent: number;
};

function safeNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default function TagProgressionCard({
  tag_id,
  tag_name,
  tag_level,
  tag_xp,
  progress_into_level,
  progress_needed_in_level,
  progress_percent,
}: Props) {
  const xp = safeNumber(tag_xp);
  const progressInto = safeNumber(progress_into_level);
  const progressNeeded = safeNumber(progress_needed_in_level);
  const percent = safeNumber(progress_percent);

  return (
    <div
      key={tag_id}
      className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-semibold">{tag_name}</div>
          <div className="text-sm text-white/50">XP: {xp.toFixed(2)}</div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold">
          Lv {safeNumber(tag_level, 1)}
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-2 flex items-center justify-between text-xs text-white/50">
          <span>Progress to next level</span>
          <span>{percent.toFixed(2)}%</span>
        </div>

        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-white"
            style={{
              width: `${Math.max(0, Math.min(100, percent))}%`,
            }}
          />
        </div>

        <div className="mt-2 text-xs text-white/40">
          {progressInto.toFixed(2)} / {progressNeeded.toFixed(2)}
        </div>
      </div>
    </div>
  );
}