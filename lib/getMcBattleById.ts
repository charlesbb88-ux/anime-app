import { supabase } from "@/lib/supabaseClient";
import type { McBattleCardRow } from "@/components/mc/battles/mcBattleTypes";

export async function getMcBattleById(
  battleId: string
): Promise<McBattleCardRow | null> {
  const trimmedBattleId = battleId.trim();

  if (!trimmedBattleId) {
    throw new Error("Missing battle id.");
  }

  const { data, error } = await supabase
    .from("mc_battles")
    .select(`
      id,
      challenger_user_id,
      defender_user_id,
      winner_user_id,
      created_at,
      battle_result,
      replay_data,
      challenger_snapshot,
      defender_snapshot
    `)
    .eq("id", trimmedBattleId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as McBattleCardRow | null) ?? null;
}