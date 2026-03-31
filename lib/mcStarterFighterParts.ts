import type { McBoneKey } from "@/lib/mcFighterSkeleton";
import { getMcRigAssetSet } from "@/components/mc/rig/getMcRigAssetSet";

export type McFighterPartSprite = {
  bone_key: McBoneKey;
  image_url: string;
  width: number;
  height: number;
  z_index: number;
};

export function getMcFighterPartSprites(
  bodyId?: string | null
): McFighterPartSprite[] {
  const rig = getMcRigAssetSet(bodyId);

  return [
    {
      bone_key: "hips",
      image_url: rig.hips,
      width: 260,
      height: 360,
      z_index: 40,
    },
    {
      bone_key: "torso",
      image_url: rig.torsoLower,
      width: 260,
      height: 360,
      z_index: 20,
    },
    {
      bone_key: "torso",
      image_url: rig.torsoUpper,
      width: 260,
      height: 360,
      z_index: 50,
    },
    {
      bone_key: "neck",
      image_url: rig.neck,
      width: 260,
      height: 360,
      z_index: 55,
    },
    {
      bone_key: "head",
      image_url: rig.head,
      width: 260,
      height: 360,
      z_index: 60,
    },
    {
      bone_key: "upper_arm_left",
      image_url: rig.armLeftUpper,
      width: 260,
      height: 360,
      z_index: 30,
    },
    {
      bone_key: "forearm_left",
      image_url: rig.armLeftForearm,
      width: 260,
      height: 360,
      z_index: 31,
    },
    {
      bone_key: "hand_left",
      image_url: rig.leftHand,
      width: 260,
      height: 360,
      z_index: 32,
    },
    {
      bone_key: "upper_arm_right",
      image_url: rig.armRightUpper,
      width: 260,
      height: 360,
      z_index: 30,
    },
    {
      bone_key: "forearm_right",
      image_url: rig.armRightForearm,
      width: 260,
      height: 360,
      z_index: 31,
    },
    {
      bone_key: "hand_right",
      image_url: rig.rightHand,
      width: 260,
      height: 360,
      z_index: 32,
    },
    {
      bone_key: "thigh_left",
      image_url: rig.legLeftThigh,
      width: 260,
      height: 360,
      z_index: 10,
    },
    {
      bone_key: "shin_left",
      image_url: rig.legLeftShin,
      width: 260,
      height: 360,
      z_index: 11,
    },
    {
      bone_key: "foot_left",
      image_url: rig.leftFoot,
      width: 260,
      height: 360,
      z_index: 12,
    },
    {
      bone_key: "thigh_right",
      image_url: rig.legRightThigh,
      width: 260,
      height: 360,
      z_index: 10,
    },
    {
      bone_key: "shin_right",
      image_url: rig.legRightShin,
      width: 260,
      height: 360,
      z_index: 11,
    },
    {
      bone_key: "foot_right",
      image_url: rig.rightFoot,
      width: 260,
      height: 360,
      z_index: 12,
    },
  ];
}