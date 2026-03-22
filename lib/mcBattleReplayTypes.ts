import type { McDotReplay } from "@/lib/dot/mcDotReplayTypes";

export type McBattleReplayData = {
  replay_kind: "dot_v1";
  fighter_side_map: {
    left: "challenger";
    right: "defender";
  };
  dot_replay: McDotReplay;
};

export type McBattleResult = {
  winner_user_id: string;
  loser_user_id: string;
  total_hits: number;
  finished_by: "hp_zero";
  duration_ms: number;
  final_hp: {
    challenger: number;
    defender: number;
  };
};