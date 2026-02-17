// components/profile/ProfileHeader.tsx
"use client";

import React from "react";
import Link from "next/link";
import ProfileMediaHeaderLayout from "@/components/layouts/ProfileMediaHeaderLayout";
import FollowButton from "@/components/profile/FollowButton";
import ProfileStatsBarConnected from "@/components/profile/ProfileStatsBarConnected";

type MediaHeaderProps = React.ComponentProps<typeof ProfileMediaHeaderLayout>;

type Props = {
  isOwner: boolean;

  viewerUserId: string | null;
  profileId: string;

  username: string;
  avatarUrl: string | null;

  backdropUrl: string | null;
  backdropPosX: number | null;
  backdropPosY: number | null;
  backdropZoom: number | null;

  followersCount: number;
  followingCount: number;
  onFollowersClick: () => void;
  onFollowingClick: () => void;

  activeTab?: MediaHeaderProps["activeTab"];
};

export default function ProfileHeader({
  isOwner,
  viewerUserId,
  profileId,
  username,
  avatarUrl,
  backdropUrl,
  backdropPosX,
  backdropPosY,
  backdropZoom,

  followersCount,
  followingCount,
  onFollowersClick,
  onFollowingClick,

  activeTab = "posts",
}: Props) {
  return (
    <ProfileMediaHeaderLayout
      backdropUrl={backdropUrl}
      backdropPosX={backdropPosX}
      backdropPosY={backdropPosY}
      backdropZoom={backdropZoom}
      username={username}
      avatarUrl={avatarUrl}
      hideTabs
      belowUsername={
        !isOwner ? (
          <div className="inline-flex items-center justify-start">
            <FollowButton viewerUserId={viewerUserId} profileId={profileId} isOwner={isOwner} />
          </div>
        ) : null
      }
rightPinned={
  <div className="flex flex-col items-end gap-1">
    {isOwner ? (
      <Link
        href="/settings"
        className={[
          "inline-flex items-center justify-center",
          "h-[30px] px-2",
          "rounded-md",
          "bg-black/90 backdrop-blur-md",
          "ring-1 ring-white/10",
          "text-white text-sm font-semibold",
          "transition-colors",
          "hover:bg-black/80 active:bg-white/10",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-0",
        ].join(" ")}
      >
        Edit profile
      </Link>
    ) : (
      // ✅ spacer to keep stats row vertically aligned
      <div className="h-[30px]" />
    )}

    <ProfileStatsBarConnected
      profileId={profileId}
      followersCount={followersCount}
      followingCount={followingCount}
      onFollowersClick={onFollowersClick}
      onFollowingClick={onFollowingClick}
    />
  </div>
}
      reserveRightClassName="pr-[260px]"
      activeTab={activeTab}
    />
  );
}