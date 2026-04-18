// components/profile/ProfileHeader.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import ProfileMediaHeaderLayout from "@/components/layouts/ProfileMediaHeaderLayout";
import FollowButton from "@/components/profile/FollowButton";
import ProfileStatsBarConnected from "@/components/profile/ProfileStatsBarConnected";
import SendMessageModal from "@/components/dm/SendMessageModal";
import { MessageSquare } from "lucide-react";

type MediaHeaderProps = React.ComponentProps<typeof ProfileMediaHeaderLayout>;

type Props = {
  isOwner: boolean;

  viewerUserId: string | null;
  profileId: string;

  username: string;
  avatarUrl: string | null;
  isPro?: boolean | null;

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
  isPro,
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
  const [messageOpen, setMessageOpen] = useState(false);
  const siteOwnerId = process.env.NEXT_PUBLIC_SITE_OWNER_USER_ID ?? "";

  return (
    <>
      <ProfileMediaHeaderLayout
        backdropUrl={backdropUrl}
        backdropPosX={backdropPosX}
        backdropPosY={backdropPosY}
        backdropZoom={backdropZoom}
        username={username}
        avatarUrl={avatarUrl}
        isPro={isPro}
        hideTabs
        belowUsername={
          !isOwner ? (
            <div className="inline-flex items-center justify-start gap-2">
              <FollowButton
                viewerUserId={viewerUserId}
                profileId={profileId}
                isOwner={isOwner}
              />

              {profileId === siteOwnerId ? (
                <button
                  type="button"
                  onClick={() => setMessageOpen(true)}
                  className="
    inline-flex items-center justify-center
    rounded-[6px] bg-black
    px-2 py-1 md:px-2 md:py-1
    font-bold text-white
    transition-opacity hover:opacity-90
  "
                >
                  <MessageSquare size={15} className="md:w-[18px] md:h-[18px]" />
                </button>
              ) : null}
            </div>
          ) : null
        }
        rightPinned={
          <div className="flex flex-col items-end gap-1.5 md:gap-1">
            {isOwner ? (
              <Link
                href="/settings"
                className={[
                  "inline-flex items-center justify-center",
                  "h-[24px] px-1.5 text-[10px] md:h-[30px] md:px-2 md:text-sm",
                  "rounded-md",
                  "bg-black/90 backdrop-blur-md",
                  "ring-1 ring-white/10",
                  "text-white font-semibold",
                  "transition-colors",
                  "hover:bg-black/80 active:bg-white/10",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-0",
                ].join(" ")}
              >
                Edit profile
              </Link>
            ) : (
              <div className="h-[26px] md:h-[30px]" />
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

      <SendMessageModal
        open={messageOpen}
        onClose={() => setMessageOpen(false)}
      />
    </>
  );
}