"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { buildMcBattleSnapshot } from "@/lib/buildMcBattleSnapshot";
import type { McBattleFighterSnapshot } from "@/lib/mcBattleTypes";

export default function McSnapshotTestPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<McBattleFighterSnapshot | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user?.id) throw new Error("No authenticated user found.");

        if (!cancelled) {
          setUserId(user.id);
        }

        const nextSnapshot = await buildMcBattleSnapshot(user.id);

        if (!cancelled) {
          setSnapshot(nextSnapshot);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to build MC battle snapshot.");
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold">MC Snapshot Test</h1>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/70">
            Auth user id: {userId ?? "loading..."}
          </div>
        </div>

        {loading ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            Building snapshot...
          </div>
        ) : error ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            {error}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <pre className="overflow-x-auto whitespace-pre-wrap text-sm leading-6 text-white/90">
              {JSON.stringify(snapshot, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}