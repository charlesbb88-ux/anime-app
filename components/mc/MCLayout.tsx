"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { generateArchetype } from "@/lib/mc/archetypes";
import CharacterPanel from "@/components/mc/CharacterPanel";
import ProfileCard from "@/components/mc/ProfileCard";
import StatsCard from "@/components/mc/StatsCard";
import AbilitiesCard from "@/components/mc/AbilitiesCard";
import AffinitiesCard, { type AffinityRow } from "@/components/mc/AffinitiesCard";

type AccountProgressionRow = {
  user_id: string;
  account_level: number;
  account_xp: number;
  current_level_floor_xp: number;
  next_level_xp: number;
  progress_into_level: number;
  progress_needed_in_level: number;
  progress_percent: number;
};

function safeNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getRankFromLevel(level: number) {
  if (level >= 90) return "SSS Rank";
  if (level >= 75) return "SS Rank";
  if (level >= 60) return "S Rank";
  if (level >= 50) return "A Rank";
  if (level >= 40) return "B Rank";
  if (level >= 30) return "C Rank";
  if (level >= 20) return "D Rank";
  if (level >= 10) return "E Rank";
  return "F Rank";
}

export default function MCLayout() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("Player");
  const [account, setAccount] = useState<AccountProgressionRow | null>(null);
  const [affinities, setAffinities] = useState<AffinityRow[]>([]);

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

        if (!user) {
          if (!cancelled) {
            setUserId(null);
            setUsername("Player");
            setAccount(null);
            setAffinities([]);
            setLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setUserId(user.id);
        }

        const [
          { data: accountData, error: accountError },
          { data: affinityData, error: affinityError },
          { data: profileData, error: profileError },
        ] = await Promise.all([
          supabase.rpc("get_account_progression", { p_user_id: user.id }),
          supabase.rpc("get_user_progression_detailed", { p_user_id: user.id }),
          supabase
            .from("profiles")
            .select("username")
            .eq("id", user.id)
            .maybeSingle(),
        ]);

        if (accountError) throw accountError;
        if (affinityError) throw affinityError;
        if (profileError) throw profileError;

        if (!cancelled) {
          const rawAccount = ((accountData as any[] | null) ?? [])[0] ?? null;

          const normalizedAccount: AccountProgressionRow | null = rawAccount
            ? {
                user_id: String(rawAccount.user_id ?? user.id),
                account_level: safeNumber(rawAccount.account_level, 1),
                account_xp: safeNumber(rawAccount.account_xp, 0),
                current_level_floor_xp: safeNumber(rawAccount.current_level_floor_xp, 0),
                next_level_xp: safeNumber(rawAccount.next_level_xp, 0),
                progress_into_level: safeNumber(rawAccount.progress_into_level, 0),
                progress_needed_in_level: safeNumber(rawAccount.progress_needed_in_level, 0),
                progress_percent: safeNumber(rawAccount.progress_percent, 0),
              }
            : null;

          const normalizedAffinities: AffinityRow[] = ((affinityData as any[] | null) ?? []).map(
            (tag) => ({
              tag_id: safeNumber(tag.tag_id, 0),
              tag_name: String(tag.tag_name ?? ""),
              tag_level: safeNumber(tag.tag_level, 1),
              tag_xp: safeNumber(tag.tag_xp, 0),
              progress_percent: safeNumber(tag.progress_percent, 0),
            })
          );

          setAccount(normalizedAccount);
          setAffinities(normalizedAffinities);
          setUsername(profileData?.username ?? "Player");
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load MC page.");
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const accountLevel = account?.account_level ?? 1;
  const accountXp = account?.account_xp ?? 0;
  const progressPercent = account?.progress_percent ?? 0;
  const progressIntoLevel = account?.progress_into_level ?? 0;
  const progressNeededInLevel = account?.progress_needed_in_level ?? 0;

  const rank = getRankFromLevel(accountLevel);
  const title = generateArchetype(affinities);

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">MC</h1>
          <p className="mt-2 text-sm text-white/60">
            Character overview, progression, abilities, and affinities.
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            Loading...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-200">
            {error}
          </div>
        ) : !userId ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            You must be logged in to view this page.
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(320px,1fr)_320px] lg:grid-rows-[auto_auto]">
            <div className="lg:col-start-1 lg:row-start-1">
              <ProfileCard
                accountLevel={accountLevel}
                accountXp={accountXp}
                progressPercent={progressPercent}
                progressIntoLevel={progressIntoLevel}
                progressNeededInLevel={progressNeededInLevel}
                title={title}
                rank={rank}
              />
            </div>

            <div className="lg:col-start-1 lg:row-start-2">
              <StatsCard />
            </div>

            <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2">
              <CharacterPanel
                username={username}
                title={title}
                rank={rank}
              />
            </div>

            <div className="lg:col-start-3 lg:row-start-1">
              <AbilitiesCard />
            </div>

            <div className="lg:col-start-3 lg:row-start-2">
              <AffinitiesCard affinities={affinities} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}