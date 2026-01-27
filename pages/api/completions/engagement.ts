// pages/api/completions/engagement.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type CompletionKind = "anime" | "manga";

function asStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const userId = asStr(req.query.userId);
    const id = asStr(req.query.id); // series id (anime_id or manga_id)
    const kind = asStr(req.query.kind) as CompletionKind | null;

    if (!userId || !id || (kind !== "anime" && kind !== "manga")) {
      return res.status(400).json({ error: "Missing/invalid userId, id, or kind" });
    }

    // --- REVIEWED count (episodes/chapters with a review row)
    // NOTE: counts EPISODE/CHAPTER reviews only (episode_id/chapter_id must be not null)
    let reviewed = 0;

    if (kind === "anime") {
      const { count, error } = await supabaseAdmin
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("anime_id", id)
        .not("anime_episode_id", "is", null);

      if (error) throw error;
      reviewed = count ?? 0;
    } else {
      const { count, error } = await supabaseAdmin
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("manga_id", id)
        .not("manga_chapter_id", "is", null);

      if (error) throw error;
      reviewed = count ?? 0;
    }

    // --- RATED count (episodes/chapters with a user_marks row where kind='rating')
    // NOTE: counts EPISODE/CHAPTER ratings only (episode_id/chapter_id must be not null)
    let rated = 0;

    if (kind === "anime") {
      const { count, error } = await supabaseAdmin
        .from("user_marks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("kind", "rating")
        .eq("anime_id", id)
        .not("anime_episode_id", "is", null);

      if (error) throw error;
      rated = count ?? 0;
    } else {
      const { count, error } = await supabaseAdmin
        .from("user_marks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("kind", "rating")
        .eq("manga_id", id)
        .not("manga_chapter_id", "is", null);

      if (error) throw error;
      rated = count ?? 0;
    }

    return res.status(200).json({ reviewed, rated });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
