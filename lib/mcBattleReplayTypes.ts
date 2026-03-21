export type McBattleSide = "challenger" | "defender";

export type McBattleActionType = "basic_attack";

export type McBattleTimelineEvent = {
  step: number;
  actor_side: McBattleSide;
  target_side: McBattleSide;
  action_type: McBattleActionType;
  damage: number;
  target_hp_after: number;
};

export type McBattleReplayData = {
  timeline: McBattleTimelineEvent[];
};

export type McBattleResult = {
  winner_user_id: string;
  loser_user_id: string;
  total_turns: number;
  finished_by: McBattleActionType;
  final_hp: {
    challenger: number;
    defender: number;
  };
};