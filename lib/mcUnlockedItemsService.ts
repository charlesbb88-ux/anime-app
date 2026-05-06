import { supabase } from "@/lib/supabaseClient";
import type { McPaperDollSlot } from "@/components/mc/paperdoll/mcPaperDollTypes";

export type UserMcUnlockedItem = {
  slot: McPaperDollSlot;
  item_id: string;
};

export async function getMyUnlockedMcItems(): Promise<UserMcUnlockedItem[]> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("You must be signed in.");
  }

  const { data, error } = await supabase
    .from("user_mc_unlocked_items")
    .select("slot,item_id")
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as UserMcUnlockedItem[];
}