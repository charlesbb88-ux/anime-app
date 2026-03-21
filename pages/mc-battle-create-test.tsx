"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { createMcBattle } from "@/lib/createMcBattle";

export default function McBattleCreateTestPage() {
  const [defenderUserId, setDefenderUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdBattle, setCreatedBattle] = useState<any | null>(null);

  async function handleCreateBattle() {
    setLoading(true);
    setError(null);
    setCreatedBattle(null);

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

      const result = await createMcBattle(user.id, trimmedDefenderUserId);
      setCreatedBattle(result);
    } catch (e: any) {
      setError(e?.message ?? "Failed to create MC battle.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold">MC Battle Create Test</h1>

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
            onClick={handleCreateBattle}
            disabled={loading}
            className="mt-4 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Battle"}
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-3 text-lg font-semibold">Created Battle Row</h2>
          <pre className="overflow-x-auto whitespace-pre-wrap text-sm leading-6 text-white/90">
            {createdBattle ? JSON.stringify(createdBattle, null, 2) : "No battle created yet."}
          </pre>
        </div>
      </div>
    </div>
  );
}