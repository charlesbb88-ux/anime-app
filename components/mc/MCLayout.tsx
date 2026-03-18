"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { generateTitleFromAffinities } from "@/lib/generateTitle";
import type { McTitlePartsRow } from "@/lib/titleParts";
import CharacterPanel from "@/components/mc/CharacterPanel";
import ProfileCard from "@/components/mc/ProfileCard";
import StatsCard from "@/components/mc/StatsCard";
import CombatStatsCard from "@/components/mc/CombatStatsCard";
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

type BaseStatRow = {
  stat_key: string;
  display_name: string;
  description: string | null;
  sort_order: number;
  account_level: number;
  base_value: number;
  growth_per_level: number;
  growth_curve: string;
  stat_value: number;
};

type CombatStatRow = {
  stat_key: string;
  display_name: string;
  sort_order: number;
  account_level: number;
  stat_value: number;
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
  const [titlePartRows, setTitlePartRows] = useState<McTitlePartsRow[]>([]);
  const [baseStats, setBaseStats] = useState<BaseStatRow[]>([]);
  const [combatStats, setCombatStats] = useState<CombatStatRow[]>([]);

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
            setTitlePartRows([]);
            setBaseStats([]);
            setCombatStats([]);
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
          { data: baseStatsData, error: baseStatsError },
          { data: combatStatsData, error: combatStatsError },
          { data: profileData, error: profileError },
        ] = await Promise.all([
          supabase.rpc("get_account_progression", { p_user_id: user.id }),
          supabase.rpc("get_user_progression_detailed", { p_user_id: user.id }),
          supabase.rpc("get_user_base_stats", { p_user_id: user.id }),
          supabase.rpc("get_user_combat_stats", { p_user_id: user.id }),
          supabase.from("profiles").select("username").eq("id", user.id).maybeSingle(),
        ]);

        if (accountError) throw accountError;
        if (affinityError) throw affinityError;
        if (baseStatsError) throw baseStatsError;
        if (combatStatsError) throw combatStatsError;
        if (profileError) throw profileError;

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

        const normalizedBaseStats: BaseStatRow[] = ((baseStatsData as any[] | null) ?? []).map(
          (stat) => ({
            stat_key: String(stat.stat_key ?? ""),
            display_name: String(stat.display_name ?? ""),
            description: stat.description ? String(stat.description) : null,
            sort_order: safeNumber(stat.sort_order, 0),
            account_level: safeNumber(stat.account_level, 1),
            base_value: safeNumber(stat.base_value, 0),
            growth_per_level: safeNumber(stat.growth_per_level, 0),
            growth_curve: String(stat.growth_curve ?? "linear"),
            stat_value: safeNumber(stat.stat_value, 0),
          })
        );

        const normalizedCombatStats: CombatStatRow[] = ((combatStatsData as any[] | null) ?? []).map(
          (stat) => ({
            stat_key: String(stat.stat_key ?? ""),
            display_name: String(stat.display_name ?? ""),
            sort_order: safeNumber(stat.sort_order, 0),
            account_level: safeNumber(stat.account_level, 1),
            stat_value: safeNumber(stat.stat_value, 0),
          })
        );

        const topTagIds = normalizedAffinities.slice(0, 3).map((tag) => tag.tag_id);

        let normalizedTitlePartRows: McTitlePartsRow[] = [];

        if (topTagIds.length > 0) {
          const { data: titlePartsData, error: titlePartsError } = await supabase
            .from("mc_title_parts")
            .select(`
              tag_id,
              tag_name,
              normalized_tag_name,
              low_prefix,
              low_class,
              low_domain,
              mid_prefix,
              mid_class,
              mid_domain,
              high_prefix,
              high_class,
              high_domain
            `)
            .in("tag_id", topTagIds);

          if (titlePartsError) throw titlePartsError;

          normalizedTitlePartRows = ((titlePartsData as any[] | null) ?? []).map((row) => ({
            tag_id: safeNumber(row.tag_id, 0),
            tag_name: String(row.tag_name ?? ""),
            normalized_tag_name: String(row.normalized_tag_name ?? ""),
            low_prefix: row.low_prefix ?? null,
            low_class: row.low_class ?? null,
            low_domain: row.low_domain ?? null,
            mid_prefix: row.mid_prefix ?? null,
            mid_class: row.mid_class ?? null,
            mid_domain: row.mid_domain ?? null,
            high_prefix: row.high_prefix ?? null,
            high_class: row.high_class ?? null,
            high_domain: row.high_domain ?? null,
          }));
        }

        if (!cancelled) {
          setAccount(normalizedAccount);
          setAffinities(normalizedAffinities);
          setTitlePartRows(normalizedTitlePartRows);
          setBaseStats(normalizedBaseStats);
          setCombatStats(normalizedCombatStats);
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
  const titleData = generateTitleFromAffinities(affinities, titlePartRows);
  const shortTitle = titleData.shortTitle;
  const fullTitle = titleData.fullTitle;

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
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(320px,1fr)_320px] lg:grid-rows-[auto_auto_auto]">
            <div className="lg:col-start-1 lg:row-start-1">
              <ProfileCard
                accountLevel={accountLevel}
                accountXp={accountXp}
                progressPercent={progressPercent}
                progressIntoLevel={progressIntoLevel}
                progressNeededInLevel={progressNeededInLevel}
                title={shortTitle}
                rank={rank}
              />
            </div>

            <div className="lg:col-start-1 lg:row-start-2">
              <StatsCard stats={baseStats} />
            </div>

            <div className="lg:col-start-2 lg:row-start-1 lg:row-span-3">
              <CharacterPanel
                username={username}
                title={fullTitle}
                rank={rank}
                titleDebug={titleData}
              />
            </div>

            <div className="lg:col-start-3 lg:row-start-1">
              <AbilitiesCard />
            </div>

            <div className="lg:col-start-3 lg:row-start-2">
              <CombatStatsCard stats={combatStats} />
            </div>

            <div className="lg:col-start-3 lg:row-start-3">
              <AffinitiesCard affinities={affinities} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}