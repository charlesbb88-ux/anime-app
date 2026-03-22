"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

type ClipKey = "idle" | "run" | "attack" | "hit";
type FighterSide = "left" | "right";

type Exchange = {
  attacker: FighterSide;
  defender: FighterSide;

  attackerClip: ClipKey;
  defenderClip: ClipKey;

  timing: {
    startMs: number;
    impactMs: number;
    endMs: number;
  };

  motion: {
    attacker: {
      fromX: number;
      contactX: number;
      settleX: number;
    };
    defender: {
      fromX: number;
      hitX: number;
      settleX: number;
    };
  };
};

const EXCHANGE: Exchange = {
  attacker: "right",
  defender: "left",

  attackerClip: "attack",
  defenderClip: "hit",

  timing: {
    startMs: 0,
    impactMs: 350,
    endMs: 900,
  },

  motion: {
    attacker: {
      fromX: 2.5,
      contactX: 0.9,
      settleX: 1.8,
    },
    defender: {
      fromX: -2.5,
      hitX: -3.0,
      settleX: -2.7,
    },
  },
};

type FighterMotion = {
  fromX: number;
  midX: number;
  endX: number;
  midT: number;
};

type FighterResolvedData = {
  side: FighterSide;
  role: "attacker" | "defender";
  clip: ClipKey;
  startDelayMs: number;
  baseX: number;
  motion: FighterMotion;
};

type FighterProps = {
  side: FighterSide;
  facing: "left" | "right";
  color: string;
  triggerKey: number;
};

const CLIP_PATHS: Record<ClipKey, string> = {
  idle: "/mc/3d/starter-idle.glb",
  run: "/mc/3d/starter-run.glb",
  attack: "/mc/3d/starter-attack.glb",
  hit: "/mc/3d/starter-hit.glb",
};

function getResolvedFighterData(exchange: Exchange, side: FighterSide): FighterResolvedData {
  const durationMs = Math.max(exchange.timing.endMs - exchange.timing.startMs, 1);
  const midT = THREE.MathUtils.clamp(
    (exchange.timing.impactMs - exchange.timing.startMs) / durationMs,
    0,
    1
  );

  if (side === exchange.attacker) {
    return {
      side,
      role: "attacker",
      clip: exchange.attackerClip,
      startDelayMs: exchange.timing.startMs,
      baseX: exchange.motion.attacker.fromX,
      motion: {
        fromX: exchange.motion.attacker.fromX,
        midX: exchange.motion.attacker.contactX,
        endX: exchange.motion.attacker.settleX,
        midT,
      },
    };
  }

  return {
    side,
    role: "defender",
    clip: exchange.defenderClip,
    startDelayMs: exchange.timing.impactMs,
    baseX: exchange.motion.defender.fromX,
    motion: {
      fromX: exchange.motion.defender.fromX,
      midX: exchange.motion.defender.hitX,
      endX: exchange.motion.defender.settleX,
      midT,
    },
  };
}

function Fighter({ side, facing, color, triggerKey }: FighterProps) {
  const resolved = useMemo(() => getResolvedFighterData(EXCHANGE, side), [side]);
  const { clip, startDelayMs, baseX, motion } = resolved;

  const baseGltf = useGLTF("/mc/3d/starter-run.glb");
  const clipGltf = useGLTF(CLIP_PATHS[clip]);

  const { scene } = baseGltf;
  const clipAnimations = clipGltf.animations;

  const wrapperRef = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Group>(null);
  const animationStartTimeRef = useRef<number | null>(null);
  const clipDurationRef = useRef(1);

  const clonedScene = useMemo(() => {
    const cloned = cloneSkinned(scene) as THREE.Group;

    const cube = cloned.getObjectByName("Cube");
    if (cube && cube.parent) {
      cube.parent.remove(cube);
    }

    return cloned;
  }, [scene]);

  const { actions, names } = useAnimations(clipAnimations, modelRef);

  useLayoutEffect(() => {
    if (!modelRef.current) return;

    clonedScene.position.set(0, 0, 0);
    clonedScene.rotation.set(0, 0, 0);
    clonedScene.scale.set(1, 1, 1);
    clonedScene.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(clonedScene);
    const center = new THREE.Vector3();

    box.getCenter(center);

    modelRef.current.position.x = -center.x;
    modelRef.current.position.z = -center.z;
    modelRef.current.position.y = -box.min.y;
  }, [clonedScene]);

  useEffect(() => {
    const clipName = names[0];
    if (!clipName) return;

    const action = actions[clipName];
    if (!action) return;

    let timeoutId: number | null = null;

    action.stop();
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.time = 0;
    action.paused = true;

    animationStartTimeRef.current = null;

    timeoutId = window.setTimeout(() => {
      action.reset();
      action.paused = false;
      action.play();

      clipDurationRef.current = action.getClip().duration || 1;
      animationStartTimeRef.current = performance.now();
    }, startDelayMs);

    return () => {
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
      action.stop();
    };
  }, [actions, names, triggerKey, startDelayMs]);

  useFrame(() => {
    if (!wrapperRef.current) return;

    const start = animationStartTimeRef.current;
    if (start == null) {
      wrapperRef.current.position.x = baseX;
      return;
    }

    const elapsed = (performance.now() - start) / 1000;
    const duration = clipDurationRef.current || 1;
    const t = Math.min(elapsed / duration, 1);

    const { fromX, midX, endX, midT } = motion;

    let x = fromX;

    if (midT <= 0) {
      x = THREE.MathUtils.lerp(midX, endX, t);
    } else if (midT >= 1) {
      x = THREE.MathUtils.lerp(fromX, midX, t);
    } else if (t < midT) {
      const localT = t / midT;
      x = THREE.MathUtils.lerp(fromX, midX, localT);
    } else {
      const localT = (t - midT) / (1 - midT);
      x = THREE.MathUtils.lerp(midX, endX, localT);
    }

    wrapperRef.current.position.x = x;
  });

  return (
    <group
      ref={wrapperRef}
      position={[baseX, 0, 0]}
      rotation={[0, facing === "left" ? -Math.PI / 2 : Math.PI / 2, 0]}
      scale={0.42}
    >
      <group ref={modelRef}>
        <primitive object={clonedScene} />
      </group>

      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.35, 0.1, 0.35]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function Arena({ triggerKey }: { triggerKey: number }) {
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

      <Fighter
        side="left"
        facing="right"
        color="red"
        triggerKey={triggerKey}
      />

      <Fighter
        side="right"
        facing="left"
        color="blue"
        triggerKey={triggerKey}
      />
    </>
  );
}

export default function Mc3DCharacter() {
  const [triggerKey, setTriggerKey] = useState(0);

  return (
    <div className="h-[700px] w-full border border-red-500">
      <div className="mb-3">
        <button
          type="button"
          onClick={() => setTriggerKey((prev) => prev + 1)}
          className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
        >
          Play Hit Exchange
        </button>
      </div>

      <Canvas camera={{ position: [0, 1.4, 9], fov: 26 }}>
        <color attach="background" args={["#0b0b0b"]} />
        <ambientLight intensity={2} />
        <directionalLight position={[5, 10, 8]} intensity={3} />

        <Suspense fallback={null}>
          <Arena triggerKey={triggerKey} />
        </Suspense>

        <OrbitControls
          makeDefault
          enablePan={false}
          target={[0, 0, 0]}
          minDistance={5}
          maxDistance={14}
        />
      </Canvas>
    </div>
  );
}