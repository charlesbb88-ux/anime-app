import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function requireAdmin(req: NextApiRequest) {
  const secret = req.headers["x-admin-secret"];
  if (!process.env.ADMIN_SECRET) throw new Error("ADMIN_SECRET not set");
  if (secret !== process.env.ADMIN_SECRET) throw new Error("Unauthorized");
}

function asInt(v: any, def: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    requireAdmin(req);

    const limit = Math.max(10, Math.min(200, asInt(req.query.limit, 60)));

    const { data, error } = await supabaseAdmin
      .from("mangadex_worker_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return res.status(200).json({ ok: true, runs: data || [] });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg === "Unauthorized") return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: msg });
  }
}
