"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type {
  Mc3DClipKey,
  Mc3DExchange,
  Mc3DReplay,
} from "@/lib/mc3d/mc3dReplayTypes";

type FighterRenderState = {
  x: number;
  y: number;
  facing: "left" | "right";
  clip: Mc3DClipKey;
};

type Mc3DCharacterProps = {
  replay: Mc3DReplay;
  timeMs: number;
};

const MODEL_PATH = "/mc/3d/starter-run.glb";
const IDLE_PATH = "/mc/3d/starter-idle.glb";
const RUN_PATH = "/mc/3d/starter-run.glb";
const ATTACK_PATH = "/mc/3d/starter-attack.glb";
const HIT_PATH = "/mc/3d/starter-hit.glb";

const MAX_APPROACH_TRAVEL = 2.1;
const MODEL_SCALE = 0.42;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function renameClip(
  clip: THREE.AnimationClip | undefined,
  nextName: Mc3DClipKey
): THREE.AnimationClip | null {
  if (!clip) return null;
  const cloned = clip.clone();
  cloned.name = nextName;
  return cloned;
}

function getFacingForSide(side: "left" | "right"): "left" | "right" {
  return side === "left" ? "right" : "left";
}

function limitApproachTarget(startX: number, desiredTargetX: number) {
  const delta = desiredTargetX - startX;
  const clampedDelta = clamp(delta, -MAX_APPROACH_TRAVEL, MAX_APPROACH_TRAVEL);
  return startX + clampedDelta;
}

function getExchangeIndexAtTime(replay: Mc3DReplay, timeMs: number) {
  for (let i = 0; i < replay.exchanges.length; i += 1) {
    const exchange = replay.exchanges[i];
    if (
      timeMs >= exchange.timing.startMs &&
      timeMs <= exchange.timing.recoveryEndMs
    ) {
      return i;
    }
  }

  return -1;
}

function getStableStateOutsideExchange(
  replay: Mc3DReplay,
  side: "left" | "right",
  timeMs: number
): FighterRenderState {
  const exchanges = replay.exchanges;

  if (!exchanges.length) {
    return {
      x: side === "left" ? -1.2 : 1.2,
      y: 0,
      facing: getFacingForSide(side),
      clip: "idle",
    };
  }

  const first = exchanges[0];

  if (timeMs < first.timing.startMs) {
    return {
      x: side === "left" ? first.leftStartX : first.rightStartX,
      y: 0,
      facing: getFacingForSide(side),
      clip: "idle",
    };
  }

  for (let i = 0; i < exchanges.length - 1; i += 1) {
    const current = exchanges[i];
    const next = exchanges[i + 1];

    if (
      timeMs > current.timing.recoveryEndMs &&
      timeMs < next.timing.startMs
    ) {
      const holdX = side === "left" ? current.leftEndX : current.rightEndX;

      return {
        x: holdX,
        y: 0,
        facing: getFacingForSide(side),
        clip: "idle",
      };
    }
  }

  const last = exchanges[exchanges.length - 1];

  return {
    x: side === "left" ? last.leftEndX : last.rightEndX,
    y: 0,
    facing: getFacingForSide(side),
    clip: "idle",
  };
}

