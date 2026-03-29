"use client";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import McBattleFeed from "@/components/mc/battles/McBattleFeed";

export default function UserBattlesPage() {
  const router = useRouter();
  const { username } = router.query;

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!username || typeof username !== "string") return;

    async function loadUser() {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .single();

      if (data?.id) {
        setUserId(data.id);
      }
    }

    loadUser();
  }, [username]);

  if (!userId) {
    return <div className="p-6 text-white">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-white">
        {username}'s Battles
      </h1>

      <McBattleFeed
        userId={userId}
        initialLimit={10}
        pageSize={10}
      />
    </div>
  );
}