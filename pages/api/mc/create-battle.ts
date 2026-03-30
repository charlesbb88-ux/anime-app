import type { NextApiRequest, NextApiResponse } from "next";
import {
  createMcBattleServer,
  type CreateMcBattleResult,
} from "@/lib/createMcBattle";

type ApiResponse = CreateMcBattleResult | { error: string };

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

    const battle = await createMcBattleServer(
      challengerUserId,
      defenderUserId
    );

    return res.status(200).json(battle);
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: e?.message ?? "Failed to create battle." });
  }
}