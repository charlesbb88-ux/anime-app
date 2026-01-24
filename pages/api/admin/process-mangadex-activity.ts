// pages/api/admin/process-mangadex-activity.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function requireAdmin(req: NextApiRequest) {
  const secret = req.headers["x-admin-secret"];
  if (!process.env.ADMIN_SECRET) throw new Error("ADMIN_SECRET not set");
  if (secret !== process.env.ADMIN_SECRET) throw new Error("Unauthorized");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    requireAdmin(req);

    // 1. Get the most recent distinct MangaDex manga IDs from activity
    const { data: rows, error } = await supabaseAdmin
      .from("mangadex_recent_chapters")
      .select("mangadex_manga_id")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const uniqueIds = Array.from(
      new Set(rows.map(r => r.mangadex_manga_id).filter(Boolean))
    );

    const processed: string[] = [];

    // 2. For each manga, just call your existing importer logic
    for (const mdId of uniqueIds) {
      // Call your existing delta sync endpoint internally
      const url = `${process.env.NEXT_PUBLIC_SITE_URL}/api/admin/mangadex-delta-sync?mode=chapter&state_id=manual-trigger&force=1&max_pages=1&hard_cap=1`;

      await fetch(url, {
        headers: {
          "x-admin-secret": process.env.ADMIN_SECRET!,
          "accept": "application/json",
        },
      });

      processed.push(mdId);
    }

    return res.status(200).json({
      ok: true,
      processed_count: processed.length,
      processed,
    });

  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
