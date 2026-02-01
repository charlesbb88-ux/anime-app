import type { NextApiRequest, NextApiResponse } from "next";

export function requireAdmin(req: NextApiRequest, res: NextApiResponse): boolean {
  const need = process.env.ADMIN_SECRET;
  if (!need) return true; // if you don't set it, no guard (dev-friendly)

  const got = req.headers["x-admin-secret"];
  if (typeof got !== "string" || got !== need) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}
