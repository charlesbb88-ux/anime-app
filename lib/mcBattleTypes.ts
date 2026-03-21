export type McBattleBaseStats = {
  strength: number;
  agility: number;
  intelligence: number;
  vitality: number;
  luck: number;
  perception: number;
  endurance: number;
  willpower: number;
  charisma: number;
};

export type McBattleCombatStats = {
  hp: number;
  attack: number;
  defense: number;
  magic_attack: number;
  speed: number;
};

export type McBattleAvatarSnapshot = {
  base_body_id: number | null;
  pose_id: number | null;
  layers: {
    asset_id: number;
    asset_key: string;
    slot_key: string;
    asset_kind: "shape" | "image";
    image_url: string | null;
    shape_data: unknown | null;
    layer_order: number;
  }[];
};

export type McBattleEquippedAbilitySnapshot = {
  ability_id: string;
  ability_key: string;
  display_name: string;
};

export type McBattleFighterSnapshot = {
  user_id: string;
  username: string;
  account_level: number;
  rank: string;
  title: string;
  base_stats: McBattleBaseStats;
  combat_stats: McBattleCombatStats;
  avatar: McBattleAvatarSnapshot;
  equipped_abilities: McBattleEquippedAbilitySnapshot[];
};