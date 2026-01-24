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

    // Always derive base URL safely from the incoming request
    const proto =
      (req.headers["x-forwarded-proto"] as string) ||
      (req.socket as any)?.encrypted
        ? "https"
        : "http";

    const host = req.headers.host;
    if (!host) throw new Error("Missing host header");

    const baseUrl = `${proto}://${host}`;

    // 1. Get most recent distinct MangaDex manga IDs
    const { data: rows, error } = await supabaseAdmin
      .from("mangadex_recent_chapters")
      .select("mangadex_manga_id")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const uniqueIds = Array.from(
      new Set((rows || []).map(r => r.mangadex_manga_id).filter(Boolean))
    );

    const processed: string[] = [];
    const results: any[] = [];

    // 2. Trigger your existing delta sync once per manga
    for (const mdId of uniqueIds) {
      const url = `${baseUrl}/api/admin/mangadex-delta-sync?mode=chapter&state_id=manual-trigger&force=1&max_pages=1&hard_cap=1`;

      const r = await fetch(url, {
        headers: {
          "x-admin-secret": process.env.ADMIN_SECRET!,
          accept: "application/json",
        },
      });

      const text = await r.text().catch(() => "");
      results.push({
        mangadex_id: mdId,
        status: r.status,
        ok: r.ok,
        response: text.slice(0, 300),
      });

      processed.push(mdId);
    }

    return res.status(200).json({
      ok: true,
      baseUrl,
      processed_count: processed.length,
      processed,
      results,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
