import type { FighterSide } from "@/lib/dot/mcDotReplayTypes";

export type Mc3DClipKey = "idle" | "run" | "attack" | "hit";

export type Mc3DExchangeResult = "hit" | "whiff";

export type Mc3DExchangeTiming = {
  startMs: number;
  approachStartMs: number;
  windupStartMs: number;
  impactMs: number;
  recoveryEndMs: number;
};

export type Mc3DExchangeActorMotion = {
  fromX: number;
  contactX: number;
  settleX: number;
  fromY: number;
  apexY: number;
  settleY: number;
};

export type Mc3DExchangeDefenderMotion = {
  fromX: number;
  hitX: number;
  settleX: number;
  fromY: number;
  launchY: number;
  settleY: number;
};

export type Mc3DExchange = {
  id: string;
  attacker: FighterSide;
  defender: FighterSide;
  result: Mc3DExchangeResult;

  timing: Mc3DExchangeTiming;

  phase: "opener" | "pressure" | "combo_end";

  leftStartX: number;
  rightStartX: number;
  leftEndX: number;
  rightEndX: number;

  motion: {
    attacker: Mc3DExchangeActorMotion;
    defender: Mc3DExchangeDefenderMotion;
  };

  clips: {
    attackerApproach: Mc3DClipKey;
    attackerWindup: Mc3DClipKey;
    attackerRecovery: Mc3DClipKey;
    defenderPreImpact: Mc3DClipKey;
    defenderOnImpact: Mc3DClipKey;
    defenderRecovery: Mc3DClipKey;
  };

  damage: number;
  defenderHpAfter: number;
  isLauncher: boolean;
};

export type Mc3DReplay = {
  version: 2;
  durationMs: number;
  winner: FighterSide;
  exchanges: Mc3DExchange[];
};