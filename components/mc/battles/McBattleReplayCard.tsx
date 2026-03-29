"use client";

import { useState } from "react";
import type { McBattleCardRow } from "@/components/mc/battles/mcBattleTypes";
import McBattleReplayStage from "@/components/mc/battles/McBattleReplayStage";

type Props = {
  battle: McBattleCardRow;
  title?: string;
  compact?: boolean;
  isActive?: boolean;
};

export default function McBattleReplayCard({
  battle,
  title,
  compact = false,
  isActive = true,
}: Props) {
  const [replayNonce, setReplayNonce] = useState(0);

  const replay = battle.replay_data?.dot_replay ?? null;

  const challengerName = battle.challenger_snapshot?.username ?? "Challenger";
  const defenderName = battle.defender_snapshot?.username ?? "Defender";

  const winnerName =
    battle.winner_user_id === battle.challenger_user_id
      ? challengerName
      : battle.winner_user_id === battle.defender_user_id
        ? defenderName
        : "Unknown";

  return (
    <div className="min-w-0 overflow-hidden rounded-sm border border-black bg-white p-1">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-black">
            {title ?? `${challengerName} vs ${defenderName}`}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setReplayNonce((prev) => prev + 1);
          }}
          className="rounded-xl border border-white/10 bg-white/10 px-1 py-2 text-xs hover:bg-white/15"
        >
          Replay
        </button>
      </div>

      <McBattleReplayStage
        battle={battle}
        isActive={isActive}
        replayNonce={replayNonce}
      />
    </div>
  );
}