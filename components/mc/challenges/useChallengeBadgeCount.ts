"use client";

import { useCallback, useEffect, useState } from "react";
import { getChallengeInbox } from "@/lib/mcChallenges";

export function useChallengeBadgeCount() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    refresh();

    function handleFocus() {
      refresh();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refresh();
      }
    }

    function handlePageShow() {
      refresh();
    }

    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refresh]);

  return {
    count,
    loading,
    error,
    refresh,
  };
}