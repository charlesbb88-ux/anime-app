import type {
  DotAction,
  DotFighterState,
  DotReplayFrame,
  DotReplayHitEvent,
  DotReplayMetaEvent,
  FighterSide,
  McDotReplay,
} from "@/lib/dot/mcDotReplayTypes";

type ReplayFighterConfig = {
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
};

type GenerateMcDotReplayConfig = {
  left?: ReplayFighterConfig;
  right?: ReplayFighterConfig;
};

type SimFighter = {
  side: FighterSide;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: "left" | "right";
  action: DotAction;
  hp: number;

  maxHp: number;
  attackStat: number;
  defenseStat: number;
  speedStat: number;

  moveSpeedMult: number;
  airSpeedMult: number;
  cooldownMult: number;
  damageMult: number;
  defenseMult: number;

  attackCooldownMs: number;
  attackTimerMs: number;
  hitstunMs: number;
  recoverMs: number;

  intent: "idle" | "approach" | "retreat" | "jump-in" | "pressure";
  intentTimerMs: number;

  attackHasHit: boolean;
};

const FRAME_MS = 50;
const MAX_TIME_MS = 24000;
const STAGE_WIDTH = 14;
const STAGE_MIN_X = -STAGE_WIDTH / 2 + 0.45;
const STAGE_MAX_X = STAGE_WIDTH / 2 - 0.45;
const GROUND_Y = 0;

const GRAVITY_PER_STEP = 0.18;

const RUN_SPEED_MIN = 0.22;
const RUN_SPEED_MAX = 0.4;
const RETREAT_SPEED_MIN = 0.14;
const RETREAT_SPEED_MAX = 0.28;
const AIR_DRIFT_MIN = 0.14;
const AIR_DRIFT_MAX = 0.32;

const ATTACK_RANGE_MIN = 0.95;
const ATTACK_RANGE_MAX = 1.55;
const ATTACK_LUNGE_MIN = 0.18;
const ATTACK_LUNGE_MAX = 0.38;

const GROUND_HIT_RANGE_X = 1.15;
const GROUND_HIT_RANGE_Y = 0.55;

const AIR_HIT_RANGE_X = 1.05;
const AIR_HIT_RANGE_Y = 0.42;

const HIT_RADIUS = 1.08;

const MIN_SEPARATION = 0.42;
const CLOSE_RANGE = 1.4;
const MID_RANGE = 3.3;

const ENDGAME_START_MS = 12000;
const ENDGAME_RAMP_MS = 10000;
const MIN_ENDGAME_DAMAGE_BONUS = 1;
const MAX_ENDGAME_DAMAGE_BONUS = 8;

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1));
}

function chance(probability: number) {
  return Math.random() < probability;
}

function pickOne<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function normalizeStat(value: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return clamp(Math.round(n), 1, 500);
}

function getDefaultConfig(side: FighterSide): ReplayFighterConfig {
  return {
    maxHp: 100,
    attack: 12,
    defense: 10,
    speed: side === "left" ? 11 : 11,
  };
}

function createFighter(side: FighterSide, config?: ReplayFighterConfig): SimFighter {
  const finalConfig = config ?? getDefaultConfig(side);

  const maxHp = clamp(normalizeStat(finalConfig.maxHp, 100), 40, 500);
  const attackStat = normalizeStat(finalConfig.attack, 12);
  const defenseStat = normalizeStat(finalConfig.defense, 10);
  const speedStat = normalizeStat(finalConfig.speed, 10);

  const moveSpeedMult = clamp(0.82 + speedStat / 90, 0.8, 1.6);
  const airSpeedMult = clamp(0.82 + speedStat / 105, 0.8, 1.5);
  const cooldownMult = clamp(1.22 - speedStat / 140, 0.5, 1.2);
  const damageMult = clamp(0.7 + attackStat / 55, 0.65, 3);
  const defenseMult = clamp(0.7 + defenseStat / 70, 0.7, 3);

  return {
    side,
    x: side === "left" ? -4.6 : 4.6,
    y: 0,
    vx: 0,
    vy: 0,
    facing: side === "left" ? "right" : "left",
    action: "idle",
    hp: maxHp,

    maxHp,
    attackStat,
    defenseStat,
    speedStat,

    moveSpeedMult,
    airSpeedMult,
    cooldownMult,
    damageMult,
    defenseMult,

    attackCooldownMs: randInt(120, 260),
    attackTimerMs: 0,
    hitstunMs: 0,
    recoverMs: 0,

    intent: "idle",
    intentTimerMs: randInt(120, 280),

    attackHasHit: false,
  };
}