function getFighterStateFromExchange(
  exchange: Mc3DExchange,
  side: "left" | "right",
  timeMs: number
): FighterRenderState {
  const isAttacker = exchange.attacker === side;
  const isLeft = side === "left";

  const {
    approachStartMs,
    windupStartMs,
    impactMs,
    recoveryEndMs,
  } = exchange.timing;

  const startX = isLeft ? exchange.leftStartX : exchange.rightStartX;
  const endX = isLeft ? exchange.leftEndX : exchange.rightEndX;

  const desiredContactX = isAttacker
    ? exchange.motion.attacker.contactX
    : exchange.motion.defender.hitX;

  const contactX = limitApproachTarget(startX, desiredContactX);

  if (timeMs < windupStartMs) {
    const denom = Math.max(1, windupStartMs - approachStartMs);
    const p = clamp((timeMs - approachStartMs) / denom, 0, 1);

    return {
      x: lerp(startX, contactX, p),
      y: 0,
      facing: getFacingForSide(side),
      clip: isAttacker
        ? exchange.clips.attackerApproach
        : exchange.clips.defenderPreImpact,
    };
  }

  if (timeMs < impactMs) {
    return {
      x: contactX,
      y: 0,
      facing: getFacingForSide(side),
      clip: isAttacker
        ? exchange.clips.attackerWindup
        : exchange.clips.defenderPreImpact,
    };
  }

  const denom = Math.max(1, recoveryEndMs - impactMs);
  const p = clamp((timeMs - impactMs) / denom, 0, 1);

  if (isAttacker) {
    return {
      x: lerp(contactX, endX, p),
      y: 0,
      facing: getFacingForSide(side),
      clip:
        p < 0.65
          ? exchange.clips.attackerWindup
          : exchange.clips.attackerRecovery,
    };
  }

  const launchY = exchange.isLauncher ? exchange.motion.defender.launchY : 0;
  let y = 0;

  if (exchange.isLauncher) {
    const risePortion = 0.3;

    if (p < risePortion) {
      y = lerp(0, launchY, p / risePortion);
    } else {
      y = lerp(launchY, 0, (p - risePortion) / (1 - risePortion));
    }
  }

  return {
    x: lerp(contactX, endX, p),
    y,
    facing: getFacingForSide(side),
    clip:
      p < 0.75
        ? exchange.clips.defenderOnImpact
        : exchange.clips.defenderRecovery,
  };
}

function getFighterState(
  replay: Mc3DReplay,
  side: "left" | "right",
  timeMs: number
): FighterRenderState {
  const activeIndex = getExchangeIndexAtTime(replay, timeMs);

  if (activeIndex === -1) {
    return getStableStateOutsideExchange(replay, side, timeMs);
  }

  const exchange = replay.exchanges[activeIndex];
  return getFighterStateFromExchange(exchange, side, timeMs);
}

