"use client";

import type { McBattleRecord } from "@/lib/mcBattleRecordService";

type Props = {
  record: McBattleRecord;
};

export default function McBattleRecordCard({ record }: Props) {
  return (
    <div className="rounded-md border-2 border-black bg-white px-4 py-3 text-black">
      <div className="text-xs uppercase tracking-[0.2em] text-black font-bold">
        Battle Record
      </div>

      <div className="mt-2 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-black bg-white/20 px-4 py-2">
          <div className="text-xs uppercase tracking-wide text-black">Wins</div>
          <div className="mt-2 text-3xl font-bold text-green-400">
            {record.wins}
          </div>
        </div>

        <div className="rounded-2xl border border-black bg-white/20 px-4 py-2">
          <div className="text-xs uppercase tracking-wide text-black">Losses</div>
          <div className="mt-2 text-3xl font-bold text-red-400">
            {record.losses}
          </div>
        </div>

        <div className="rounded-2xl border border-black bg-white/20 px-4 py-2">
          <div className="text-xs uppercase tracking-wide text-black">Total</div>
          <div className="mt-2 text-3xl font-bold text-black">
            {record.total_battles}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        <div className="rounded-2xl border border-black bg-white/20 px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-black">Win Rate</span>
            <span className="text-sm font-semibold text-black">
              {record.win_rate.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-black bg-white/20 px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-black">Current Win Streak</span>
            <span className="text-sm font-semibold text-black">
              {record.current_win_streak}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-black bg-white/20 px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-black">Best Win Streak</span>
            <span className="text-sm font-semibold text-black">
              {record.best_win_streak}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}