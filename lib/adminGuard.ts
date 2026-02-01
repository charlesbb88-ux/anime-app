import type { NextApiRequest, NextApiResponse } from "next";

export function requireAdmin(req: NextApiRequest, res: NextApiResponse): boolean {
  const need = process.env.ADMIN_SECRET;
  const got = req.headers["x-admin-secret"];

  // 🔍 EXACT BYTE DEBUG (TEMP — REMOVE AFTER)
  console.log("[adminGuard] need raw:", JSON.stringify(need));
  console.log("[adminGuard] need length:", need?.length ?? "(missing)");
  console.log("[adminGuard] got raw:", JSON.stringify(got));
  console.log("[adminGuard] got length:", typeof got === "string" ? got.length : "(not string)");

  if (!need) return true; // dev-friendly bypass if not set

  if (typeof got !== "string" || got !== need) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }

  return true;
}
