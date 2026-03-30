"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { generateTitleFromAffinities } from "@/lib/generateTitle";
import type { McTitlePartsRow } from "@/lib/titleParts";

type RawMetaRow = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  wins: number | null;
  losses: number | null;
  account_level: number | null;
  account_xp: number | null;
  tag_id: number | null;
  tag_name: string | null;
  tag_level: number | null;
  tag_xp: number | null;
  progress_percent: number | null;
};

type AffinityRow = {
  tag_id: number;
  tag_name: string;
  tag_level: number;
  tag_xp: number;
  progress_percent: number;
};

export type McBattleUserMeta = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  wins: number;
  losses: number;
  level: number;
  xp: number;
  title: string;
};

export type McBattleUserMetaMap = Record<string, McBattleUserMeta>;

function safeNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function getTitlePartRows(tagIds: number[]): Promise<McTitlePartsRow[]> {
  if (tagIds.length === 0) return [];

  const { data, error } = await supabase
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
    .in("tag_id", tagIds);

  if (error) throw error;

  return ((data as any[] | null) ?? []).map((row) => ({
    tag_id: safeNumber(row?.tag_id, 0),
    tag_name: String(row?.tag_name ?? ""),
    normalized_tag_name: String(row?.normalized_tag_name ?? ""),
    low_prefix: row?.low_prefix ?? null,
    low_class: row?.low_class ?? null,
    low_domain: row?.low_domain ?? null,
    mid_prefix: row?.mid_prefix ?? null,
    mid_class: row?.mid_class ?? null,
    mid_domain: row?.mid_domain ?? null,
    high_prefix: row?.high_prefix ?? null,
    high_class: row?.high_class ?? null,
    high_domain: row?.high_domain ?? null,
  }));
}

export function useMcBattleUserMetaMap(userIds: string[]) {
  const [metaMap, setMetaMap] = useState<McBattleUserMetaMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const stableUserIds = useMemo(() => {
    return Array.from(new Set(userIds.filter(Boolean))).sort();
  }, [userIds]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (stableUserIds.length === 0) {
        setMetaMap({});
        setLoading(false);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase.rpc("get_mc_battle_user_meta", {
          p_user_ids: stableUserIds,
        });

        if (error) throw error;

        const rows = (data as RawMetaRow[] | null) ?? [];

        const affinityMap = new Map<string, AffinityRow[]>();
        const baseMap = new Map<
          string,
          {
            username: string;
            avatarUrl: string | null;
            wins: number;
            losses: number;
            level: number;
            xp: number;
          }
        >();

        for (const row of rows) {
          const userId = String(row.user_id);

          if (!baseMap.has(userId)) {
            baseMap.set(userId, {
              username: row.username ?? "Player",
              avatarUrl: row.avatar_url ?? null,
              wins: safeNumber(row.wins, 0),
              losses: safeNumber(row.losses, 0),
              level: safeNumber(row.account_level, 1),
              xp: safeNumber(row.account_xp, 0),
            });
          }

          if (row.tag_id != null) {
            const nextAffinity: AffinityRow = {
              tag_id: safeNumber(row.tag_id, 0),
              tag_name: String(row.tag_name ?? ""),
              tag_level: safeNumber(row.tag_level, 1),
              tag_xp: safeNumber(row.tag_xp, 0),
              progress_percent: safeNumber(row.progress_percent, 0),
            };

            const existing = affinityMap.get(userId) ?? [];
            existing.push(nextAffinity);
            affinityMap.set(userId, existing);
          }
        }

        for (const userId of stableUserIds) {
          if (!baseMap.has(userId)) {
            baseMap.set(userId, {
              username: "Player",
              avatarUrl: null,
              wins: 0,
              losses: 0,
              level: 1,
              xp: 0,
            });
          }
        }

        const allTopTagIds = Array.from(
          new Set(
            stableUserIds.flatMap((userId) =>
              (affinityMap.get(userId) ?? [])
                .slice(0, 3)
                .map((tag) => tag.tag_id)
            )
          )
        );

        const titlePartRows = await getTitlePartRows(allTopTagIds);

        const nextMetaMap: McBattleUserMetaMap = {};

        for (const userId of stableUserIds) {
          const base = baseMap.get(userId)!;
          const affinities = affinityMap.get(userId) ?? [];
          const shortTitle = generateTitleFromAffinities(
            affinities,
            titlePartRows
          ).shortTitle;

          nextMetaMap[userId] = {
            userId,
            username: base.username,
            avatarUrl: base.avatarUrl,
            wins: base.wins,
            losses: base.losses,
            level: base.level,
            xp: base.xp,
            title: shortTitle || "Unranked Wanderer",
          };
        }

        if (!cancelled) {
          setMetaMap(nextMetaMap);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load battle user meta.");
          setMetaMap({});
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
  }, [stableUserIds]);

  return { metaMap, loading, error };
}