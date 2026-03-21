import { supabase } from "@/lib/supabaseClient";
import { buildMcBattleSnapshot } from "@/lib/buildMcBattleSnapshot";
import { simulateMcBattle } from "@/lib/simulateMcBattle";

type CreateMcBattleResult = {
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

  const challengerSnapshot = await buildMcBattleSnapshot(challengerUserId);
  const defenderSnapshot = await buildMcBattleSnapshot(defenderUserId);

  const sim = simulateMcBattle(challengerSnapshot, defenderSnapshot);

  const rngSeed = crypto.randomUUID();

  const { data, error } = await supabase
    .from("mc_battles")
    .insert({
      challenger_user_id: challengerUserId,
      defender_user_id: defenderUserId,
      status: "resolved",
      winner_user_id: sim.winnerUserId,
      ruleset_version: 1,
      replay_version: 1,
      rng_seed: rngSeed,
      challenger_snapshot: challengerSnapshot,
      defender_snapshot: defenderSnapshot,
      battle_result: sim.battleResult,
      replay_data: sim.replayData,
      resolved_at: new Date().toISOString(),
    })
    .select(
      `
      id,
      challenger_user_id,
      defender_user_id,
      status,
      winner_user_id,
      battle_result,
      replay_data,
      created_at,
      resolved_at
    `
    )
    .single();

  if (error) {
    throw error;
  }

  return data as CreateMcBattleResult;
}