function getDistance(a: SimFighter, b: SimFighter) {
  return Math.abs(a.x - b.x);
}

function setFacing(a: SimFighter, b: SimFighter) {
  a.facing = a.x <= b.x ? "right" : "left";
  b.facing = b.x >= a.x ? "left" : "right";
}

function pushEvent(events: DotReplayMetaEvent[], event: DotReplayMetaEvent) {
  events.push(event);
}

function getEndgameFactor(nowMs: number) {
  if (nowMs <= ENDGAME_START_MS) return 0;
  return clamp((nowMs - ENDGAME_START_MS) / ENDGAME_RAMP_MS, 0, 1);
}

function chooseIntent(self: SimFighter, other: SimFighter, nowMs: number) {
  const distance = getDistance(self, other);
  const endgameFactor = getEndgameFactor(nowMs);

  if (distance > 4.8) {
    return chance(0.25) ? "jump-in" : "approach";
  }

  if (distance > MID_RANGE) {
    return pickOne<SimFighter["intent"]>([
      "approach",
      "approach",
      "jump-in",
      "pressure",
    ]);
  }

  if (distance > CLOSE_RANGE) {
    return pickOne<SimFighter["intent"]>([
      "approach",
      "pressure",
      "pressure",
      "jump-in",
      "retreat",
    ]);
  }

  if (endgameFactor > 0.45) {
    return pickOne<SimFighter["intent"]>([
      "pressure",
      "pressure",
      "pressure",
      "pressure",
      "jump-in",
    ]);
  }

  return pickOne<SimFighter["intent"]>([
    "pressure",
    "pressure",
    "pressure",
    "retreat",
    "jump-in",
  ]);
}

function startAttack(
  attacker: SimFighter,
  defender: SimFighter,
  nowMs: number,
  events: DotReplayMetaEvent[]
) {
  const endgameFactor = getEndgameFactor(nowMs);

  attacker.attackTimerMs = randInt(180, 260);
  attacker.attackCooldownMs = Math.round(
    (lerp(760, 260, endgameFactor) - rand(0, 120)) * attacker.cooldownMult
  );
  attacker.attackCooldownMs = Math.max(120, attacker.attackCooldownMs);
  attacker.attackHasHit = false;
  attacker.action = "attack";

  const direction = attacker.x <= defender.x ? 1 : -1;
  attacker.vx =
    direction *
    rand(ATTACK_LUNGE_MIN * 1.2, ATTACK_LUNGE_MAX * 1.4) *
    attacker.moveSpeedMult;

  pushEvent(events, {
    type: "attack",
    actor: attacker.side,
    target: defender.side,
    startMs: nowMs,
    endMs: nowMs + attacker.attackTimerMs,
  });
}

function maybeStartAttack(
  attacker: SimFighter,
  defender: SimFighter,
  nowMs: number,
  events: DotReplayMetaEvent[]
) {
  if (attacker.attackCooldownMs > 0) return;
  if (attacker.attackTimerMs > 0) return;
  if (attacker.hitstunMs > 0) return;

  const distance = getDistance(attacker, defender);
  const rangeBonus = clamp(attacker.speedStat / 160, 0, 0.28);
  const inAttackRange =
    distance <= rand(ATTACK_RANGE_MIN, ATTACK_RANGE_MAX) + rangeBonus;

  if (!inAttackRange) return;

  if (attacker.intent === "pressure" && chance(0.72)) {
    startAttack(attacker, defender, nowMs, events);
    return;
  }

  if (attacker.intent === "approach" && chance(0.45)) {
    startAttack(attacker, defender, nowMs, events);
    return;
  }

  if (attacker.intent === "jump-in" && attacker.y > 0.2 && chance(0.6)) {
    startAttack(attacker, defender, nowMs, events);
    return;
  }

  if (chance(0.18)) {
    startAttack(attacker, defender, nowMs, events);
  }
}

