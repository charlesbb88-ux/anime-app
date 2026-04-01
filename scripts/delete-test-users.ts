declare const require: any;

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const { supabaseAdmin } = require("../lib/supabaseAdmin");

const USER_IDS = [
  // put test user ids here
  "f4ca41ac-5238-468e-bc9a-053688b9d66f",
];

async function must<T extends { error: any }>(label: string, result: T) {
  if (result.error) {
    console.error(`${label} failed:`, result.error);
    throw result.error;
  }
}

async function deleteUserCompletely(userId: string) {
  console.log(`\nDeleting user ${userId}...`);

  await must(
    "user_follows",
    await supabaseAdmin
      .from("user_follows")
      .delete()
      .or(`follower_id.eq.${userId},following_id.eq.${userId}`)
  );

  await must("likes", await supabaseAdmin.from("likes").delete().eq("user_id", userId));
  await must("comment_likes", await supabaseAdmin.from("comment_likes").delete().eq("user_id", userId));
  await must("activity_likes", await supabaseAdmin.from("activity_likes").delete().eq("user_id", userId));
  await must("post_clicks", await supabaseAdmin.from("post_clicks").delete().eq("user_id", userId));
  await must("post_impressions", await supabaseAdmin.from("post_impressions").delete().eq("user_id", userId));

  await must("activity", await supabaseAdmin.from("activity").delete().eq("user_id", userId));
  await must("activity_events", await supabaseAdmin.from("activity_events").delete().eq("user_id", userId));
  await must("anime_activity_events", await supabaseAdmin.from("anime_activity_events").delete().eq("user_id", userId));

  await must("anime_episode_logs", await supabaseAdmin.from("anime_episode_logs").delete().eq("user_id", userId));
  await must("anime_series_logs", await supabaseAdmin.from("anime_series_logs").delete().eq("user_id", userId));
  await must("manga_chapter_logs", await supabaseAdmin.from("manga_chapter_logs").delete().eq("user_id", userId));
  await must("manga_series_logs", await supabaseAdmin.from("manga_series_logs").delete().eq("user_id", userId));
  await must("manga_chapter_summaries", await supabaseAdmin.from("manga_chapter_summaries").delete().eq("user_id", userId));

  await must("comments", await supabaseAdmin.from("comments").delete().eq("user_id", userId));
  await must("posts", await supabaseAdmin.from("posts").delete().eq("user_id", userId));
  await must("ratings", await supabaseAdmin.from("ratings").delete().eq("user_id", userId));
  await must("reviews", await supabaseAdmin.from("reviews").delete().eq("user_id", userId));

  await must("user_anime_progress", await supabaseAdmin.from("user_anime_progress").delete().eq("user_id", userId));
  await must("user_marks", await supabaseAdmin.from("user_marks").delete().eq("user_id", userId));
  await must("user_library_items", await supabaseAdmin.from("user_library_items").delete().eq("user_id", userId));
  await must("user_journal_items", await supabaseAdmin.from("user_journal_items").delete().eq("user_id", userId));
  await must("user_series_stats", await supabaseAdmin.from("user_series_stats").delete().eq("user_id", userId));

  await must("progression_xp_events", await supabaseAdmin.from("progression_xp_events").delete().eq("user_id", userId));
  await must("user_progression", await supabaseAdmin.from("user_progression").delete().eq("user_id", userId));
  await must("user_tag_progression", await supabaseAdmin.from("user_tag_progression").delete().eq("user_id", userId));

  await must("user_mc_battle_stats", await supabaseAdmin.from("user_mc_battle_stats").delete().eq("user_id", userId));
  await must("user_mc_equipped_assets", await supabaseAdmin.from("user_mc_equipped_assets").delete().eq("user_id", userId));
  await must("user_mc_owned_assets", await supabaseAdmin.from("user_mc_owned_assets").delete().eq("user_id", userId));
  await must("user_mc_paperdoll_loadouts", await supabaseAdmin.from("user_mc_paperdoll_loadouts").delete().eq("user_id", userId));
  await must("user_mc_characters", await supabaseAdmin.from("user_mc_characters").delete().eq("user_id", userId));

  await must(
    "mc_challenges",
    await supabaseAdmin
      .from("mc_challenges")
      .delete()
      .or(`challenger_user_id.eq.${userId},defender_user_id.eq.${userId}`)
  );

  await must(
    "mc_battles",
    await supabaseAdmin
      .from("mc_battles")
      .delete()
      .or(
        `challenger_user_id.eq.${userId},defender_user_id.eq.${userId},winner_user_id.eq.${userId}`
      )
  );

  await must("profiles", await supabaseAdmin.from("profiles").delete().eq("id", userId));

  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authDeleteError) {
    console.error("auth delete failed:", authDeleteError);
    throw authDeleteError;
  }

  console.log(`Deleted user ${userId}`);
}

async function main() {
  for (const userId of USER_IDS) {
    await deleteUserCompletely(userId);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});