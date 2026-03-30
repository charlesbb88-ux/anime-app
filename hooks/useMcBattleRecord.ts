import { useEffect, useState } from "react";
import {
  getUserMcBattleRecord,
  type McBattleRecord,
} from "@/lib/mcBattleRecordService";

export function useMcBattleRecord(userId: string | null) {
  const [record, setRecord] = useState<McBattleRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setRecord(null);
      setLoading(false);
      setError(null);
      return;
    }

    const safeUserId = userId;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const next = await getUserMcBattleRecord(safeUserId);

        if (!cancelled) {
          setRecord(next);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load battle record.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { record, loading, error };
}