function applyIntentMotion(
  self: SimFighter,
  other: SimFighter,
  nowMs: number,
  events: DotReplayMetaEvent[]
) {
  const direction = self.x <= other.x ? 1 : -1;
  const distance = getDistance(self, other);

  if (self.intentTimerMs <= 0) {
    self.intent = chooseIntent(self, other, nowMs);
    self.intentTimerMs = randInt(140, 420);
  }

  if (self.attackTimerMs > 0 || self.hitstunMs > 0) {
    return;
  }

  if (self.y > 0.01) {
    if (self.intent === "jump-in" || self.intent === "pressure") {
      self.vx =
        direction *
        rand(AIR_DRIFT_MIN, AIR_DRIFT_MAX) *
        self.airSpeedMult;
    } else if (self.intent === "retreat") {
      self.vx =
        -direction *
        rand(AIR_DRIFT_MIN, AIR_DRIFT_MAX) *
        self.airSpeedMult;
    }
    return;
  }

  switch (self.intent) {
    case "approach": {
      if (distance > 1.1) {
        self.vx =
          direction *
          rand(RUN_SPEED_MIN, RUN_SPEED_MAX) *
          self.moveSpeedMult;
        if (self.action !== "run") {
          pushEvent(events, {
            type: "approach",
            actor: self.side,
            startMs: nowMs,
            endMs: nowMs + FRAME_MS,
          });
        }
        self.action = "run";
      } else {
        self.vx *= 0.7;
        self.action = "idle";
      }
      break;
    }

    case "retreat": {
      self.vx =
        -direction *
        rand(RETREAT_SPEED_MIN, RETREAT_SPEED_MAX) *
        self.moveSpeedMult;
      self.action = "recover";
      pushEvent(events, {
        type: "recover",
        actor: self.side,
        startMs: nowMs,
        endMs: nowMs + FRAME_MS,
      });
      break;
    }

    case "jump-in": {
      if (chance(0.55)) {
        self.vy = rand(0.85, 1.25);
        self.vx =
          direction *
          rand(0.16, 0.28) *
          self.airSpeedMult;
        self.action = "jump";
        pushEvent(events, {
          type: "jump",
          actor: self.side,
          startMs: nowMs,
          endMs: nowMs + randInt(180, 320),
        });
      } else {
        self.vx =
          direction *
          rand(RUN_SPEED_MIN, RUN_SPEED_MAX) *
          self.moveSpeedMult;
        self.action = "run";
      }
      break;
    }

    case "pressure": {
      if (distance > 1.0) {
        self.vx =
          direction *
          rand(RUN_SPEED_MIN, RUN_SPEED_MAX) *
          self.moveSpeedMult;
        self.action = "run";
      } else {
        const tinyShift = chance(0.5) ? 1 : -1;
        self.vx = tinyShift * rand(0.08, 0.22) * self.moveSpeedMult;
        self.action = chance(0.4) ? "run" : "idle";
      }
      break;
    }

    case "idle":
    default: {
      self.vx *= 0.55;
      if (Math.abs(self.vx) < 0.02) self.vx = 0;
      self.action = "idle";
      break;
    }
  }
}

function stepPhysics(self: SimFighter) {
  self.x += self.vx;
  self.y += self.vy;

  if (self.y > 0 || self.vy > 0) {
    self.vy -= GRAVITY_PER_STEP;
  }

  if (self.y <= GROUND_Y) {
    self.y = GROUND_Y;
    if (self.vy < 0) self.vy = 0;
  }

  self.x = clamp(self.x, STAGE_MIN_X, STAGE_MAX_X);

  if (self.y === 0 && self.attackTimerMs <= 0 && self.hitstunMs <= 0) {
    self.vx *= 0.8;
    if (Math.abs(self.vx) < 0.015) self.vx = 0;
  }
}

