import { buildMcBattleSnapshot } from "@/lib/buildMcBattleSnapshot";
import { simulateMcBattle } from "@/lib/simulateMcBattle";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type CreateMcBattleResult = {
  id: string;
  challenger_user_id: string;
  defender_user_id: string;
  status: string;
  winner_user_id: string | null;
  battle_result: unknown;
  replay_data: unknown;
  created_at: string;
  resolved_at: string | null;
};

export async function createMcBattleServer(
  challengerUserId: string,
  defenderUserId: string
): Promise<CreateMcBattleResult> {
  if (!challengerUserId) {
    throw new Error("Missing challenger user id.");
  }

  if (!defenderUserId) {
    throw new Error("Missing defender user id.");
  }

  if (challengerUserId === defenderUserId) {
    throw new Error("Challenger and defender cannot be the same user.");
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

  return {
    id: battleRow.id,
    challenger_user_id: battleRow.challenger_user_id,
    defender_user_id: battleRow.defender_user_id,
    status: battleRow.status,
    winner_user_id: battleRow.winner_user_id,
    battle_result: battleRow.battle_result,
    replay_data: battleRow.replay_data,
    created_at: battleRow.created_at,
    resolved_at: battleRow.resolved_at,
  };
}

export async function createMcBattle(
  challengerUserId: string,
  defenderUserId: string
): Promise<CreateMcBattleResult> {
  if (!challengerUserId) {
    throw new Error("Missing challenger user id.");
  }

  if (!defenderUserId) {
    throw new Error("Missing defender user id.");
  }

  if (challengerUserId === defenderUserId) {
    throw new Error("Challenger and defender cannot be the same user.");
  }

  const response = await fetch("/api/mc/create-battle", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      challengerUserId,
      defenderUserId,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to create battle.");
  }

  return payload as CreateMcBattleResult;
}