import type { McDotReplay } from "@/lib/dot/mcDotReplayTypes";
import type { McPaperDollLoadout } from "@/components/mc/paperdoll/mcPaperDollTypes";

export type McBattleCardRow = {
  id: string;
  challenger_user_id: string;
  defender_user_id: string;
  winner_user_id: string | null;
  created_at?: string;
  battle_result: unknown;
  replay_data: {
    replay_kind?: string;
    fighter_side_map?: {
      left?: string;
      right?: string;
    };
    dot_replay?: McDotReplay | null;
  } | null;
  challenger_snapshot?: {
    username?: string;
    paperdoll?: McPaperDollLoadout | null;
    combat_stats?: {
      hp?: number | null;
    } | null;
  } | null;
  defender_snapshot?: {
    username?: string;
    paperdoll?: McPaperDollLoadout | null;
    combat_stats?: {
      hp?: number | null;
    } | null;
  } | null;
};