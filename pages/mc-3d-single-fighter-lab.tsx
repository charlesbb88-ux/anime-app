"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

type ClipKey = "idle" | "run" | "attack" | "hit";

const MODEL_PATH = "/mc/3d/starter-run.glb";
const IDLE_PATH = "/mc/3d/starter-idle.glb";
const RUN_PATH = "/mc/3d/starter-run.glb";
const ATTACK_PATH = "/mc/3d/starter-attack.glb";
const HIT_PATH = "/mc/3d/starter-hit.glb";

function renameClip(
  clip: THREE.AnimationClip | undefined,
  nextName: string
): THREE.AnimationClip | null {
  if (!clip) return null;
  const cloned = clip.clone();
  cloned.name = nextName;
  return cloned;
}

function FighterLabModel({
  clip,
  triggerKey,
}: {
  clip: ClipKey;
  triggerKey: number;
}) {
  const baseGltf = useGLTF(MODEL_PATH);
  const idleGltf = useGLTF(IDLE_PATH);
  const runGltf = useGLTF(RUN_PATH);
  const attackGltf = useGLTF(ATTACK_PATH);
  const hitGltf = useGLTF(HIT_PATH);

  const modelMountRef = useRef<THREE.Group>(null);

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
    const result: THREE.AnimationClip[] = [];

    const idle = renameClip(idleGltf.animations[0], "idle");
    const run = renameClip(runGltf.animations[0], "run");
    const attack = renameClip(attackGltf.animations[0], "attack");
    const hit = renameClip(hitGltf.animations[0], "hit");

    if (idle) result.push(idle);
    if (run) result.push(run);
    if (attack) result.push(attack);
    if (hit) result.push(hit);

    return result;
  }, [
    idleGltf.animations,
    runGltf.animations,
    attackGltf.animations,
    hitGltf.animations,
  ]);

  const { actions, names } = useAnimations(renamedAnimations, modelMountRef);

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
    console.log("Requested clip:", clip);
    console.log("All animation names:", names);

    const nextAction = actions[clip];

    if (!nextAction) {
      console.warn("No action found for clip:", clip);
      return;
    }

    for (const action of Object.values(actions)) {
      if (!action) continue;
      action.stop();
      action.enabled = true;
      action.reset();
    }

    const isOneShot = clip === "attack" || clip === "hit";

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

    return () => {
      nextAction.stop();
    };
  }, [actions, clip, names, triggerKey]);

  return (
    <group position={[0, 0, 0]} rotation={[0, Math.PI / 2, 0]} scale={0.52}>
      <group ref={modelMountRef}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}

function Scene({
  clip,
  triggerKey,
}: {
  clip: ClipKey;
  triggerKey: number;
}) {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      <mesh position={[0, 2.8, -4]}>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color="#101010" />
      </mesh>

      <FighterLabModel clip={clip} triggerKey={triggerKey} />
    </>
  );
}

export default function Mc3DSingleFighterLabPage() {
  const [clip, setClip] = useState<ClipKey>("idle");
  const [triggerKey, setTriggerKey] = useState(0);

  const playClip = (nextClip: ClipKey) => {
    setClip(nextClip);
    setTriggerKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-semibold">3D Single Fighter Lab</h1>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => playClip("idle")}
            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
          >
            Play Idle
          </button>

          <button
            type="button"
            onClick={() => playClip("run")}
            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
          >
            Play Run
          </button>

          <button
            type="button"
            onClick={() => playClip("attack")}
            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
          >
            Play Attack
          </button>

          <button
            type="button"
            onClick={() => playClip("hit")}
            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
          >
            Play Hit
          </button>

          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
            Current Clip: <span className="font-semibold">{clip}</span>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8">
          <div className="h-[700px] w-full border border-red-500">
            <Canvas camera={{ position: [0, 1.5, 6.2], fov: 24 }}>
              <color attach="background" args={["#0b0b0b"]} />
              <ambientLight intensity={2} />
              <directionalLight position={[5, 10, 8]} intensity={3} />

              <Suspense fallback={null}>
                <Scene clip={clip} triggerKey={triggerKey} />
              </Suspense>

              <OrbitControls
                makeDefault
                enablePan={false}
                enableRotate={false}
                enableZoom={false}
              />
            </Canvas>
          </div>
        </div>
      </div>
    </div>
  );
}