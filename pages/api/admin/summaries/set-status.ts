// pages/api/admin/summaries/set-status.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function asString(v: any) {
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] : "";
}

function authed(req: NextApiRequest) {
  const key = asString(req.query.key).trim();
  const envKey = (process.env.ADMIN_DASH_KEY ?? "").trim();
  return Boolean(envKey) && key === envKey;
}

type Body = {
  id: string;
  status?: "active" | "hidden";
  hidden_reason?: string;
  reviewed?: boolean; // ✅ new
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!authed(req)) {
    const key = asString(req.query.key).trim();
    const envKey = (process.env.ADMIN_DASH_KEY ?? "").trim();
    return res.status(401).json({
      error: "Unauthorized",
      debug: { hasEnvKey: Boolean(envKey), keyLen: key.length, envLen: envKey.length },
    });
  }

  const body = (req.body || {}) as Body;

  const id = String(body.id || "").trim();
  if (!id) return res.status(400).json({ error: "Missing id" });

  const now = new Date().toISOString();

  // ✅ build patch dynamically (so we can update status and/or reviewed_at)
  const patch: any = {
    updated_at: now,
  };

  if (body.status) {
    const status = body.status;
    if (status !== "active" && status !== "hidden") {
      return res.status(400).json({ error: "Invalid status" });
    }

    if (status === "hidden") {
      patch.status = "hidden";
      patch.hidden_at = now;
      patch.hidden_reason = (body.hidden_reason || "").trim() || null;
    } else {
      patch.status = "active";
      patch.hidden_at = null;
      patch.hidden_reason = null;
    }
  }

  if (body.reviewed === true) patch.reviewed_at = now;
  if (body.reviewed === false) patch.reviewed_at = null;

  // nothing to update?
  if (Object.keys(patch).length <= 1) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  try {
    const { error } = await supabaseAdmin
      .from("manga_chapter_summaries")
      .update(patch)
      .eq("id", id);

    if (error) throw error;

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
