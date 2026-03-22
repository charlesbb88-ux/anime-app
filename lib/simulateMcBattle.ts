import type { McBattleFighterSnapshot } from "@/lib/mcBattleTypes";
import { generateMcDotReplay } from "@/lib/dot/generateMcDotReplay";
import type {
  McBattleReplayData,
  McBattleResult,
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildReplayFighterConfig(snapshot: McBattleFighterSnapshot) {
  const hp = safeNumber(snapshot.combat_stats.hp, 100);
  const attack = safeNumber(snapshot.combat_stats.attack, 10);
  const defense = safeNumber(snapshot.combat_stats.defense, 10);
  const speed = safeNumber(snapshot.combat_stats.speed, 10);

  return {
    maxHp: clamp(Math.round(hp), 40, 500),
    attack: clamp(Math.round(attack), 1, 500),
    defense: clamp(Math.round(defense), 0, 500),
    speed: clamp(Math.round(speed), 1, 500),
  };
}

export function simulateMcBattle(
  challenger: McBattleFighterSnapshot,
  defender: McBattleFighterSnapshot
): SimulateMcBattleResult {
  const replay = generateMcDotReplay({
    left: buildReplayFighterConfig(challenger),
    right: buildReplayFighterConfig(defender),
  });

  const lastFrame = replay.frames[replay.frames.length - 1];

  if (!lastFrame) {
    throw new Error("Replay generation failed: no frames were produced.");
  }

  const challengerFinalHp = lastFrame.fighters.left.hp;
  const defenderFinalHp = lastFrame.fighters.right.hp;

  const challengerWon = replay.winner === "left";
  const winnerUserId = challengerWon ? challenger.user_id : defender.user_id;
  const loserUserId = challengerWon ? defender.user_id : challenger.user_id;

  const battleResult: McBattleResult = {
    winner_user_id: winnerUserId,
    loser_user_id: loserUserId,
    total_hits: replay.hitEvents.length,
    finished_by: "hp_zero",
    duration_ms: replay.durationMs,
    final_hp: {
      challenger: challengerFinalHp,
      defender: defenderFinalHp,
    },
  };

  const replayData: McBattleReplayData = {
    replay_kind: "dot_v1",
    fighter_side_map: {
      left: "challenger",
      right: "defender",
    },
    dot_replay: replay,
  };

  return {
    winnerUserId,
    battleResult,
    replayData,
  };
}