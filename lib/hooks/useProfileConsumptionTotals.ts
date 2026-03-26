// lib/hooks/useProfileConsumptionTotals.ts
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type ProfileConsumptionTotals = {
  episodes_watched: number;
  chapters_read: number;
};

function safeInt(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/**
 * Tries a list of RPCs and returns the first successful result.
 * Update RPC_CANDIDATES to match your actual existing RPC if needed.
 */
const RPC_CANDIDATES = [
  // ✅ If you know the exact one, put it first.
  "get_user_consumption_totals",
  "get_user_totals",
  "get_user_stats_totals",
  "get_user_progress_totals",
];

export function useProfileConsumptionTotals(userId: string | null) {
  const [totals, setTotals] = useState<ProfileConsumptionTotals | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setTotals(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function run() {
      setLoading(true);

      try {
        let lastError: any = null;

        for (const fn of RPC_CANDIDATES) {
          const { data, error } = await supabase.rpc(fn, { p_user_id: userId });

          if (!error) {
            // Support either a single object or a one-row array
            const row = Array.isArray(data) ? data?.[0] : data;

            const episodes = safeInt((row as any)?.episodes_watched ?? (row as any)?.episodes ?? (row as any)?.episode_count);
            const chapters = safeInt((row as any)?.chapters_read ?? (row as any)?.chapters ?? (row as any)?.chapter_count);

            if (!cancelled) setTotals({ episodes_watched: episodes, chapters_read: chapters });
            return;
          }

          lastError = error;
        }

        // if none succeeded, treat as "not available"
        if (!cancelled) setTotals(null);

        // Optional: log lastError for debugging
        // console.warn("No totals RPC succeeded", lastError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { totals, loading };
}