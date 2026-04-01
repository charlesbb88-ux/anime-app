import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin"; // adjust if your path is different

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    global: {
      headers: {
        Authorization: req.headers.authorization || "",
      },
    },
  }
);

const {
  data: { user },
  error: userError,
} = await supabase.auth.getUser();

  if (userError || !user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const userId = user.id;

  try {
    // =========================
    // 1. Delete safe tables
    // =========================

    await supabaseAdmin.from("user_follows").delete().or(`follower_id.eq.${userId},following_id.eq.${userId}`);

    await supabaseAdmin.from("likes").delete().eq("user_id", userId);
    await supabaseAdmin.from("comment_likes").delete().eq("user_id", userId);
    await supabaseAdmin.from("activity_likes").delete().eq("user_id", userId);

    await supabaseAdmin.from("post_clicks").delete().eq("user_id", userId);
    await supabaseAdmin.from("post_impressions").delete().eq("user_id", userId);

    await supabaseAdmin.from("user_mc_equipped_assets").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_mc_owned_assets").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_mc_paperdoll_loadouts").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_mc_characters").delete().eq("user_id", userId);

    await supabaseAdmin.from("mc_challenges").delete().or(`challenger_user_id.eq.${userId},defender_user_id.eq.${userId}`);

    // =========================
    // 2. Anonymize profile
    // =========================

    const deletedUsername = `deleted-user-${userId.slice(0, 8)}`;

    await supabaseAdmin
      .from("profiles")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),

        username: deletedUsername,
        avatar_url: null,
        bio: null,
        backdrop_url: null,
        backdrop_pos_x: null,
        backdrop_pos_y: null,
        backdrop_zoom: null,
        about_markdown: null,
        about_html: null,
        about_updated_at: null,
        pinned_post_id: null,
      })
      .eq("id", userId);

    // =========================
    // 3. Delete auth user (THIS REMOVES EMAIL)
    // =========================

const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

if (deleteAuthError) {
  console.error("AUTH DELETE ERROR:", deleteAuthError);
  throw deleteAuthError;
}

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("DELETE ACCOUNT ERROR:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
}