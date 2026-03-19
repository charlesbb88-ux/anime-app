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
import type {
  CharacterAvatarLayer,
  CharacterLoadoutOptionGroup,
} from "@/components/mc/avatarTypes";
import CharacterLoadoutEditor from "@/components/mc/CharacterLoadoutEditor";

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
  const [avatarLayers, setAvatarLayers] = useState<CharacterAvatarLayer[]>([]);
  const [loadoutOptions, setLoadoutOptions] = useState<CharacterLoadoutOptionGroup[]>([]);
  const [savingSlotKey, setSavingSlotKey] = useState<string | null>(null);

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
            setAvatarLayers([]);
            setLoadoutOptions([]);
            setSavingSlotKey(null);
            setLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setUserId(user.id);
        }

        const { error: ensureCharacterError } = await supabase.rpc(
          "ensure_user_mc_character",
          { p_user_id: user.id }
        );

        if (ensureCharacterError) throw ensureCharacterError;

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

        let normalizedAvatarLayers: CharacterAvatarLayer[] = [];
        let normalizedLoadoutOptions: CharacterLoadoutOptionGroup[] = [];

        const { data: userCharacterData, error: userCharacterError } = await supabase
          .from("user_mc_characters")
          .select("base_body_id, pose_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (userCharacterError) throw userCharacterError;

        let activeBaseBodyId: number | null = null;
        let activePoseId: number | null = null;

        if (userCharacterData) {
          activeBaseBodyId = safeNumber(userCharacterData.base_body_id, 0);
          activePoseId = safeNumber(userCharacterData.pose_id, 0);
        } else {
          const { data: defaultBodyData, error: defaultBodyError } = await supabase
            .from("mc_base_bodies")
            .select("id")
            .eq("body_key", "base_neutral_v1")
            .maybeSingle();

          if (defaultBodyError) throw defaultBodyError;

          const { data: defaultPoseData, error: defaultPoseError } = await supabase
            .from("mc_poses")
            .select("id")
            .eq("pose_key", "neutral_front_v1")
            .maybeSingle();

          if (defaultPoseError) throw defaultPoseError;

          activeBaseBodyId = safeNumber(defaultBodyData?.id, 0);
          activePoseId = safeNumber(defaultPoseData?.id, 0);
        }

        if (activeBaseBodyId && activePoseId) {
          const { data: equippedRows, error: equippedError } = await supabase
            .from("user_mc_equipped_assets")
            .select("slot_key, asset_id")
            .eq("user_id", user.id);

          if (equippedError) throw equippedError;

          const equippedBySlot = new Map<string, number>();

          for (const row of (equippedRows as any[] | null) ?? []) {
            equippedBySlot.set(String(row.slot_key ?? ""), safeNumber(row.asset_id, 0));
          }

          const { data: defaultAssetsData, error: defaultAssetsError } = await supabase
            .from("mc_assets")
            .select("id, asset_key, slot_key, asset_kind, image_url, shape_data, layer_order")
            .eq("base_body_id", activeBaseBodyId)
            .eq("pose_id", activePoseId)
            .eq("is_default", true)
            .eq("is_active", true);

          if (defaultAssetsError) throw defaultAssetsError;

          const defaultAssets = ((defaultAssetsData as any[] | null) ?? []).map((row) => ({
            asset_id: safeNumber(row.id, 0),
            asset_key: String(row.asset_key ?? ""),
            slot_key: String(row.slot_key ?? ""),
            asset_kind: String(row.asset_kind ?? "shape") as "shape" | "image",
            image_url: row.image_url ? String(row.image_url) : null,
            shape_data: row.shape_data ?? null,
            layer_order: safeNumber(row.layer_order, 0),
          }));

          const equippedAssetIds = Array.from(equippedBySlot.values()).filter((id) => id > 0);

          let equippedAssets: CharacterAvatarLayer[] = [];

          if (equippedAssetIds.length > 0) {
            const { data: equippedAssetsData, error: equippedAssetsError } = await supabase
              .from("mc_assets")
              .select("id, asset_key, slot_key, asset_kind, image_url, shape_data, layer_order")
              .in("id", equippedAssetIds)
              .eq("is_active", true);

            if (equippedAssetsError) throw equippedAssetsError;

            equippedAssets = ((equippedAssetsData as any[] | null) ?? []).map((row) => ({
              asset_id: safeNumber(row.id, 0),
              asset_key: String(row.asset_key ?? ""),
              slot_key: String(row.slot_key ?? ""),
              asset_kind: String(row.asset_kind ?? "shape") as "shape" | "image",
              image_url: row.image_url ? String(row.image_url) : null,
              shape_data: row.shape_data ?? null,
              layer_order: safeNumber(row.layer_order, 0),
            }));
          }

          const equippedSlotSet = new Set(equippedAssets.map((asset) => asset.slot_key));

          normalizedAvatarLayers = [
            ...defaultAssets.filter((asset) => !equippedSlotSet.has(asset.slot_key)),
            ...equippedAssets,
          ].sort((a, b) => a.layer_order - b.layer_order);

          const editableSlots = ["hair_front", "hair_back", "aura_front"];

          const { data: ownedAssetsData, error: ownedAssetsError } = await supabase
            .from("user_mc_owned_assets")
            .select(`
              asset_id,
              mc_assets!inner (
                id,
                asset_key,
                display_name,
                slot_key,
                asset_kind,
                image_url,
                shape_data,
                layer_order,
                base_body_id,
                pose_id,
                is_active
              )
            `)
            .eq("user_id", user.id);

          if (ownedAssetsError) throw ownedAssetsError;

          const grouped = new Map<string, CharacterLoadoutOptionGroup>();

          for (const slotKey of editableSlots) {
            grouped.set(slotKey, {
              slotKey,
              slotLabel:
                slotKey === "hair_front"
                  ? "Hair Front"
                  : slotKey === "hair_back"
                    ? "Hair Back"
                    : "Aura Front",
              options: [],
            });
          }

          for (const row of (ownedAssetsData as any[] | null) ?? []) {
            const asset = row.mc_assets;
            if (!asset) continue;

            const slotKey = String(asset.slot_key ?? "");
            if (!editableSlots.includes(slotKey)) continue;
            if (!grouped.has(slotKey)) continue;

            const assetBaseBodyId = safeNumber(asset.base_body_id, 0);
            const assetPoseId = safeNumber(asset.pose_id, 0);

            if (assetBaseBodyId !== activeBaseBodyId || assetPoseId !== activePoseId) {
              continue;
            }

            grouped.get(slotKey)!.options.push({
              assetId: safeNumber(asset.id, 0),
              assetKey: String(asset.asset_key ?? ""),
              displayName: String(asset.display_name ?? ""),
              slotKey,
              assetKind: String(asset.asset_kind ?? "shape") as "shape" | "image",
              imageUrl: asset.image_url ? String(asset.image_url) : null,
              shapeData: asset.shape_data ?? null,
              layerOrder: safeNumber(asset.layer_order, 0),
              isEquipped: equippedBySlot.get(slotKey) === safeNumber(asset.id, 0),
            });
          }

          normalizedLoadoutOptions = Array.from(grouped.values());
        }

        if (!cancelled) {
          setAccount(normalizedAccount);
          setAffinities(normalizedAffinities);
          setTitlePartRows(normalizedTitlePartRows);
          setBaseStats(normalizedBaseStats);
          setCombatStats(normalizedCombatStats);
          setAvatarLayers(normalizedAvatarLayers);
          setLoadoutOptions(normalizedLoadoutOptions);
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

  async function handleEquipAsset(slotKey: string, assetId: number) {
    if (!userId) return;

    try {
      setSavingSlotKey(slotKey);

      const { error: equipError } = await supabase
        .from("user_mc_equipped_assets")
        .upsert(
          {
            user_id: userId,
            slot_key: slotKey,
            asset_id: assetId,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,slot_key",
          }
        );

      if (equipError) throw equipError;

      setAvatarLayers((prev) => {
        const replacementGroup = loadoutOptions
          .find((group) => group.slotKey === slotKey)
          ?.options.find((option) => option.assetId === assetId);

        if (!replacementGroup) return prev;

        const next = prev.filter((layer) => layer.slot_key !== slotKey);

        next.push({
          asset_id: replacementGroup.assetId,
          asset_key: replacementGroup.assetKey,
          slot_key: replacementGroup.slotKey,
          asset_kind: replacementGroup.assetKind,
          image_url: replacementGroup.imageUrl,
          shape_data: replacementGroup.shapeData,
          layer_order: replacementGroup.layerOrder,
        });

        return next.sort((a, b) => a.layer_order - b.layer_order);
      });

      setLoadoutOptions((prev) =>
        prev.map((group) => {
          if (group.slotKey !== slotKey) return group;

          return {
            ...group,
            options: group.options.map((option) => ({
              ...option,
              isEquipped: option.assetId === assetId,
            })),
          };
        })
      );
    } catch (e: any) {
      setError(e?.message ?? "Failed to equip asset.");
    } finally {
      setSavingSlotKey(null);
    }
  }

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
          <>
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
                  avatarLayers={avatarLayers}
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

            <CharacterLoadoutEditor
              groups={loadoutOptions}
              savingSlotKey={savingSlotKey}
              onEquip={handleEquipAsset}
            />
          </>
        )}
      </div>
    </div>
  );
}