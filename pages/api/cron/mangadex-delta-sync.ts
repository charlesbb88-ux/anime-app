// pages/api/cron/mangadex-delta-sync.ts
import type { NextApiRequest, NextApiResponse } from "next";

const CRON_TOKEN = process.env.CRON_TOKEN || "";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

// Prefer SITE_URL for server-side calls (set this in Vercel env vars)
const SITE_URL = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "";

// Hard timeout so this endpoint can NEVER “load forever”
const TIMEOUT_MS = 25_000;

function stripTrailingSlash(s: string) {
  return String(s || "").replace(/\/+$/, "");
}

function getToken(req: NextApiRequest) {
  // header token first (best), then query token (works with simple cron services)
  const headerToken = String(req.headers["x-cron-token"] || "");
  const queryToken = String(req.query.token || "");
  return headerToken || queryToken;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("cache-control", "no-store");

  try {
    const token = getToken(req);
    if (!CRON_TOKEN || token !== CRON_TOKEN) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    if (!SITE_URL) return res.status(500).json({ ok: false, error: "missing SITE_URL env" });
    if (!ADMIN_SECRET) return res.status(500).json({ ok: false, error: "missing ADMIN_SECRET env" });

    const base = stripTrailingSlash(SITE_URL);

    // Forward ALL query params except token
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (k === "token") continue;
      if (Array.isArray(v)) {
        for (const item of v) qs.append(k, String(item));
      } else if (v != null) {
        qs.set(k, String(v));
      }
    }

    // Provide safe defaults if caller didn’t supply them
    if (!qs.has("max_pages")) qs.set("max_pages", "5");
    if (!qs.has("hard_cap")) qs.set("hard_cap", "500");

    const url = `${base}/api/admin/mangadex-delta-sync?${qs.toString()}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const r = await fetch(url, {
        method: "GET",
        headers: {
          "x-admin-secret": ADMIN_SECRET,
          accept: "application/json",
        },
        signal: controller.signal,
        cache: "no-store",
      });

      const upstreamStatus = r.status;
      const upstreamText = await r.text();

      res.status(upstreamStatus);
      res.setHeader("content-type", r.headers.get("content-type") || "application/json; charset=utf-8");
      return res.send(upstreamText);
    } finally {
      clearTimeout(timeout);
    }
  } catch (e: any) {
    const msg =
      String(e?.name || "") === "AbortError"
        ? `upstream timed out after ${TIMEOUT_MS}ms`
        : e?.message || "unknown error";
    return res.status(504).json({ ok: false, error: msg });
  }
}
