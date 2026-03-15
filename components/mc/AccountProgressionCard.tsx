"use client";

type Props = {
  account_level: number;
  account_xp: number;
  progress_percent: number;
  progress_into_level: number;
  progress_needed_in_level: number;
};

function safeNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default function AccountProgressionCard({
  account_level,
  account_xp,
  progress_percent,
  progress_into_level,
  progress_needed_in_level,
}: Props) {
  const percent = safeNumber(progress_percent);
  const progressInto = safeNumber(progress_into_level);
  const progressNeeded = safeNumber(progress_needed_in_level);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-sm uppercase tracking-wide text-white/60">Account</div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-wide text-white/50">Level</div>
          <div className="mt-2 text-3xl font-bold">{safeNumber(account_level, 1)}</div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-wide text-white/50">XP</div>
          <div className="mt-2 text-3xl font-bold">{safeNumber(account_xp, 0)}</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-sm text-white/60">
          <span>Progress to next level</span>
          <span>{percent.toFixed(2)}%</span>
        </div>

        <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-white"
            style={{
              width: `${Math.max(0, Math.min(100, percent))}%`,
            }}
          />
        </div>

        <div className="mt-2 text-xs text-white/50">
          {progressInto.toFixed(2)} / {progressNeeded.toFixed(2)}
        </div>
      </div>
    </div>
  );
}