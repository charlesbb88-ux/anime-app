// components/profile/ProfileHeader.tsx
"use client";

import React from "react";
import Link from "next/link";
import ProfileMediaHeaderLayout from "@/components/layouts/ProfileMediaHeaderLayout";
import FollowButton from "@/components/profile/FollowButton";

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
            rightPinned={
                isOwner ? (
                    <Link
                        href="/settings"
                        className="px-3 py-1.5 text-sm rounded-full border border-white/30 text-white hover:border-white/60 hover:bg-white/10 transition"
                    >
                        Edit profile
                    </Link>
                ) : (
                    <FollowButton viewerUserId={viewerUserId} profileId={profileId} isOwner={isOwner} />
                )
            }
            reserveRightClassName="pr-[180px]"
            activeTab={activeTab}
        />
    );
}