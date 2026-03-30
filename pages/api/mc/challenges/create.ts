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

    const challengerUserId = asNonEmptyString(req.body?.challengerUserId);
    const defenderUserId = asNonEmptyString(req.body?.defenderUserId);

    if (!challengerUserId) {
      return res.status(400).json({ error: "Missing challenger user id." });
    }

    if (!defenderUserId) {
      return res.status(400).json({ error: "Missing defender user id." });
    }

    if (challengerUserId === defenderUserId) {
      return res
        .status(400)
        .json({ error: "Challenger and defender cannot be the same user." });
    }

    const nowIso = new Date().toISOString();

    await supabaseAdmin
      .from("mc_challenges")
      .update({
        status: "expired",
        expired_at: nowIso,
      })
      .eq("status", "pending")
      .lt("expires_at", nowIso)
      .or(
        `challenger_user_id.eq.${challengerUserId},defender_user_id.eq.${challengerUserId},challenger_user_id.eq.${defenderUserId},defender_user_id.eq.${defenderUserId}`
      );

    const { data, error } = await supabaseAdmin
      .from("mc_challenges")
      .insert({
        challenger_user_id: challengerUserId,
        defender_user_id: defenderUserId,
        status: "pending",
      })
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

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          error: "You already have a pending challenge for this user.",
        });
      }

      throw error;
    }

    return res.status(200).json({
      challenge: data,
    });
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: e?.message ?? "Failed to create challenge." });
  }
}