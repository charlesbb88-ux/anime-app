"use client";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import McBattleFeed from "@/components/mc/battles/McBattleFeed";

export default function UserBattlesPage() {
  const router = useRouter();
  const { username } = router.query;

  const [userId, setUserId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username || typeof username !== "string") return;

    let cancelled = false;

    async function loadUser() {
      try {
        setLoadingUser(true);
        setError(null);

        const { data, error } = await supabase
          .from("profiles")
          .select("id, username")
          .eq("username", username)
          .single();

        if (error) throw error;

        if (!cancelled) {
          setUserId(data?.id ?? null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load user.");
        }
      } finally {
        if (!cancelled) {
          setLoadingUser(false);
        }
      }
    }

    loadUser();

    return () => {
      cancelled = true;
    };
  }, [username]);

  if (loadingUser) {
    return <div className="p-6 text-white">Loading battles...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-300">{error}</div>;
  }

  if (!userId) {
    return <div className="p-6 text-white">User not found.</div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-white">
        {username}&apos;s Battles
      </h1>

      <McBattleFeed userId={userId} initialLimit={10} pageSize={10} />
    </div>
  );
}