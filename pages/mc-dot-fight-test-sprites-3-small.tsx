"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import McBattleReplayCard from "@/components/mc/battles/McBattleReplayCard";
import type { McBattleCardRow } from "@/components/mc/battles/mcBattleTypes";

export default function McDotFightTestPage() {
  const [battleRow, setBattleRow] = useState<McBattleCardRow | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadLatestBattle() {
    setLoading(true);

    const { data, error } = await supabase
      .from("mc_battles")
      .select(`
        id,
        challenger_user_id,
        defender_user_id,
        winner_user_id,
        created_at,
        battle_result,
        replay_data,
        challenger_snapshot,
        defender_snapshot
      `)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      setBattleRow(null);
      setLoading(false);
      return;
    }

    setBattleRow(data as McBattleCardRow);
    setLoading(false);
  }

  useEffect(() => {
    loadLatestBattle();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={loadLatestBattle}
            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
          >
            Load Latest Battle
          </button>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
            Loading latest battle...
          </div>
        ) : battleRow ? (
          <div className="space-y-4">
            <McBattleReplayCard battle={battleRow} />
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
            No battle found.
          </div>
        )}
      </div>
    </div>
  );
}