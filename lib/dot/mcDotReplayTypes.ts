export type FighterSide = "left" | "right";

export type DotAction =
  | "idle"
  | "run"
  | "jump"
  | "attack"
  | "hit"
  | "recover";

export type DotFighterState = {
  x: number;
  y: number;
  facing: "left" | "right";
  action: DotAction;
  hp: number;
};

export type DotReplayFrame = {
  t: number;
  fighters: {
    left: DotFighterState;
    right: DotFighterState;
  };
};

export type DotReplayHitEvent = {
  t: number;
  attacker: FighterSide;
  defender: FighterSide;
  damage: number;
};

export type DotReplayMetaEvent =
  | {
      type: "approach";
      startMs: number;
      endMs: number;
      actor: FighterSide;
    }
  | {
      type: "jump";
      startMs: number;
      endMs: number;
      actor: FighterSide;
    }
  | {
      type: "attack";
      startMs: number;
      endMs: number;
      actor: FighterSide;
      target: FighterSide;
    }
  | {
      type: "hit";
      startMs: number;
      actor: FighterSide;
      target: FighterSide;
      damage: number;
    }
  | {
      type: "knockback";
      startMs: number;
      endMs: number;
      actor: FighterSide;
    }
  | {
      type: "recover";
      startMs: number;
      endMs: number;
      actor: FighterSide;
    };

export type McDotReplay = {
  version: 1;
  stageWidth: number;
  durationMs: number;
  winner: FighterSide;
  frames: DotReplayFrame[];
  hitEvents: DotReplayHitEvent[];
  events: DotReplayMetaEvent[];
};