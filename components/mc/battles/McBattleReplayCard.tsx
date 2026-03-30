"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useMcBattleRecord } from "@/hooks/useMcBattleRecord";
import type { McBattleCardRow } from "@/components/mc/battles/mcBattleTypes";
import McBattleReplayStage from "@/components/mc/battles/McBattleReplayStage";

type Props = {
  battle: McBattleCardRow;
  title?: string;
  compact?: boolean;
  isActive?: boolean;
};

type AccountMini = {
  level: number;
  xp: number;
};

function safeNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function getAccountMini(userId: string): Promise<AccountMini> {
  const { data, error } = await supabase.rpc("get_account_progression", {
    p_user_id: userId,
  });

  if (error) throw error;

  const row = ((data as any[]) ?? [])[0] ?? null;

  return {
    level: safeNumber(row?.account_level, 1),
    xp: safeNumber(row?.account_xp, 0),
  };
}

export default function McBattleReplayCard({
  battle,
  title,
  compact = false,
  isActive = true,
}: Props) {
  const [replayNonce, setReplayNonce] = useState(0);

  const challengerId = battle.challenger_user_id;
  const defenderId = battle.defender_user_id;

  const challengerName =
    battle.challenger_snapshot?.username ?? "Challenger";
  const defenderName =
    battle.defender_snapshot?.username ?? "Defender";

  const winnerName =
    battle.winner_user_id === challengerId
      ? challengerName
      : battle.winner_user_id === defenderId
      ? defenderName
      : "Unknown";

  // =========================
  // RECORDS
  // =========================
  const { record: challengerRecord } = useMcBattleRecord(challengerId);
  const { record: defenderRecord } = useMcBattleRecord(defenderId);

  // =========================
  // LEVEL + XP
  // =========================
  const [challengerAccount, setChallengerAccount] =
    useState<AccountMini | null>(null);
  const [defenderAccount, setDefenderAccount] =
    useState<AccountMini | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [c, d] = await Promise.all([
          getAccountMini(challengerId),
          getAccountMini(defenderId),
        ]);

        if (!cancelled) {
          setChallengerAccount(c);
          setDefenderAccount(d);
        }
      } catch (e) {
        // fail silently for now
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [challengerId, defenderId]);

  return (
    <div className="min-w-0 overflow-hidden rounded-sm border border-black bg-white p-2">
      {/* HEADER */}
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="text-sm font-semibold text-black">
          {title ?? `${challengerName} vs ${defenderName}`}
        </div>

        <button
          type="button"
          onClick={() => setReplayNonce((prev) => prev + 1)}
          className="rounded-xl border border-black/10 px-2 py-1 text-xs hover:bg-black/5"
        >
          Replay
        </button>
      </div>

      {/* USER INFO ROW */}
      <div className="mb-2 grid grid-cols-2 gap-3 text-xs text-black">
        {/* LEFT (CHALLENGER) */}
        <div>
          <div className="font-semibold">{challengerName}</div>

          <div className="text-black/70">
            W {challengerRecord?.wins ?? 0} / L{" "}
            {challengerRecord?.losses ?? 0}
          </div>

          <div className="text-black/70">
            Lv {challengerAccount?.level ?? "-"} • XP{" "}
            {challengerAccount?.xp ?? "-"}
          </div>

          <div className="text-black/50">
            Title: Wanderer
          </div>
        </div>

        {/* RIGHT (DEFENDER) */}
        <div className="text-right">
          <div className="font-semibold">{defenderName}</div>

          <div className="text-black/70">
            W {defenderRecord?.wins ?? 0} / L{" "}
            {defenderRecord?.losses ?? 0}
          </div>

          <div className="text-black/70">
            Lv {defenderAccount?.level ?? "-"} • XP{" "}
            {defenderAccount?.xp ?? "-"}
          </div>

          <div className="text-black/50">
            Title: Wanderer
          </div>
        </div>
      </div>

      {/* STAGE */}
      <McBattleReplayStage
        battle={battle}
        isActive={isActive}
        replayNonce={replayNonce}
      />
    </div>
  );
}