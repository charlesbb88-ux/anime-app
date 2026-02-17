"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Counts = {
  animeEpisodesWatchedCount: number;
  mangaChaptersReadCount: number;
};

type RpcRow = {
  anime_episodes_watched_count: number | string | null;
  manga_chapters_read_count: number | string | null;
};

function toInt(v: unknown) {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : 0;
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

export function useUserConsumptionCounts(profileId: string | null) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profileId) {
      setCounts(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);

      const { data, error } = await supabase.rpc("get_user_consumption_counts", {
        p_user_id: profileId,
      });

      if (cancelled) return;

      if (error || !data) {
        setCounts(null);
        setLoading(false);
        return;
      }

      // ✅ RETURNS TABLE => often comes back as [ { ... } ]
      const row: RpcRow | null = Array.isArray(data) ? (data[0] as RpcRow) : (data as RpcRow);

      if (!row) {
        setCounts(null);
        setLoading(false);
        return;
      }

      setCounts({
        animeEpisodesWatchedCount: toInt(row.anime_episodes_watched_count),
        mangaChaptersReadCount: toInt(row.manga_chapters_read_count),
      });

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  return { counts, loading };
}