function resolveSpacing(left: SimFighter, right: SimFighter) {
  const distance = Math.abs(right.x - left.x);
  if (distance >= MIN_SEPARATION) return;

  const overlap = MIN_SEPARATION - distance;
  const push = overlap / 2;
  const direction = left.x <= right.x ? 1 : -1;

  left.x = clamp(left.x - push * direction, STAGE_MIN_X, STAGE_MAX_X);
  right.x = clamp(right.x + push * direction, STAGE_MIN_X, STAGE_MAX_X);
}

function canAttackConnect(attacker: SimFighter, defender: SimFighter) {
  const dx = Math.abs(attacker.x - defender.x);
  const dy = Math.abs(attacker.y - defender.y);

  const bothGrounded = attacker.y <= 0.08 && defender.y <= 0.08;

  const maxX = bothGrounded ? GROUND_HIT_RANGE_X : AIR_HIT_RANGE_X;
  const maxY = bothGrounded ? GROUND_HIT_RANGE_Y : AIR_HIT_RANGE_Y;

  if (dx > maxX) return false;
  if (dy > maxY) return false;

  const distance2D = Math.sqrt(dx * dx + dy * dy);
  return distance2D <= HIT_RADIUS;
}

function maybeResolveHit(
  attacker: SimFighter,
  defender: SimFighter,
  nowMs: number,
  hitEvents: DotReplayHitEvent[],
  events: DotReplayMetaEvent[]
) {
  if (attacker.attackTimerMs <= 0) return;
  if (attacker.attackHasHit) return;

  const totalAttackMs = 220;
  const attackProgress = 1 - attacker.attackTimerMs / totalAttackMs;
  const activeNow = attackProgress >= 0.18 && attackProgress <= 0.62;

  if (!activeNow) return;
  if (!canAttackConnect(attacker, defender)) return;

  attacker.attackHasHit = true;

  const endgameFactor = getEndgameFactor(nowMs);
  const damageBonus = Math.round(
    lerp(MIN_ENDGAME_DAMAGE_BONUS, MAX_ENDGAME_DAMAGE_BONUS, endgameFactor)
  );

  const baseDamage = randInt(7, 18) + damageBonus;
  const scaledDamage = Math.round(
    (baseDamage * attacker.damageMult) / defender.defenseMult
  );
  const damage = Math.max(1, scaledDamage);

  defender.hp = Math.max(0, defender.hp - damage);
  defender.hitstunMs = randInt(220, 380);
  defender.recoverMs = randInt(180, 320);
  defender.action = "hit";

  const direction = attacker.x <= defender.x ? 1 : -1;
  defender.vx = direction * rand(0.28, 0.62) * attacker.moveSpeedMult;

  if (chance(0.42)) {
    defender.vy = rand(0.3, 0.85);
  } else if (defender.y > 0.15) {
    defender.vy = Math.max(defender.vy, rand(0.14, 0.38));
  }

  hitEvents.push({
    t: nowMs,
    attacker: attacker.side,
    defender: defender.side,
    damage,
  });

  pushEvent(events, {
    type: "hit",
    actor: attacker.side,
    target: defender.side,
    startMs: nowMs,
    damage,
  });

  pushEvent(events, {
    type: "knockback",
    actor: defender.side,
    startMs: nowMs,
    endMs: nowMs + defender.hitstunMs,
  });

  if (chance(0.55)) {
    attacker.intent = "pressure";
    attacker.intentTimerMs = randInt(200, 420);
  }
}

