import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ApiResponse = { success: true } | { error: string };

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const challengeId = asNonEmptyString(req.body?.challengeId);
    const actorUserId = asNonEmptyString(req.body?.actorUserId);

    if (!challengeId) {
      return res.status(400).json({ error: "Missing challenge id." });
    }

    if (!actorUserId) {
      return res.status(400).json({ error: "Missing actor user id." });
    }

    // fetch challenge
    const { data: challenge, error: fetchError } = await supabaseAdmin
      .from("mc_challenges")
      .select("challenger_user_id, defender_user_id")
      .eq("id", challengeId)
      .single();

    if (fetchError) throw fetchError;

    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found." });
    }

    // verify ownership
    if (
      challenge.challenger_user_id !== actorUserId &&
      challenge.defender_user_id !== actorUserId
    ) {
      return res.status(403).json({ error: "Not allowed." });
    }

    // update viewed_at
    const { error: updateError } = await supabaseAdmin
      .from("mc_challenges")
      .update({
        viewed_at: new Date().toISOString(),
      })
      .eq("id", challengeId);

    if (updateError) throw updateError;

    return res.status(200).json({ success: true });
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: e?.message ?? "Failed to mark viewed." });
  }
}