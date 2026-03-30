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
    <div className="rounded-md border-2 border-black bg-white px-4 py-3 text-black">
      <div className="text-xs uppercase tracking-[0.2em] text-black font-bold">
        Profile
      </div>

      <div className="mt-2 space-y-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-black bg-white/20 px-4 py-2">
            <div className="text-xs uppercase tracking-wide text-black">Level</div>
            <div className="mt-2 text-3xl font-bold text-black">
              {safeNumber(accountLevel, 1)}
            </div>
          </div>

          <div className="rounded-2xl border border-black bg-white/20 px-4 py-2">
            <div className="text-xs uppercase tracking-wide text-black">XP</div>
            <div className="mt-2 text-3xl font-bold text-black">
              {safeNumber(accountXp, 0)}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-black bg-white/20 px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-black">Progress to next level</span>
            <span className="text-sm font-semibold text-black">
              {percent.toFixed(2)}%
            </span>
          </div>

          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-black/10 border border-black">
            <div
              className="h-full rounded-full bg-black"
              style={{
                width: `${Math.max(0, Math.min(100, percent))}%`,
              }}
            />
          </div>

          <div className="mt-2 text-xs text-black">
            {into.toFixed(2)} / {needed.toFixed(2)}
          </div>
        </div>

        <div className="grid gap-2">
          <div className="rounded-2xl border border-black bg-white/20 px-4 py-2">
            <div className="text-xs uppercase tracking-wide text-black">Title</div>
            <div className="mt-2 text-lg font-semibold text-black">{title}</div>
          </div>

          <div className="rounded-2xl border border-black bg-white/20 px-4 py-2">
            <div className="text-xs uppercase tracking-wide text-black">Rank</div>
            <div className="mt-2 text-lg font-semibold text-black">{rank}</div>
          </div>
        </div>
      </div>
    </div>
  );
}