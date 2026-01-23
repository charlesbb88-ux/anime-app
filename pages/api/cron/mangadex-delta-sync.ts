import type { NextApiRequest, NextApiResponse } from "next";

// IMPORTANT: Set this in Vercel env vars (see step 6)
const CRON_TOKEN = process.env.CRON_TOKEN || "";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = String(req.query.token || "");
    if (!CRON_TOKEN || token !== CRON_TOKEN) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    // Call your existing admin endpoint internally via fetch
    const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "";
    if (!base) {
      return res.status(500).json({ ok: false, error: "missing site url env" });
    }

    const url =
      `${base.replace(/\/$/, "")}` +
      `/api/admin/mangadex-delta-sync?max_pages=5&hard_cap=500`;

    // Use the admin secret server-side (never exposed to Vercel Cron)
    const adminSecret = process.env.ADMIN_SECRET || "";
    if (!adminSecret) {
      return res.status(500).json({ ok: false, error: "missing admin secret env" });
    }

    const r = await fetch(url, {
      method: "GET",
      headers: {
        "x-admin-secret": adminSecret,
        accept: "application/json",
      },
    });

    const text = await r.text();
    return res.status(r.ok ? 200 : 500).send(text);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "unknown error" });
  }
}
