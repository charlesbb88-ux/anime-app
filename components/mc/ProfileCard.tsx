"use client";

type Props = {
  accountLevel: number;
  accountXp: number;
  progressPercent: number;
  progressIntoLevel: number;
  progressNeededInLevel: number;
  title?: string;
  rank?: string;
};

function safeNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default function ProfileCard({
  accountLevel,
  accountXp,
  progressPercent,
  progressIntoLevel,
  progressNeededInLevel,
  title = "Unranked Wanderer",
  rank = "F Rank",
}: Props) {
  const percent = safeNumber(progressPercent);
  const into = safeNumber(progressIntoLevel);
  const needed = safeNumber(progressNeededInLevel);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="text-xs uppercase tracking-[0.2em] text-white/45">
        Profile
      </div>

      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-wide text-white/45">Level</div>
            <div className="mt-2 text-3xl font-bold">{safeNumber(accountLevel, 1)}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-wide text-white/45">XP</div>
            <div className="mt-2 text-3xl font-bold">{safeNumber(accountXp, 0)}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-white/65">Progress to next level</span>
            <span className="text-sm font-semibold">{percent.toFixed(2)}%</span>
          </div>

          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white"
              style={{
                width: `${Math.max(0, Math.min(100, percent))}%`,
              }}
            />
          </div>

          <div className="mt-2 text-xs text-white/45">
            {into.toFixed(2)} / {needed.toFixed(2)}
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-wide text-white/45">Title</div>
            <div className="mt-2 text-lg font-semibold">{title}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-wide text-white/45">Rank</div>
            <div className="mt-2 text-lg font-semibold">{rank}</div>
          </div>
        </div>
      </div>
    </div>
  );
}