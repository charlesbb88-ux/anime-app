"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { AffinityList, type AffinityRow } from "@/components/mc/AffinitiesCard";

function safeNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default function Page() {
  const router = useRouter();
  const { username } = router.query;

  const [affinities, setAffinities] = useState<AffinityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username || typeof username !== "string") return;

    async function load() {
      // 1. get user id
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();

      if (!profile) {
        setLoading(false);
        return;
      }

      // 2. get affinities
      const { data: affinityData } = await supabase.rpc(
        "get_user_progression_detailed",
        { p_user_id: profile.id }
      );

      const normalized: AffinityRow[] = ((affinityData as any[]) ?? []).map(
        (tag) => ({
          tag_id: safeNumber(tag.tag_id, 0),
          tag_name: String(tag.tag_name ?? ""),
          tag_level: safeNumber(tag.tag_level, 1),
          tag_xp: safeNumber(tag.tag_xp, 0),
          progress_percent: safeNumber(tag.progress_percent, 0),
        })
      );

      setAffinities(normalized);
      setLoading(false);
    }

    load();
  }, [username]);

  if (loading) {
    return <div className="p-4 text-black">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="rounded-md border-2 border-black bg-white px-4 py-2 text-black">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-black">
          All Affinities
        </div>

        <AffinityList affinities={affinities} />
      </div>
    </div>
  );
}