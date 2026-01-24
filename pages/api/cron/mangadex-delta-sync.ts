import type { NextApiRequest, NextApiResponse } from "next";

const CRON_TOKEN = process.env.CRON_TOKEN || "";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

// Prefer SITE_URL for server-side calls (set this in Vercel env vars)
const SITE_URL = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "";

// Hard timeout so this endpoint can NEVER “load forever”
const TIMEOUT_MS = 25_000;

function stripTrailingSlash(s: string) {
  return s.replace(/\/+$/, "");
}

function getToken(req: NextApiRequest) {
  // header token first (best), then query token (works with simple cron services)
  const headerToken = String(req.headers["x-cron-token"] || "");
  const queryToken = String(req.query.token || "");
  return headerToken || queryToken;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Always disable caching for cron endpoints
  res.setHeader("cache-control", "no-store");

  try {
    const token = getToken(req);

    if (!CRON_TOKEN || token !== CRON_TOKEN) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    if (!SITE_URL) {
      return res.status(500).json({ ok: false, error: "missing SITE_URL env" });
    }

    if (!ADMIN_SECRET) {
      return res.status(500).json({ ok: false, error: "missing ADMIN_SECRET env" });
    }

    // Allow quick testing from the browser:
    // /api/cron/mangadex-delta-sync?token=...&max_pages=1&hard_cap=50
    const maxPages = String(req.query.max_pages || "5");
    const hardCap = String(req.query.hard_cap || "500");

    const base = stripTrailingSlash(SITE_URL);
    const url = `${base}/api/admin/mangadex-delta-sync?max_pages=${encodeURIComponent(
      maxPages
    )}&hard_cap=${encodeURIComponent(hardCap)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let upstreamText = "";
    let upstreamStatus = 0;

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

      upstreamStatus = r.status;
      upstreamText = await r.text();

      // Return upstream status so you can see 401/404/500 directly
      res.status(upstreamStatus);

      // Preserve content-type when possible
      res.setHeader(
        "content-type",
        r.headers.get("content-type") || "application/json; charset=utf-8"
      );

      return res.send(upstreamText);
    } finally {
      clearTimeout(timeout);
    }
  } catch (e: any) {
    // If we aborted due to timeout, give a clear message
    const msg = String(e?.name || "") === "AbortError"
      ? `upstream timed out after ${TIMEOUT_MS}ms`
      : (e?.message || "unknown error");

    return res.status(504).json({ ok: false, error: msg });
  }
}
