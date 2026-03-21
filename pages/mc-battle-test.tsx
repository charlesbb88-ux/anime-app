"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { buildMcBattleSnapshot } from "@/lib/buildMcBattleSnapshot";
import { simulateMcBattle } from "@/lib/simulateMcBattle";
import type { McBattleFighterSnapshot } from "@/lib/mcBattleTypes";
import type { McBattleReplayData, McBattleResult } from "@/lib/mcBattleReplayTypes";

export default function McBattleTestPage() {
  const [defenderUserId, setDefenderUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [challengerSnapshot, setChallengerSnapshot] =
    useState<McBattleFighterSnapshot | null>(null);
  const [defenderSnapshot, setDefenderSnapshot] =
    useState<McBattleFighterSnapshot | null>(null);
  const [battleResult, setBattleResult] = useState<McBattleResult | null>(null);
  const [replayData, setReplayData] = useState<McBattleReplayData | null>(null);

  async function handleRunTestBattle() {
    setLoading(true);
    setError(null);
    setChallengerSnapshot(null);
    setDefenderSnapshot(null);
    setBattleResult(null);
    setReplayData(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user?.id) throw new Error("No authenticated user found.");

      const trimmedDefenderUserId = defenderUserId.trim();

      if (!trimmedDefenderUserId) {
        throw new Error("Please enter a defender user id.");
      }

      if (trimmedDefenderUserId === user.id) {
        throw new Error("Challenger and defender cannot be the same user.");
      }

      const challenger = await buildMcBattleSnapshot(user.id);
      const defender = await buildMcBattleSnapshot(trimmedDefenderUserId);

      const sim = simulateMcBattle(challenger, defender);

      setChallengerSnapshot(challenger);
      setDefenderSnapshot(defender);
      setBattleResult(sim.battleResult);
      setReplayData(sim.replayData);
    } catch (e: any) {
      setError(e?.message ?? "Failed to run test battle.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-semibold">MC Battle Test</h1>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <label className="mb-2 block text-sm text-white/70">Defender user id</label>
          <input
            value={defenderUserId}
            onChange={(e) => setDefenderUserId(e.target.value)}
            placeholder="Paste defender user id"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
          />

          <button
            type="button"
            onClick={handleRunTestBattle}
            disabled={loading}
            className="mt-4 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Running..." : "Run Test Battle"}
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="mb-3 text-lg font-semibold">Challenger Snapshot</h2>
            <pre className="overflow-x-auto whitespace-pre-wrap text-sm leading-6 text-white/90">
              {challengerSnapshot ? JSON.stringify(challengerSnapshot, null, 2) : "No data yet."}
            </pre>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="mb-3 text-lg font-semibold">Defender Snapshot</h2>
            <pre className="overflow-x-auto whitespace-pre-wrap text-sm leading-6 text-white/90">
              {defenderSnapshot ? JSON.stringify(defenderSnapshot, null, 2) : "No data yet."}
            </pre>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="mb-3 text-lg font-semibold">Battle Result</h2>
            <pre className="overflow-x-auto whitespace-pre-wrap text-sm leading-6 text-white/90">
              {battleResult ? JSON.stringify(battleResult, null, 2) : "No data yet."}
            </pre>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="mb-3 text-lg font-semibold">Replay Data</h2>
            <pre className="overflow-x-auto whitespace-pre-wrap text-sm leading-6 text-white/90">
              {replayData ? JSON.stringify(replayData, null, 2) : "No data yet."}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}