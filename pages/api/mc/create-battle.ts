import type { NextApiRequest, NextApiResponse } from "next";
import { buildMcBattleSnapshot } from "@/lib/buildMcBattleSnapshot";
import { simulateMcBattle } from "@/lib/simulateMcBattle";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ApiResponse =
  | {
      id: string;
      challenger_user_id: string;
      defender_user_id: string;
      status: string;
      winner_user_id: string | null;
      battle_result: unknown;
      replay_data: unknown;
      created_at: string;
      resolved_at: string | null;
    }
  | { error: string };

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const challengerUserId = asNonEmptyString(req.body?.challengerUserId);
    const defenderUserId = asNonEmptyString(req.body?.defenderUserId);

    if (!challengerUserId) {
      return res.status(400).json({ error: "Missing challenger user id." });
    }

    if (!defenderUserId) {
      return res.status(400).json({ error: "Missing defender user id." });
    }

    if (challengerUserId === defenderUserId) {
      return res
        .status(400)
        .json({ error: "Challenger and defender cannot be the same user." });
    }

    const challengerSnapshot = await buildMcBattleSnapshot(challengerUserId);
    const defenderSnapshot = await buildMcBattleSnapshot(defenderUserId);

    const sim = simulateMcBattle(challengerSnapshot, defenderSnapshot);
    const rngSeed = crypto.randomUUID();
    const resolvedAt = new Date().toISOString();

    const { data, error } = await supabaseAdmin.rpc(
      "insert_mc_battle_and_update_stats",
      {
        p_challenger_user_id: challengerUserId,
        p_defender_user_id: defenderUserId,
        p_status: "resolved",
        p_winner_user_id: sim.winnerUserId,
        p_ruleset_version: 1,
        p_replay_version: 1,
        p_rng_seed: rngSeed,
        p_challenger_snapshot: challengerSnapshot,
        p_defender_snapshot: defenderSnapshot,
        p_battle_result: sim.battleResult,
        p_replay_data: sim.replayData,
        p_resolved_at: resolvedAt,
      }
    );

    if (error) {
      throw error;
    }

    const battleRow = Array.isArray(data) ? data[0] : data;

    if (!battleRow) {
      throw new Error("Battle insert returned no row.");
    }

    return res.status(200).json({
      id: battleRow.id,
      challenger_user_id: battleRow.challenger_user_id,
      defender_user_id: battleRow.defender_user_id,
      status: battleRow.status,
      winner_user_id: battleRow.winner_user_id,
      battle_result: battleRow.battle_result,
      replay_data: battleRow.replay_data,
      created_at: battleRow.created_at,
      resolved_at: battleRow.resolved_at,
    });
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: e?.message ?? "Failed to create battle." });
  }
}