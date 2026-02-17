"use client";

import React from "react";
import ProfileStatsBar from "@/components/profile/ProfileStatsBar";
import { useUserConsumptionCounts } from "@/lib/hooks/useUserConsumptionCounts";

type Props = {
  profileId: string;

  followersCount: number;
  followingCount: number;

  onFollowersClick?: () => void;
  onFollowingClick?: () => void;
};

export default function ProfileStatsBarConnected({
  profileId,
  followersCount,
  followingCount,
  onFollowersClick,
  onFollowingClick,
}: Props) {
  const { counts } = useUserConsumptionCounts(profileId);

  return (
    <ProfileStatsBar
      followersCount={followersCount}
      followingCount={followingCount}
      onFollowersClick={onFollowersClick}
      onFollowingClick={onFollowingClick}
      animeWatchedCount={counts?.animeEpisodesWatchedCount ?? null}
      mangaReadCount={counts?.mangaChaptersReadCount ?? null}
    />
  );
}