function decrementTimers(f: SimFighter) {
  f.attackCooldownMs = Math.max(0, f.attackCooldownMs - FRAME_MS);
  f.attackTimerMs = Math.max(0, f.attackTimerMs - FRAME_MS);
  f.hitstunMs = Math.max(0, f.hitstunMs - FRAME_MS);
  f.recoverMs = Math.max(0, f.recoverMs - FRAME_MS);
  f.intentTimerMs = Math.max(0, f.intentTimerMs - FRAME_MS);
}

function snapshotFighter(f: SimFighter): DotFighterState {
  return {
    x: Number(f.x.toFixed(3)),
    y: Number(f.y.toFixed(3)),
    facing: f.facing,
    action: f.action,
    hp: f.hp,
  };
}

export function generateMcDotReplay(
  config?: GenerateMcDotReplayConfig
): McDotReplay {
  const left = createFighter("left", config?.left);
  const right = createFighter("right", config?.right);

  const frames: DotReplayFrame[] = [];
  const hitEvents: DotReplayHitEvent[] = [];
  const events: DotReplayMetaEvent[] = [];

  let nowMs = 0;

  while (nowMs <= MAX_TIME_MS && left.hp > 0 && right.hp > 0) {
    setFacing(left, right);

    const endgameFactor = getEndgameFactor(nowMs);

    if (endgameFactor > 0.55) {
      left.intent = chance(0.7) ? "pressure" : left.intent;
      right.intent = chance(0.7) ? "pressure" : right.intent;

      left.intentTimerMs = Math.min(left.intentTimerMs, 140);
      right.intentTimerMs = Math.min(right.intentTimerMs, 140);
    }

    decrementTimers(left);
    decrementTimers(right);

    if (left.hitstunMs > 0) {
      left.action = "hit";
    } else if (left.attackTimerMs > 0) {
      left.action = "attack";
    }

    if (right.hitstunMs > 0) {
      right.action = "hit";
    } else if (right.attackTimerMs > 0) {
      right.action = "attack";
    }

    if (left.hitstunMs === 0 && left.attackTimerMs === 0) {
      applyIntentMotion(left, right, nowMs, events);
    }

    if (right.hitstunMs === 0 && right.attackTimerMs === 0) {
      applyIntentMotion(right, left, nowMs, events);
    }

    maybeStartAttack(left, right, nowMs, events);
    maybeStartAttack(right, left, nowMs, events);

    stepPhysics(left);
    stepPhysics(right);

    resolveSpacing(left, right);
    setFacing(left, right);

    maybeResolveHit(left, right, nowMs, hitEvents, events);
    maybeResolveHit(right, left, nowMs, hitEvents, events);

    if (
      left.hitstunMs === 0 &&
      left.attackTimerMs === 0 &&
      left.y === 0 &&
      Math.abs(left.vx) < 0.03
    ) {
      if (left.recoverMs > 0) {
        left.action = "recover";
      } else if (left.intent === "idle") {
        left.action = "idle";
      }
    }

    if (
      right.hitstunMs === 0 &&
      right.attackTimerMs === 0 &&
      right.y === 0 &&
      Math.abs(right.vx) < 0.03
    ) {
      if (right.recoverMs > 0) {
        right.action = "recover";
      } else if (right.intent === "idle") {
        right.action = "idle";
      }
    }

    if (left.y > 0 && left.attackTimerMs === 0 && left.hitstunMs === 0) {
      left.action = "jump";
    }

    if (right.y > 0 && right.attackTimerMs === 0 && right.hitstunMs === 0) {
      right.action = "jump";
    }

    frames.push({
      t: nowMs,
      fighters: {
        left: snapshotFighter(left),
        right: snapshotFighter(right),
      },
    });

    nowMs += FRAME_MS;
  }

  const winner =
    left.hp === right.hp
      ? left.hp >= right.hp
        ? "left"
        : "right"
      : left.hp > right.hp
        ? "left"
        : "right";

  return {
    version: 1,
    stageWidth: STAGE_WIDTH,
    durationMs: frames.length ? frames[frames.length - 1].t : 0,
    winner,
    frames,
    hitEvents,
    events,
  };
}