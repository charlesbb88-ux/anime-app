"use client";

import type { NextPage } from "next";
import ChallengeInbox from "@/components/mc/challenges/ChallengeInbox";

const BattleInboxTestPage: NextPage = () => {
  return (
    <div className="min-h-screen bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-4xl">
        <ChallengeInbox />
      </div>
    </div>
  );
};

export default BattleInboxTestPage;