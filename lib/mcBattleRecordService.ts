import { supabase } from "@/lib/supabaseClient";

export type McBattleRecord = {
  user_id: string;
  wins: number;
  losses: number;
  draws: number;
  total_battles: number;
  current_win_streak: number;
  current_loss_streak: number;
  best_win_streak: number;
  best_loss_streak: number;
  last_result: string | null;
  last_battle_at: string | null;
  updated_at: string;
  win_rate: number;
};

function safeNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function getUserMcBattleRecord(userId: string): Promise<McBattleRecord> {
  const { data, error } = await supabase
    .from("user_mc_battle_stats")
    .select(`
      user_id,
      wins,
      losses,
      draws,
      total_battles,
      current_win_streak,
      current_loss_streak,
      best_win_streak,
      best_loss_streak,
      last_result,
      last_battle_at,
      updated_at
    `)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const wins = safeNumber(data?.wins, 0);
  const losses = safeNumber(data?.losses, 0);
  const draws = safeNumber(data?.draws, 0);
  const totalBattles = safeNumber(data?.total_battles, 0);

  return {
    user_id: data?.user_id ?? userId,
    wins,
    losses,
    draws,
    total_battles: totalBattles,
    current_win_streak: safeNumber(data?.current_win_streak, 0),
    current_loss_streak: safeNumber(data?.current_loss_streak, 0),
    best_win_streak: safeNumber(data?.best_win_streak, 0),
    best_loss_streak: safeNumber(data?.best_loss_streak, 0),
    last_result: data?.last_result ?? null,
    last_battle_at: data?.last_battle_at ?? null,
    updated_at: data?.updated_at ?? new Date(0).toISOString(),
    win_rate: totalBattles > 0 ? (wins / totalBattles) * 100 : 0,
  };
}