import { supabase } from "@/lib/supabaseClient";
import { generateTitleFromAffinities } from "@/lib/generateTitle";
import type { McTitlePartsRow } from "@/lib/titleParts";
import type { CharacterAvatarLayer } from "@/components/mc/avatarTypes";
import type { McBattleFighterSnapshot } from "@/lib/mcBattleTypes";

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

type AffinityRow = {
  tag_id: number;
  tag_name: string;
  tag_level: number;
  tag_xp: number;
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

export async function buildMcBattleSnapshot(
  userId: string
): Promise<McBattleFighterSnapshot> {
  const [
    { data: accountData, error: accountError },
    { data: affinityData, error: affinityError },
    { data: baseStatsData, error: baseStatsError },
    { data: combatStatsData, error: combatStatsError },
    { data: profileData, error: profileError },
    { data: userCharacterData, error: userCharacterError },
  ] = await Promise.all([
    supabase.rpc("get_account_progression", { p_user_id: userId }),
    supabase.rpc("get_user_progression_detailed", { p_user_id: userId }),
    supabase.rpc("get_user_base_stats", { p_user_id: userId }),
    supabase.rpc("get_user_combat_stats", { p_user_id: userId }),
    supabase.from("profiles").select("username").eq("id", userId).maybeSingle(),
    supabase
      .from("user_mc_characters")
      .select("base_body_id, pose_id")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (accountError) throw accountError;
  if (affinityError) throw affinityError;
  if (baseStatsError) throw baseStatsError;
  if (combatStatsError) throw combatStatsError;
  if (profileError) throw profileError;
  if (userCharacterError) throw userCharacterError;

  const rawAccount = ((accountData as any[] | null) ?? [])[0] ?? null;

  const normalizedAccount: AccountProgressionRow | null = rawAccount
    ? {
        user_id: String(rawAccount.user_id ?? userId),
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

  const titleData = generateTitleFromAffinities(normalizedAffinities, normalizedTitlePartRows);

  const accountLevel = normalizedAccount?.account_level ?? 1;
  const username = profileData?.username ?? "Player";
  const rank = getRankFromLevel(accountLevel);
  const title = titleData.fullTitle;

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

    const { data: defaultPoseData, error: defaultPoseError } = await supabase
      .from("mc_poses")
      .select("id")
      .eq("pose_key", "neutral_front_v1")
      .maybeSingle();

    if (defaultBodyError) throw defaultBodyError;
    if (defaultPoseError) throw defaultPoseError;

    activeBaseBodyId = safeNumber(defaultBodyData?.id, 0);
    activePoseId = safeNumber(defaultPoseData?.id, 0);
  }

  let avatarLayers: CharacterAvatarLayer[] = [];

  if (activeBaseBodyId && activePoseId) {
    const { data: equippedRows, error: equippedError } = await supabase
      .from("user_mc_equipped_assets")
      .select("slot_key, asset_id")
      .eq("user_id", userId);

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

    const defaultAssets: CharacterAvatarLayer[] = ((defaultAssetsData as any[] | null) ?? []).map(
      (row) => ({
        asset_id: safeNumber(row.id, 0),
        asset_key: String(row.asset_key ?? ""),
        slot_key: String(row.slot_key ?? ""),
        asset_kind: String(row.asset_kind ?? "shape") as "shape" | "image",
        image_url: row.image_url ? String(row.image_url) : null,
        shape_data: row.shape_data ?? null,
        layer_order: safeNumber(row.layer_order, 0),
      })
    );

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

    avatarLayers = [
      ...defaultAssets.filter((asset) => !equippedSlotSet.has(asset.slot_key)),
      ...equippedAssets,
    ].sort((a, b) => a.layer_order - b.layer_order);
  }

  const baseStatsByKey = {
    strength: 0,
    agility: 0,
    intelligence: 0,
    vitality: 0,
    luck: 0,
    perception: 0,
    endurance: 0,
    willpower: 0,
    charisma: 0,
  };

  for (const stat of normalizedBaseStats) {
    if (stat.stat_key in baseStatsByKey) {
      baseStatsByKey[stat.stat_key as keyof typeof baseStatsByKey] = safeNumber(
        stat.stat_value,
        0
      );
    }
  }

  const combatStatsByKey = {
    hp: 0,
    attack: 0,
    defense: 0,
    magic_attack: 0,
    speed: 0,
  };

  for (const stat of normalizedCombatStats) {
    if (stat.stat_key in combatStatsByKey) {
      combatStatsByKey[stat.stat_key as keyof typeof combatStatsByKey] = safeNumber(
        stat.stat_value,
        0
      );
    }
  }

  return {
    user_id: userId,
    username,
    account_level: accountLevel,
    rank,
    title,
    base_stats: baseStatsByKey,
    combat_stats: combatStatsByKey,
    avatar: {
      base_body_id: activeBaseBodyId,
      pose_id: activePoseId,
      layers: avatarLayers,
    },
    equipped_abilities: [],
  };
}