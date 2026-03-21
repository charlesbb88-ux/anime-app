"use client";

import { MC_FIGHTER_BONES, type McBoneKey } from "@/lib/mcFighterSkeleton";
import { MC_STARTER_BONE_LAYOUT } from "@/lib/mcStarterBoneLayout";
import {
  MC_STARTER_FIGHTER_PARTS,
  type McFighterPartSprite,
} from "@/lib/mcStarterFighterParts";
import {
  MC_STARTER_NEUTRAL_POSE,
  type McBoneTransform,
  type McPoseMap,
} from "@/lib/mcStarterNeutralPose";

type Props = {
  pose?: Partial<Record<McBoneKey, Partial<McBoneTransform>>>;
  facing?: "right" | "left";
  scale?: number;
};

type ResolvedBoneTransform = McBoneTransform;

type WorldBoneTransform = {
  x: number;
  y: number;
  rotation: number;
  scale_x: number;
  scale_y: number;
  origin_x: number;
  origin_y: number;
};

function mergePose(
  basePose: McPoseMap,
  poseOverrides?: Partial<Record<McBoneKey, Partial<McBoneTransform>>>
): Record<McBoneKey, ResolvedBoneTransform> {
  const resolved = {} as Record<McBoneKey, ResolvedBoneTransform>;

  for (const bone of MC_FIGHTER_BONES) {
    const base = basePose[bone.key];
    const override = poseOverrides?.[bone.key];

    resolved[bone.key] = {
      x: override?.x ?? base.x,
      y: override?.y ?? base.y,
      rotation: override?.rotation ?? base.rotation,
      scale_x: override?.scale_x ?? base.scale_x,
      scale_y: override?.scale_y ?? base.scale_y,
      origin_x: override?.origin_x ?? base.origin_x,
      origin_y: override?.origin_y ?? base.origin_y,
    };
  }

  return resolved;
}

function getPartsForBone(boneKey: McBoneKey): McFighterPartSprite[] {
  return MC_STARTER_FIGHTER_PARTS.filter((part) => part.bone_key === boneKey);
}

function buildBoneMap() {
  const map = new Map(MC_FIGHTER_BONES.map((bone) => [bone.key, bone]));
  return map;
}

const BONE_MAP = buildBoneMap();

function computeWorldTransforms(
  transforms: Record<McBoneKey, ResolvedBoneTransform>
): Record<McBoneKey, WorldBoneTransform> {
  const world = {} as Record<McBoneKey, WorldBoneTransform>;

  function resolveBone(boneKey: McBoneKey): WorldBoneTransform {
    if (world[boneKey]) return world[boneKey];

    const bone = BONE_MAP.get(boneKey);
    if (!bone) {
      throw new Error(`Missing bone definition for ${boneKey}`);
    }

    const localPose = transforms[boneKey];
    const localLayout = MC_STARTER_BONE_LAYOUT[boneKey];

    const localX = localLayout.x + localPose.x;
    const localY = localLayout.y + localPose.y;

    if (!bone.parent_key) {
      world[boneKey] = {
        x: localX,
        y: localY,
        rotation: localPose.rotation,
        scale_x: localPose.scale_x,
        scale_y: localPose.scale_y,
        origin_x: localPose.origin_x,
        origin_y: localPose.origin_y,
      };

      return world[boneKey];
    }

    const parent = resolveBone(bone.parent_key);

    world[boneKey] = {
      x: parent.x + localX,
      y: parent.y + localY,
      rotation: parent.rotation + localPose.rotation,
      scale_x: parent.scale_x * localPose.scale_x,
      scale_y: parent.scale_y * localPose.scale_y,
      origin_x: localPose.origin_x,
      origin_y: localPose.origin_y,
    };

    return world[boneKey];
  }

  for (const bone of MC_FIGHTER_BONES) {
    resolveBone(bone.key);
  }

  return world;
}

export default function McFighterRig({
  pose,
  facing = "right",
  scale = 1,
}: Props) {
  const transforms = mergePose(MC_STARTER_NEUTRAL_POSE, pose);
  const world = computeWorldTransforms(transforms);

  const renderedParts = MC_FIGHTER_BONES.flatMap((bone) => {
    const boneWorld = world[bone.key];
    const parts = getPartsForBone(bone.key);

    return parts.map((part, index) => ({
      key: `${bone.key}-${part.image_url}-${index}`,
      image_url: part.image_url,
      width: part.width,
      height: part.height,
      z_index: part.z_index,
      x: boneWorld.x,
      y: boneWorld.y,
      rotation: boneWorld.rotation,
      scale_x: boneWorld.scale_x,
      scale_y: boneWorld.scale_y,
      origin_x: boneWorld.origin_x,
      origin_y: boneWorld.origin_y,
    }));
  }).sort((a, b) => a.z_index - b.z_index);

  return (
    <div
      className="relative h-[420px] w-[280px] overflow-visible"
      style={{
        transform: `${facing === "left" ? "scaleX(-1) " : ""}scale(${scale})`,
        transformOrigin: "bottom center",
      }}
    >
      {renderedParts.map((part) => (
        <img
          key={part.key}
          src={part.image_url}
          alt=""
          draggable={false}
          className="pointer-events-none absolute select-none object-contain"
          style={{
            left: `calc(50% + ${part.x - part.width / 2}px)`,
            top: `calc(100% + ${part.y - part.height}px)`,
            width: `${part.width}px`,
            height: `${part.height}px`,
            transformOrigin: `${part.origin_x}% ${part.origin_y}%`,
            transform: `rotate(${part.rotation}deg) scale(${part.scale_x}, ${part.scale_y})`,
            zIndex: part.z_index,
          }}
        />
      ))}
    </div>
  );
}