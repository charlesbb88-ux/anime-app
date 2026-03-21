"use client";

import McBattleRig from "@/components/mc/McBattleRig";

export default function McRigTestPage() {
  return (
    <div className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-semibold">MC Rig Test</h1>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8">
          <div className="flex min-h-[520px] items-end justify-center gap-24 overflow-hidden rounded-[2rem] border border-white/10 bg-black/30 p-8">
            <McBattleRig facing="right" pose="idle" />
            <McBattleRig facing="left" pose="attack" />
          </div>
        </div>
      </div>
    </div>
  );
}