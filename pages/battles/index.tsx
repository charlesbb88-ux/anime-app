"use client";

import type { NextPage } from "next";
import ChallengeInbox from "@/components/mc/challenges/ChallengeInbox";

const BattlesPage: NextPage = () => {
    return (
        <main className="min-h-screen text-black">
            <div className="mx-auto max-w-5xl px-4 pt-5 pb-8">
                <div className="mb-5">
                </div>

                <ChallengeInbox />
            </div>
        </main>
    );
};

export default BattlesPage;