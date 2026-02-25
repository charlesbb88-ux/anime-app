"use client";

import React, { useEffect, useState } from "react";
import ProfileStatsBar from "@/components/profile/ProfileStatsBar";
import { useUserConsumptionCounts } from "@/lib/hooks/useUserConsumptionCounts";

type Props = {
  profileId: string;

  followersCount: number;
  followingCount: number;

  onFollowersClick?: () => void;
  onFollowingClick?: () => void;
};

const PHONE_MAX_WIDTH_PX = 767;

function useIsPhone() {
  const [isPhone, setIsPhone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH_PX}px)`);
    const update = () => setIsPhone(mq.matches);
    update();

    if (typeof (mq as any).addEventListener === "function") {
      (mq as any).addEventListener("change", update);
      return () => (mq as any).removeEventListener("change", update);
    } else {
      mq.addListener(update);
      return () => mq.removeListener(update);
    }
  }, []);

  return isPhone;
}

export default function ProfileStatsBarConnected({
  profileId,
  followersCount,
  followingCount,
  onFollowersClick,
  onFollowingClick,
}: Props) {
  const { counts } = useUserConsumptionCounts(profileId);
  const isPhone = useIsPhone();

  return (
    <div className={isPhone ? "mt-1" : "mt-1"}>
      <ProfileStatsBar
        size={isPhone ? "phone" : "desktop"}
        followersCount={followersCount}
        followingCount={followingCount}
        onFollowersClick={onFollowersClick}
        onFollowingClick={onFollowingClick}
        animeWatchedCount={counts?.animeEpisodesWatchedCount ?? null}
        mangaReadCount={counts?.mangaChaptersReadCount ?? null}
      />
    </div>
  );
}