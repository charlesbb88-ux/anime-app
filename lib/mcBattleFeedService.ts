import { supabase } from "@/lib/supabaseClient";
import type { McBattleCardRow } from "@/components/mc/battles/mcBattleTypes";

type GetUserBattlesParams = {
  userId: string;
  limit: number;
  offset?: number;
};

export async function getUserBattles({
  userId,
  limit,
  offset = 0,
}: GetUserBattlesParams): Promise<McBattleCardRow[]> {
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
    .or(`challenger_user_id.eq.${userId},defender_user_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return (data ?? []) as McBattleCardRow[];
}