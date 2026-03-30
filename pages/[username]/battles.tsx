"use client";

import type { NextPage } from "next";
import ProfileLayout from "@/components/profile/ProfileLayout";
import McBattleFeed from "@/components/mc/battles/McBattleFeed";

const UserBattlesPage: NextPage = () => {
  return (
    <ProfileLayout activeTab="battles">
      {({ profile }) => (
        <div className="mx-auto max-w-6xl">
          <h1 className="mb-2 text-2xl font-bold text-black">
            {profile.username}&apos;s Battles
          </h1>

          <McBattleFeed userId={profile.id} initialLimit={10} pageSize={10} />
        </div>
      )}
    </ProfileLayout>
  );
};

export default UserBattlesPage;