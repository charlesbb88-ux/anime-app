"use client";

import { supabase } from "@/lib/supabaseClient";
import type { McPaperDollLoadout } from "@/components/mc/paperdoll/mcPaperDollTypes";
import { DEFAULT_MC_PAPERDOLL_LOADOUT } from "@/components/mc/paperdoll/mcPaperDollCatalog";

export type UserMcPaperDollLoadoutRow = {
  user_id: string;
  body_id: string;
  hair_id: string | null;
  torso_id: string | null;
  bottoms_id: string | null;
  feet_id: string | null;
  hands_id: string | null;
  eyes_id: string | null;
  created_at: string;
  updated_at: string;
};

const SELECT_COLUMNS = `
  user_id,
  body_id,
  hair_id,
  torso_id,
  bottoms_id,
  feet_id,
  hands_id,
  eyes_id,
  created_at,
  updated_at
`;

function rowToLoadout(row: UserMcPaperDollLoadoutRow): McPaperDollLoadout {
  return {
    body: row.body_id,
    hair: row.hair_id,
    torso: row.torso_id,
    bottoms: row.bottoms_id,
    feet: row.feet_id,
    hands: row.hands_id,
    eyes: row.eyes_id,
  };
}

function loadoutToRow(loadout: McPaperDollLoadout) {
  return {
    body_id: loadout.body,
    hair_id: loadout.hair ?? null,
    torso_id: loadout.torso ?? null,
    bottoms_id: loadout.bottoms ?? null,
    feet_id: loadout.feet ?? null,
    hands_id: loadout.hands ?? null,
    eyes_id: loadout.eyes ?? null,
  };
}

async function getSignedInUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) {
    throw new Error("You must be signed in to edit your MC character.");
  }

  return user.id;
}

export async function getOrCreateMyMcPaperDollLoadout(): Promise<McPaperDollLoadout> {
  const userId = await getSignedInUserId();

  const { data, error } = await supabase
    .from("user_mc_paperdoll_loadouts")
    .select(SELECT_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    return rowToLoadout(data as UserMcPaperDollLoadoutRow);
  }

  const insertPayload = {
    user_id: userId,
    ...loadoutToRow(DEFAULT_MC_PAPERDOLL_LOADOUT),
  };

  const { data: inserted, error: insertError } = await supabase
    .from("user_mc_paperdoll_loadouts")
    .insert(insertPayload)
    .select(SELECT_COLUMNS)
    .single();

  if (insertError) throw insertError;

  return rowToLoadout(inserted as UserMcPaperDollLoadoutRow);
}

export async function saveMyMcPaperDollLoadout(
  loadout: McPaperDollLoadout
): Promise<McPaperDollLoadout> {
  const userId = await getSignedInUserId();

  const { data, error } = await supabase
    .from("user_mc_paperdoll_loadouts")
    .upsert(
      {
        user_id: userId,
        ...loadoutToRow(loadout),
      },
      { onConflict: "user_id" }
    )
    .select(SELECT_COLUMNS)
    .single();

  if (error) throw error;

  return rowToLoadout(data as UserMcPaperDollLoadoutRow);
}

export async function getMcPaperDollLoadoutByUserId(
  userId: string
): Promise<McPaperDollLoadout | null> {
  const { data, error } = await supabase
    .from("user_mc_paperdoll_loadouts")
    .select(SELECT_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return null;
  }

  return rowToLoadout(data as UserMcPaperDollLoadoutRow);
}