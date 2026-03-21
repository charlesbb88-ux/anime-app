"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import McBattleReplayCard from "@/components/mc/McBattleReplayCard";

export default function McBattleReplayTestPage() {
  const [battleId, setBattleId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [battle, setBattle] = useState<any | null>(null);

  async function handleLoadBattle() {
    setLoading(true);
    setError(null);
    setBattle(null);

    try {
      const trimmedBattleId = battleId.trim();

      if (!trimmedBattleId) {
        throw new Error("Please enter a battle id.");
      }

      const { data, error } = await supabase
        .from("mc_battles")
        .select(`
          id,
          challenger_snapshot,
          defender_snapshot,
          replay_data,
          battle_result
        `)
        .eq("id", trimmedBattleId)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Battle not found.");

      setBattle(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load battle replay.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold">MC Battle Replay Test</h1>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <label className="mb-2 block text-sm text-white/70">Battle id</label>

          <input
            value={battleId}
            onChange={(e) => setBattleId(e.target.value)}
            placeholder="Paste battle id"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
          />

          <button
            type="button"
            onClick={handleLoadBattle}
            disabled={loading}
            className="mt-4 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Loading..." : "Load Replay"}
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-6">
          {battle ? (
            <McBattleReplayCard
              challengerSnapshot={battle.challenger_snapshot}
              defenderSnapshot={battle.defender_snapshot}
              replayData={battle.replay_data}
            />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70">
              No replay loaded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}