import type { McBattleFighterSnapshot } from "@/lib/mcBattleTypes";
import type {
  McBattleReplayData,
  McBattleResult,
  McBattleSide,
  McBattleTimelineEvent,
} from "@/lib/mcBattleReplayTypes";

type SimulateMcBattleResult = {
  winnerUserId: string;
  battleResult: McBattleResult;
  replayData: McBattleReplayData;
};

function safeNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function calculateBasicAttackDamage(
  attacker: McBattleFighterSnapshot,
  defender: McBattleFighterSnapshot
) {
  const attack = safeNumber(attacker.combat_stats.attack, 0);
  const defense = safeNumber(defender.combat_stats.defense, 0);

  return Math.max(1, attack - Math.floor(defense / 2));
}

export function simulateMcBattle(
  challenger: McBattleFighterSnapshot,
  defender: McBattleFighterSnapshot
): SimulateMcBattleResult {
  let challengerHp = safeNumber(challenger.combat_stats.hp, 0);
  let defenderHp = safeNumber(defender.combat_stats.hp, 0);

  const challengerSpeed = safeNumber(challenger.combat_stats.speed, 0);
  const defenderSpeed = safeNumber(defender.combat_stats.speed, 0);

  const timeline: McBattleTimelineEvent[] = [];

  const firstSide: McBattleSide =
    challengerSpeed >= defenderSpeed ? "challenger" : "defender";

  let activeSide: McBattleSide = firstSide;
  let step = 1;

  while (challengerHp > 0 && defenderHp > 0) {
    const actor = activeSide === "challenger" ? challenger : defender;
    const target = activeSide === "challenger" ? defender : challenger;

    const targetSide: McBattleSide =
      activeSide === "challenger" ? "defender" : "challenger";

    const damage = calculateBasicAttackDamage(actor, target);

    if (targetSide === "defender") {
      defenderHp = Math.max(0, defenderHp - damage);

      timeline.push({
        step,
        actor_side: activeSide,
        target_side: targetSide,
        action_type: "basic_attack",
        damage,
        target_hp_after: defenderHp,
      });
    } else {
      challengerHp = Math.max(0, challengerHp - damage);

      timeline.push({
        step,
        actor_side: activeSide,
        target_side: targetSide,
        action_type: "basic_attack",
        damage,
        target_hp_after: challengerHp,
      });
    }

    if (challengerHp <= 0 || defenderHp <= 0) {
      break;
    }

    activeSide = activeSide === "challenger" ? "defender" : "challenger";
    step += 1;
  }

  const challengerWon = challengerHp > 0;
  const winnerUserId = challengerWon ? challenger.user_id : defender.user_id;
  const loserUserId = challengerWon ? defender.user_id : challenger.user_id;

  const battleResult: McBattleResult = {
    winner_user_id: winnerUserId,
    loser_user_id: loserUserId,
    total_turns: timeline.length,
    finished_by: "basic_attack",
    final_hp: {
      challenger: challengerHp,
      defender: defenderHp,
    },
  };

  const replayData: McBattleReplayData = {
    timeline,
  };

  return {
    winnerUserId,
    battleResult,
    replayData,
  };
}