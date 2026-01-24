import type { NextApiRequest, NextApiResponse } from "next";

function requireAdmin(req: NextApiRequest) {
  const secret = req.headers["x-admin-secret"];
  if (!process.env.ADMIN_SECRET) throw new Error("ADMIN_SECRET not set");
  if (secret !== process.env.ADMIN_SECRET) throw new Error("Unauthorized");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    requireAdmin(req);

    const base = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
    if (!base) throw new Error("SITE_URL missing in env");

    const root = base.replace(/\/$/, "");

    const headers = {
      "x-admin-secret": process.env.ADMIN_SECRET!,
      accept: "application/json",
    };

    // 1. Pull new MangaDex activity
    const recent = await fetch(
      `${root}/api/admin/mangadex-recent-chapters-sync`,
      { headers }
    ).then(r => r.json());

    // 2. Process that activity into real updates
    const processed = await fetch(
      `${root}/api/admin/process-mangadex-activity`,
      { headers }
    ).then(r => r.json());

    return res.status(200).json({
      ok: true,
      recent,
      processed,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
