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

    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
    const minutes = Number(req.query.minutes || 0);
    const stateId = String(req.query.state_id || "titles_delta");

    let q = supabaseAdmin
      .from("mangadex_delta_log")
      .select(
        `
        logged_at,
        mangadex_updated_at,
        mangadex_id,
        manga_id,
        manga:manga_id (slug, title)
      `
      )
      .eq("state_id", stateId)
      .order("logged_at", { ascending: false })
      .limit(limit);

    if (Number.isFinite(minutes) && minutes > 0) {
      const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();
      q = q.gte("logged_at", since);
    }

    const { data, error } = await q;
    if (error) throw error;

    return res.status(200).json({
      ok: true,
      state_id: stateId,
      count: data?.length || 0,
      items: (data || []).map((r: any) => ({
        logged_at: r.logged_at,
        mangadex_updated_at: r.mangadex_updated_at,
        mangadex_id: r.mangadex_id,
        manga_id: r.manga_id,
        slug: r.manga?.slug ?? null,
        title: r.manga?.title ?? null,
      })),
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
