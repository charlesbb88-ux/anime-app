"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

type ClipKey = "idle" | "run" | "attack" | "hit";

type FighterProps = {
  baseX: number;
  facing: "left" | "right";
  color: string;
  clip: ClipKey;
  triggerKey: number;
  startDelayMs?: number;
};

const CLIP_PATHS: Record<ClipKey, string> = {
  idle: "/mc/3d/starter-idle.glb",
  run: "/mc/3d/starter-run.glb",
  attack: "/mc/3d/starter-attack.glb",
  hit: "/mc/3d/starter-hit.glb",
};

function Fighter({
  baseX,
  facing,
  color,
  clip,
  triggerKey,
  startDelayMs = 0,
}: FighterProps) {
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

    let xOffset = 0;

    if (clip === "attack") {
      if (t < 0.5) {
        xOffset = THREE.MathUtils.lerp(0, -1.6, t / 0.5);
      } else {
        xOffset = THREE.MathUtils.lerp(-1.6, -0.25, (t - 0.5) / 0.5);
      }
    }

    if (clip === "hit") {
      if (t < 0.35) {
        xOffset = THREE.MathUtils.lerp(0, -1.0, t / 0.35);
      } else {
        xOffset = THREE.MathUtils.lerp(-1.0, -0.2, (t - 0.35) / 0.65);
      }
    }

    wrapperRef.current.position.x = baseX + xOffset;
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
        baseX={-2.5}
        facing="right"
        color="red"
        clip="hit"
        triggerKey={triggerKey}
        startDelayMs={350}
      />
      <Fighter
        baseX={2.5}
        facing="left"
        color="blue"
        clip="attack"
        triggerKey={triggerKey}
        startDelayMs={0}
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