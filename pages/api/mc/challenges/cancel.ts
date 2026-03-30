import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ApiResponse =
  | {
      challenge: {
        id: string;
        challenger_user_id: string;
        defender_user_id: string;
        status: string;
        battle_id: string | null;
        created_at: string;
        updated_at: string;
        expires_at: string;
        responded_at: string | null;
        canceled_at: string | null;
        expired_at: string | null;
      };
      battleId?: string | null;
    }
  | { error: string };

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

    const { data: challenge, error: fetchError } = await supabaseAdmin
      .from("mc_challenges")
      .select(`
        id,
        challenger_user_id,
        defender_user_id,
        status,
        battle_id,
        created_at,
        updated_at,
        expires_at,
        responded_at,
        canceled_at,
        expired_at
      `)
      .eq("id", challengeId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found." });
    }

    if (challenge.challenger_user_id !== actorUserId) {
      return res.status(403).json({ error: "Only the challenger can cancel." });
    }

    if (challenge.status !== "pending") {
      return res.status(400).json({ error: "Only pending challenges can be canceled." });
    }

    const nowIso = new Date().toISOString();

    if (new Date(challenge.expires_at).getTime() < Date.now()) {
      const { data: expiredRow, error: expireError } = await supabaseAdmin
        .from("mc_challenges")
        .update({
          status: "expired",
          expired_at: nowIso,
        })
        .eq("id", challengeId)
        .eq("status", "pending")
        .select(`
          id,
          challenger_user_id,
          defender_user_id,
          status,
          battle_id,
          created_at,
          updated_at,
          expires_at,
          responded_at,
          canceled_at,
          expired_at
        `)
        .single();

      if (expireError) {
        throw expireError;
      }

      return res.status(400).json({ error: "Challenge has expired." });
    }

    const { data: updatedRow, error: updateError } = await supabaseAdmin
      .from("mc_challenges")
      .update({
        status: "canceled",
        canceled_at: nowIso,
      })
      .eq("id", challengeId)
      .eq("status", "pending")
      .select(`
        id,
        challenger_user_id,
        defender_user_id,
        status,
        battle_id,
        created_at,
        updated_at,
        expires_at,
        responded_at,
        canceled_at,
        expired_at
      `)
      .single();

    if (updateError) {
      throw updateError;
    }

    return res.status(200).json({
      challenge: updatedRow,
      battleId: null,
    });
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: e?.message ?? "Failed to cancel challenge." });
  }
}