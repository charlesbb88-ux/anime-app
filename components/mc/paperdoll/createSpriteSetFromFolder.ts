import type { SpriteSet } from "@/components/mc/ScreenSpriteFighter";

const DEFAULT_ANIM_CONFIG = {
  idle: { frames: 5, fps: 8, loop: true },
  run: { frames: 5, fps: 12, loop: true },
  jump: { frames: 5, fps: 10, loop: true },
  attack: { frames: 5, fps: 14, loop: true },
  hit: { frames: 5, fps: 12, loop: false },
  recover: { frames: 5, fps: 10, loop: true },
  defeat_fall: { frames: 5, fps: 10, loop: false },
  defeat_ground: { frames: 1, fps: 1, loop: false },
};

export function createSpriteSetFromFolder(
  basePath: string
): SpriteSet {
  return {
    idle: {
      src: `${basePath}/idle.png`,
      ...DEFAULT_ANIM_CONFIG.idle,
    },
    run: {
      src: `${basePath}/run.png`,
      ...DEFAULT_ANIM_CONFIG.run,
    },
    jump: {
      src: `${basePath}/jump.png`,
      ...DEFAULT_ANIM_CONFIG.jump,
    },
    attack: {
      src: `${basePath}/attack.png`,
      ...DEFAULT_ANIM_CONFIG.attack,
    },
    hit: {
      src: `${basePath}/hit.png`,
      ...DEFAULT_ANIM_CONFIG.hit,
    },
    recover: {
      src: `${basePath}/recover.png`,
      ...DEFAULT_ANIM_CONFIG.recover,
    },
    defeat_fall: {
      src: `${basePath}/defeat_fall.png`,
      ...DEFAULT_ANIM_CONFIG.defeat_fall,
    },
    defeat_ground: {
      src: `${basePath}/defeat_ground.png`,
      ...DEFAULT_ANIM_CONFIG.defeat_ground,
    },
  };
}