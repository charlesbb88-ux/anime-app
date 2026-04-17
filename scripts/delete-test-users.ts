declare const require: any;

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const { supabaseAdmin } = require("../lib/supabaseAdmin");

const USER_IDS = [
  "8ce7afac-c71a-4af3-b4f8-a3e93805e71f",
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: any) {
  const text = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return (
    text.includes("fetch failed") ||
    text.includes("connect timeout") ||
    text.includes("und_err_connect_timeout") ||
    text.includes("timeout")
  );
}

async function mustWithRetry<T extends { error: any }>(
  label: string,
  run: () => Promise<T>,
  retries = 3
) {
  let lastError: any = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const result = await run();

    if (!result.error) {
      return result;
    }

    lastError = result.error;

    if (attempt < retries && isRetryableError(result.error)) {
      console.log(`${label} timed out. Retry ${attempt}/${retries - 1}...`);
      await sleep(1500 * attempt);
      continue;
    }

    console.error(`${label} failed:`, result.error);
    throw result.error;
  }

  throw lastError;
}

async function deleteUserCompletely(userId: string) {
  console.log(`\nDeleting user ${userId}...`);

  await mustWithRetry(
    "user_follows",
    () =>
      supabaseAdmin
        .from("user_follows")
        .delete()
        .or(`follower_id.eq.${userId},following_id.eq.${userId}`)
  );

  await mustWithRetry("likes", () => supabaseAdmin.from("likes").delete().eq("user_id", userId));
  await mustWithRetry("comment_likes", () =>
    supabaseAdmin.from("comment_likes").delete().eq("user_id", userId)
  );
  await mustWithRetry("activity_likes", () =>
    supabaseAdmin.from("activity_likes").delete().eq("user_id", userId)
  );
  await mustWithRetry("post_clicks", () =>
    supabaseAdmin.from("post_clicks").delete().eq("user_id", userId)
  );
  await mustWithRetry("post_impressions", () =>
    supabaseAdmin.from("post_impressions").delete().eq("user_id", userId)
  );

  await mustWithRetry("activity", () =>
    supabaseAdmin.from("activity").delete().eq("user_id", userId)
  );
  await mustWithRetry("activity_events", () =>
    supabaseAdmin.from("activity_events").delete().eq("user_id", userId)
  );
  await mustWithRetry("anime_activity_events", () =>
    supabaseAdmin.from("anime_activity_events").delete().eq("user_id", userId)
  );

  await mustWithRetry("anime_episode_logs", () =>
    supabaseAdmin.from("anime_episode_logs").delete().eq("user_id", userId)
  );
  await mustWithRetry("anime_series_logs", () =>
    supabaseAdmin.from("anime_series_logs").delete().eq("user_id", userId)
  );
  await mustWithRetry("manga_chapter_logs", () =>
    supabaseAdmin.from("manga_chapter_logs").delete().eq("user_id", userId)
  );
  await mustWithRetry("manga_series_logs", () =>
    supabaseAdmin.from("manga_series_logs").delete().eq("user_id", userId)
  );
  await mustWithRetry("manga_chapter_summaries", () =>
    supabaseAdmin.from("manga_chapter_summaries").delete().eq("user_id", userId)
  );

  await mustWithRetry("comments", () =>
    supabaseAdmin.from("comments").delete().eq("user_id", userId)
  );
  await mustWithRetry("posts", () =>
    supabaseAdmin.from("posts").delete().eq("user_id", userId)
  );
  await mustWithRetry("ratings", () =>
    supabaseAdmin.from("ratings").delete().eq("user_id", userId)
  );
  await mustWithRetry("reviews", () =>
    supabaseAdmin.from("reviews").delete().eq("user_id", userId)
  );

  await mustWithRetry("user_anime_progress", () =>
    supabaseAdmin.from("user_anime_progress").delete().eq("user_id", userId)
  );
  await mustWithRetry("user_marks", () =>
    supabaseAdmin.from("user_marks").delete().eq("user_id", userId)
  );
  await mustWithRetry("user_library_items", () =>
    supabaseAdmin.from("user_library_items").delete().eq("user_id", userId)
  );
  await mustWithRetry("user_journal_items", () =>
    supabaseAdmin.from("user_journal_items").delete().eq("user_id", userId)
  );
  await mustWithRetry("user_series_stats", () =>
    supabaseAdmin.from("user_series_stats").delete().eq("user_id", userId)
  );

  await mustWithRetry("progression_xp_events", () =>
    supabaseAdmin.from("progression_xp_events").delete().eq("user_id", userId)
  );
  await mustWithRetry("user_progression", () =>
    supabaseAdmin.from("user_progression").delete().eq("user_id", userId)
  );
  await mustWithRetry("user_tag_progression", () =>
    supabaseAdmin.from("user_tag_progression").delete().eq("user_id", userId)
  );

  await mustWithRetry("user_mc_battle_stats", () =>
    supabaseAdmin.from("user_mc_battle_stats").delete().eq("user_id", userId)
  );
  await mustWithRetry("user_mc_equipped_assets", () =>
    supabaseAdmin.from("user_mc_equipped_assets").delete().eq("user_id", userId)
  );
  await mustWithRetry("user_mc_owned_assets", () =>
    supabaseAdmin.from("user_mc_owned_assets").delete().eq("user_id", userId)
  );
  await mustWithRetry("user_mc_paperdoll_loadouts", () =>
    supabaseAdmin.from("user_mc_paperdoll_loadouts").delete().eq("user_id", userId)
  );
  await mustWithRetry("user_mc_characters", () =>
    supabaseAdmin.from("user_mc_characters").delete().eq("user_id", userId)
  );

  await mustWithRetry(
    "mc_challenges",
    () =>
      supabaseAdmin
        .from("mc_challenges")
        .delete()
        .or(`challenger_user_id.eq.${userId},defender_user_id.eq.${userId}`)
  );

  await mustWithRetry(
    "mc_battles",
    () =>
      supabaseAdmin
        .from("mc_battles")
        .delete()
        .or(
          `challenger_user_id.eq.${userId},defender_user_id.eq.${userId},winner_user_id.eq.${userId}`
        )
  );

  await mustWithRetry("profiles", () =>
    supabaseAdmin.from("profiles").delete().eq("id", userId)
  );

  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (authDeleteError && authDeleteError.code !== "user_not_found") {
    console.error("auth delete failed:", authDeleteError);
    throw authDeleteError;
  }

  if (authDeleteError?.code === "user_not_found") {
    console.log(`Auth user already gone for ${userId}`);
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