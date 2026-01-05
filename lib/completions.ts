// lib/completions.ts
import { supabase } from "@/lib/supabaseClient";

export type CompletionItem = {
  kind: "anime" | "manga";
  id: string;
  title: string;
  image_url: string | null;
  slug: string | null;
  last_logged_at: string | null;
};

export async function fetchUserCompletions(userId: string) {
  const { data, error } = await supabase.rpc("get_user_completions", { p_user_id: userId });

  if (error) throw error;
  return (data ?? []) as CompletionItem[];
}
