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

export type McBattlePaperDollSnapshot = {
  body: string;
  eyes: string | null;
  hair: string | null;
  torso: string | null;
  bottoms: string | null;
  feet: string | null;
  hands: string | null;
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
  paperdoll: McBattlePaperDollSnapshot;
  equipped_abilities: McBattleEquippedAbilitySnapshot[];
};