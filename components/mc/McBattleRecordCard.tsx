"use client";

import type { McBattleRecord } from "@/lib/mcBattleRecordService";

type Props = {
  record: McBattleRecord;
};

export default function McBattleRecordCard({ record }: Props) {
  return (
    <div className="rounded-md border border-white/10 bg-black px-4 py-3">
      <div className="text-xs uppercase tracking-[0.2em] text-white/45">
        Battle Record
      </div>

      <div className="mt-2 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2">
          <div className="text-xs uppercase tracking-wide text-white/45">Wins</div>
          <div className="mt-2 text-3xl font-bold text-green-400">
            {record.wins}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2">
          <div className="text-xs uppercase tracking-wide text-white/45">Losses</div>
          <div className="mt-2 text-3xl font-bold text-red-400">
            {record.losses}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2">
          <div className="text-xs uppercase tracking-wide text-white/45">Total</div>
          <div className="mt-2 text-3xl font-bold text-white">
            {record.total_battles}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-white/65">Win Rate</span>
            <span className="text-sm font-semibold">
              {record.win_rate.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-white/65">Current Win Streak</span>
            <span className="text-sm font-semibold">
              {record.current_win_streak}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-white/65">Best Win Streak</span>
            <span className="text-sm font-semibold">
              {record.best_win_streak}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}