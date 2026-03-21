"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function McBattleViewTestPage() {
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
          challenger_user_id,
          defender_user_id,
          status,
          winner_user_id,
          ruleset_version,
          replay_version,
          rng_seed,
          challenger_snapshot,
          defender_snapshot,
          battle_result,
          replay_data,
          created_at,
          resolved_at
        `)
        .eq("id", trimmedBattleId)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Battle not found.");

      setBattle(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load battle.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-semibold">MC Battle View Test</h1>

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
            {loading ? "Loading..." : "Load Battle"}
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-3 text-lg font-semibold">Battle Row</h2>
          <pre className="overflow-x-auto whitespace-pre-wrap text-sm leading-6 text-white/90">
            {battle ? JSON.stringify(battle, null, 2) : "No battle loaded yet."}
          </pre>
        </div>
      </div>
    </div>
  );
}