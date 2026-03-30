"use client";

import type { NextPage } from "next";
import ChallengeInbox from "@/components/mc/challenges/ChallengeInbox";

const BattlesPage: NextPage = () => {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-4 pt-5 pb-8">
        <div className="mb-5">
          <div className="text-xs uppercase tracking-[0.2em] text-white/45">
            Battles
          </div>
          <h1 className="mt-1 text-2xl font-semibold">Battle inbox</h1>
        </div>

        <ChallengeInbox />
      </div>
    </main>
  );
};

export default BattlesPage;