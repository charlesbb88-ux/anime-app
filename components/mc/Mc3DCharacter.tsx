"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { DotAction, DotFighterState } from "@/lib/dot/mcDotReplayTypes";

type ClipKey = "idle" | "run" | "attack" | "hit";

type FighterProps = {
  fighter: DotFighterState;
  color: string;
};

type Mc3DCharacterProps = {
  leftFighter: DotFighterState;
  rightFighter: DotFighterState;
};

const CLIP_PATHS: Record<ClipKey, string> = {
  idle: "/mc/3d/starter-idle.glb",
  run: "/mc/3d/starter-run.glb",
  attack: "/mc/3d/starter-attack.glb",
  hit: "/mc/3d/starter-hit.glb",
};

function mapActionToClip(action: DotAction): ClipKey {
  switch (action) {
    case "run":
      return "run";
    case "attack":
      return "attack";
    case "hit":
      return "hit";
    case "jump":
      return "run";
    case "recover":
      return "idle";
    case "idle":
    default:
      return "idle";
  }
}

function Fighter({ fighter, color }: FighterProps) {
  const clip = mapActionToClip(fighter.action);

  const baseGltf = useGLTF("/mc/3d/starter-run.glb");
  const clipGltf = useGLTF(CLIP_PATHS[clip]);

  const { scene } = baseGltf;
  const clipAnimations = clipGltf.animations;

  const modelRef = useRef<THREE.Group>(null);

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

    action.reset();
    action.setLoop(
      clip === "attack" || clip === "hit" ? THREE.LoopOnce : THREE.LoopRepeat,
      clip === "attack" || clip === "hit" ? 1 : Infinity
    );
    action.clampWhenFinished = true;
    action.fadeIn(0.08).play();

    return () => {
      action.fadeOut(0.08);
    };
  }, [actions, names, clip]);

  const worldX = fighter.x;
  const worldY = fighter.y * 0.9;
  const facingRotation = fighter.facing === "left" ? -Math.PI / 2 : Math.PI / 2;

  return (
    <group position={[worldX, worldY, 0]} rotation={[0, facingRotation, 0]} scale={0.42}>
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

function ReplayCameraRig({
  leftFighter,
  rightFighter,
}: {
  leftFighter: DotFighterState;
  rightFighter: DotFighterState;
}) {
  const { camera } = useThree();

  const targetLookAt = useRef(new THREE.Vector3(0, 1.2, 0));
  const targetPosition = useRef(new THREE.Vector3(0, 1.8, 9));
  const currentLookAt = useRef(new THREE.Vector3(0, 1.2, 0));

  useFrame(() => {
    const leftX = leftFighter.x;
    const rightX = rightFighter.x;
    const leftY = leftFighter.y * 0.9;
    const rightY = rightFighter.y * 0.9;

    // --- bounds ---
    const minX = Math.min(leftX, rightX);
    const maxX = Math.max(leftX, rightX);
    const minY = Math.min(leftY, rightY, 0);
    const maxY = Math.max(leftY, rightY);

    const width = maxX - minX;
    const height = maxY - minY;

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    // --- padding (CRITICAL) ---
    const paddedWidth = width + 2.4;
    const paddedHeight = height + 2.0;

    // --- convert bounds → camera distance ---
    const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);

    const distX = paddedWidth / (2 * Math.tan(fov / 2));
    const distY = paddedHeight / (2 * Math.tan(fov / 2));

    let targetZ = Math.max(distX, distY);

    // --- clamp zoom (VERY IMPORTANT) ---
    targetZ = THREE.MathUtils.clamp(targetZ, 5.5, 10.5);

    // --- camera targets ---
    targetPosition.current.set(midX, midY + 1.2, targetZ);
    targetLookAt.current.set(midX, midY + 0.8, 0);

    // --- smooth ---
    camera.position.lerp(targetPosition.current, 0.12);
    currentLookAt.current.lerp(targetLookAt.current, 0.14);

    camera.lookAt(currentLookAt.current);
  });

  return null;
}

function Arena({
  leftFighter,
  rightFighter,
}: {
  leftFighter: DotFighterState;
  rightFighter: DotFighterState;
}) {
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

      <Fighter fighter={leftFighter} color="red" />
      <Fighter fighter={rightFighter} color="blue" />
      <ReplayCameraRig leftFighter={leftFighter} rightFighter={rightFighter} />
    </>
  );
}

export default function Mc3DCharacter({
  leftFighter,
  rightFighter,
}: Mc3DCharacterProps) {
  return (
    <div className="h-[700px] w-full border border-red-500">
      <Canvas camera={{ position: [0, 1.8, 9], fov: 26 }}>
        <color attach="background" args={["#0b0b0b"]} />
        <ambientLight intensity={2} />
        <directionalLight position={[5, 10, 8]} intensity={3} />

        <Suspense fallback={null}>
          <Arena leftFighter={leftFighter} rightFighter={rightFighter} />
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