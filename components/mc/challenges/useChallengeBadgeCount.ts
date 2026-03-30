"use client";

import { useEffect, useState } from "react";
import { getChallengeInbox } from "@/lib/mcChallenges";

export function useChallengeBadgeCount() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setError(null);
      setLoading(true);
      const inbox = await getChallengeInbox();
      setCount(inbox.badgeCount);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load badge count.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return {
    count,
    loading,
    error,
    refresh,
  };
}