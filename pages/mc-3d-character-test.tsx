"use client";

import Mc3DCharacter from "@/components/mc/Mc3DCharacter";

export default function Mc3DTestPage() {
  return (
    <div className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-semibold">3D Character Test</h1>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8">
          <Mc3DCharacter />
        </div>
      </div>
    </div>
  );
}