function Fighter({
  state,
  color,
}: {
  state: FighterRenderState;
  color: string;
}) {
  const baseGltf = useGLTF(MODEL_PATH);
  const idleGltf = useGLTF(IDLE_PATH);
  const runGltf = useGLTF(RUN_PATH);
  const attackGltf = useGLTF(ATTACK_PATH);
  const hitGltf = useGLTF(HIT_PATH);

  const modelMountRef = useRef<THREE.Group>(null);
  const currentClipRef = useRef<Mc3DClipKey | null>(null);

  const clonedScene = useMemo(() => {
    const cloned = cloneSkinned(baseGltf.scene) as THREE.Group;

    const cube = cloned.getObjectByName("Cube");
    if (cube && cube.parent) {
      cube.parent.remove(cube);
    }

    cloned.traverse((obj) => {
      obj.frustumCulled = false;
    });

    return cloned;
  }, [baseGltf.scene]);

  const renamedAnimations = useMemo(() => {
    const clips: THREE.AnimationClip[] = [];

    const idle = renameClip(idleGltf.animations[0], "idle");
    const run = renameClip(runGltf.animations[0], "run");
    const attack = renameClip(attackGltf.animations[0], "attack");
    const hit = renameClip(hitGltf.animations[0], "hit");

    if (idle) clips.push(idle);
    if (run) clips.push(run);
    if (attack) clips.push(attack);
    if (hit) clips.push(hit);

    return clips;
  }, [
    idleGltf.animations,
    runGltf.animations,
    attackGltf.animations,
    hitGltf.animations,
  ]);

  const { actions } = useAnimations(renamedAnimations, modelMountRef);

  useEffect(() => {
    if (!modelMountRef.current) return;

    clonedScene.position.set(0, 0, 0);
    clonedScene.rotation.set(0, 0, 0);
    clonedScene.scale.set(1, 1, 1);
    clonedScene.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(clonedScene);
    const center = new THREE.Vector3();
    box.getCenter(center);

    modelMountRef.current.position.x = -center.x;
    modelMountRef.current.position.z = -center.z;
    modelMountRef.current.position.y = -box.min.y;
  }, [clonedScene]);

  useEffect(() => {
    const nextClip = state.clip;

    if (currentClipRef.current === nextClip) {
      return;
    }

    const nextAction = actions[nextClip];

    if (!nextAction) {
      return;
    }

    for (const action of Object.values(actions)) {
      if (!action) continue;
      action.stop();
      action.enabled = true;
      action.reset();
    }

    const isOneShot = nextClip === "attack" || nextClip === "hit";

    nextAction.reset();
    nextAction.enabled = true;
    nextAction.setEffectiveWeight(1);
    nextAction.setEffectiveTimeScale(1);
    nextAction.setLoop(
      isOneShot ? THREE.LoopOnce : THREE.LoopRepeat,
      isOneShot ? 1 : Infinity
    );
    nextAction.clampWhenFinished = true;
    nextAction.play();

    currentClipRef.current = nextClip;
  }, [actions, state.clip]);

  const rotation = state.facing === "left" ? -Math.PI / 2 : Math.PI / 2;

  return (
    <group
      position={[state.x, state.y, 0]}
      rotation={[0, rotation, 0]}
      scale={MODEL_SCALE}
    >
      <group ref={modelMountRef}>
        <primitive object={clonedScene} />
      </group>

      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.35, 0.1, 0.35]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function ReplayCameraRig({
  leftState,
  rightState,
}: {
  leftState: FighterRenderState;
  rightState: FighterRenderState;
}) {
  const { camera } = useThree();

  const targetLookAt = useRef(new THREE.Vector3(0, 1.1, 0));
  const targetPosition = useRef(new THREE.Vector3(0, 1.7, 8));
  const currentLookAt = useRef(new THREE.Vector3(0, 1.1, 0));

  useFrame(() => {
    const leftX = leftState.x;
    const rightX = rightState.x;
    const leftY = leftState.y;
    const rightY = rightState.y;

    const minX = Math.min(leftX, rightX);
    const maxX = Math.max(leftX, rightX);
    const minY = Math.min(0, leftY, rightY);
    const maxY = Math.max(leftY, rightY);

    const width = maxX - minX;
    const height = maxY - minY;

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    const paddedWidth = width + 1.8;
    const paddedHeight = height + 1.6;

    const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);
    const distX = paddedWidth / (2 * Math.tan(fov / 2));
    const distY = paddedHeight / (2 * Math.tan(fov / 2));

    let targetZ = Math.max(distX, distY);
    targetZ = THREE.MathUtils.clamp(targetZ, 5.8, 8.8);

    targetPosition.current.set(midX, midY + 1.05, targetZ);
    targetLookAt.current.set(midX, midY + 0.7, 0);

    camera.position.lerp(targetPosition.current, 0.1);
    currentLookAt.current.lerp(targetLookAt.current, 0.12);
    camera.lookAt(currentLookAt.current);
  });

  return null;
}

function Arena({ replay, timeMs }: Mc3DCharacterProps) {
  const leftState = getFighterState(replay, "left", timeMs);
  const rightState = getFighterState(replay, "right", timeMs);

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[20, 10]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      <mesh position={[0, 2.5, -4]}>
        <planeGeometry args={[20, 10]} />
        <meshStandardMaterial color="#101010" />
      </mesh>

      <Fighter state={leftState} color="red" />
      <Fighter state={rightState} color="blue" />
      <ReplayCameraRig leftState={leftState} rightState={rightState} />
    </>
  );
}

export default function Mc3DCharacter({ replay, timeMs }: Mc3DCharacterProps) {
  return (
    <div className="h-[700px] w-full border border-red-500">
      <Canvas camera={{ position: [0, 1.7, 7.4], fov: 24 }}>
        <color attach="background" args={["#0b0b0b"]} />
        <ambientLight intensity={2} />
        <directionalLight position={[5, 10, 8]} intensity={3} />

        <Suspense fallback={null}>
          <Arena replay={replay} timeMs={timeMs} />
        </Suspense>

        <OrbitControls
          makeDefault
          enablePan={false}
          enableRotate={false}
          enableZoom={false}
        />
      </Canvas>
    </div>
  );
}