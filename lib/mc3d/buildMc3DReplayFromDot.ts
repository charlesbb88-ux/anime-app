import type { FighterSide, McDotReplay } from "@/lib/dot/mcDotReplayTypes";
import type { Mc3DExchange, Mc3DReplay } from "@/lib/mc3d/mc3dReplayTypes";

const APPROACH_MS = 300;
const WINDUP_MS = 220;
const RECOVERY_MS = 420;

const PRESSURE_APPROACH_MS = 120;
const PRESSURE_WINDUP_MS = 160;
const PRESSURE_RECOVERY_MS = 280;

const RESET_GAP_MS = 520;
const MIN_GAP_MS = 110;

const START_LEFT_X = -4.2;
const START_RIGHT_X = 4.2;

const CONTACT_LEFT_X = -0.55;
const CONTACT_RIGHT_X = 0.55;

const GROUNDED_PUSH = 0.75;
const PRESSURE_PUSH = 0.42;
const ATTACKER_RECOIL = 0.32;

const GROUND_Y = 0;
const LIGHT_HIT_Y = 0;
const LAUNCH_HIT_Y = 0.68;

type FighterPositions = {
  leftX: number;
  rightX: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getDirection(side: FighterSide) {
  return side === "left" ? 1 : -1;
}

function getImpactPair(attacker: FighterSide) {
  if (attacker === "left") {
    return {
      attackerContactX: CONTACT_LEFT_X,
      defenderHitX: CONTACT_RIGHT_X,
    };
  }

  return {
    attackerContactX: CONTACT_RIGHT_X,
    defenderHitX: CONTACT_LEFT_X,
  };
}

function getHitGapMs(
  previousHit: McDotReplay["hitEvents"][number] | null,
  currentHit: McDotReplay["hitEvents"][number]
) {
  if (!previousHit) return Number.POSITIVE_INFINITY;
  return currentHit.t - previousHit.t;
}

function getComboPhase(
  previousHit: McDotReplay["hitEvents"][number] | null,
  currentHit: McDotReplay["hitEvents"][number],
  index: number,
  totalHits: number
): "opener" | "pressure" | "combo_end" {
  const gap = getHitGapMs(previousHit, currentHit);

  if (gap > RESET_GAP_MS || index === 0) {
    return "opener";
  }

  if (index === totalHits - 1) {
    return "combo_end";
  }

  return "pressure";
}

function shouldLaunch(
  phase: "opener" | "pressure" | "combo_end",
  index: number,
  totalHits: number
) {
  if (totalHits <= 1) return false;
  if (phase === "pressure") return false;
  return index === totalHits - 1;
}

function getStartPositions(
  phase: "opener" | "pressure" | "combo_end",
  previousPositions: FighterPositions | null,
  attacker: FighterSide
): FighterPositions {
  if (!previousPositions || phase === "opener") {
    return {
      leftX: START_LEFT_X,
      rightX: START_RIGHT_X,
    };
  }

  const spacingTighten = phase === "pressure" ? 0.18 : 0.28;

  let leftX = previousPositions.leftX;
  let rightX = previousPositions.rightX;

  if (attacker === "left") {
    leftX = Math.min(leftX + spacingTighten, -0.95);
    rightX = Math.max(rightX - 0.08, 0.7);
  } else {
    leftX = Math.min(leftX + 0.08, -0.7);
    rightX = Math.max(rightX - spacingTighten, 0.95);
  }

  return {
    leftX,
    rightX,
  };
}

function getTiming(
  hitTimeMs: number,
  phase: "opener" | "pressure" | "combo_end",
  previousEndMs: number
) {
  const approachMs = phase === "pressure" ? PRESSURE_APPROACH_MS : APPROACH_MS;
  const windupMs = phase === "pressure" ? PRESSURE_WINDUP_MS : WINDUP_MS;
  const recoveryMs = phase === "pressure" ? PRESSURE_RECOVERY_MS : RECOVERY_MS;

  const rawStartMs = hitTimeMs - approachMs - windupMs;
  const startMs = Math.max(previousEndMs + MIN_GAP_MS, rawStartMs);
  const approachStartMs = startMs;
  const windupStartMs = startMs + approachMs;
  const impactMs = Math.max(windupStartMs + 1, hitTimeMs);
  const recoveryEndMs = impactMs + recoveryMs;

  return {
    startMs,
    approachStartMs,
    windupStartMs,
    impactMs,
    recoveryEndMs,
  };
}

function buildExchange(
  hit: McDotReplay["hitEvents"][number],
  index: number,
  totalHits: number,
  previousHit: McDotReplay["hitEvents"][number] | null,
  previousExchange: Mc3DExchange | null
): Mc3DExchange {
  const attacker = hit.attacker;
  const defender = hit.defender;
  const direction = getDirection(attacker);

  const phase = getComboPhase(previousHit, hit, index, totalHits);
  const isLauncher = shouldLaunch(phase, index, totalHits);

  const previousPositions = previousExchange
    ? {
        leftX: previousExchange.leftEndX,
        rightX: previousExchange.rightEndX,
      }
    : null;

  const startPositions = getStartPositions(phase, previousPositions, attacker);
  const timing = getTiming(
    hit.t,
    phase,
    previousExchange ? previousExchange.timing.recoveryEndMs : 0
  );

  const { attackerContactX, defenderHitX } = getImpactPair(attacker);

  const defenderPush =
    phase === "pressure" ? PRESSURE_PUSH : GROUNDED_PUSH;

  const attackerSettleX = attackerContactX - direction * ATTACKER_RECOIL;
  const defenderSettleX = defenderHitX + direction * defenderPush;

  const leftStartX = startPositions.leftX;
  const rightStartX = startPositions.rightX;

  const leftEndX =
    attacker === "left" ? attackerSettleX : defenderSettleX;
  const rightEndX =
    attacker === "right" ? attackerSettleX : defenderSettleX;

  return {
    id: `exchange_${index + 1}`,
    attacker,
    defender,
    result: "hit",
    phase,

    timing,

    leftStartX,
    rightStartX,
    leftEndX,
    rightEndX,

    motion: {
      attacker: {
        fromX: attacker === "left" ? leftStartX : rightStartX,
        contactX: attackerContactX,
        settleX: attackerSettleX,
        fromY: GROUND_Y,
        apexY: GROUND_Y,
        settleY: GROUND_Y,
      },
      defender: {
        fromX: defender === "left" ? leftStartX : rightStartX,
        hitX: defenderHitX,
        settleX: defenderSettleX,
        fromY: GROUND_Y,
        launchY: isLauncher ? LAUNCH_HIT_Y : LIGHT_HIT_Y,
        settleY: GROUND_Y,
      },
    },

    clips: {
      attackerApproach: phase === "pressure" ? "idle" : "run",
      attackerWindup: "attack",
      attackerRecovery: "idle",
      defenderPreImpact: "idle",
      defenderOnImpact: "hit",
      defenderRecovery: "idle",
    },

    damage: Math.max(1, Math.round(hit.damage)),
    defenderHpAfter: 0,
    isLauncher,
  };
}

export function buildMc3DReplayFromDot(replay: McDotReplay): Mc3DReplay {
  const exchanges: Mc3DExchange[] = [];

  let previousHit: McDotReplay["hitEvents"][number] | null = null;
  let previousExchange: Mc3DExchange | null = null;

  for (let i = 0; i < replay.hitEvents.length; i += 1) {
    const hit = replay.hitEvents[i];

    const exchange = buildExchange(
      hit,
      i,
      replay.hitEvents.length,
      previousHit,
      previousExchange
    );

    exchanges.push(exchange);
    previousHit = hit;
    previousExchange = exchange;
  }

  const durationFromExchanges =
    exchanges.length > 0
      ? exchanges[exchanges.length - 1].timing.recoveryEndMs
      : replay.durationMs;

  return {
    version: 2,
    durationMs: Math.max(replay.durationMs, durationFromExchanges),
    winner: replay.winner,
    exchanges,
  };
}