import type { NextApiRequest, NextApiResponse } from "next";

const CRON_TOKEN = process.env.CRON_TOKEN || "";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

// Prefer SITE_URL for server-side calls (set in Vercel env vars)
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

function toSingle(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return null;
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

    // Build upstream URL and forward ALL query params except token
    const base = stripTrailingSlash(SITE_URL);
    const upstream = new URL(`${base}/api/admin/mangadex-delta-sync`);

    // Copy query params through (excluding token)
    // This is the main fix: mode/state_id/peek/force/etc now work via cron.
    for (const [k, raw] of Object.entries(req.query || {})) {
      if (k === "token") continue;
      const v = toSingle(raw);
      if (v != null && v !== "") upstream.searchParams.set(k, v);
    }

    // Sensible defaults if caller didn’t set them
    if (!upstream.searchParams.get("max_pages")) upstream.searchParams.set("max_pages", "5");
    if (!upstream.searchParams.get("hard_cap")) upstream.searchParams.set("hard_cap", "500");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const r = await fetch(upstream.toString(), {
        method: "GET",
        headers: {
          "x-admin-secret": ADMIN_SECRET,
          accept: "application/json",
        },
        signal: controller.signal,
        cache: "no-store",
      });

      const text = await r.text();

      res.status(r.status);
      res.setHeader("content-type", r.headers.get("content-type") || "application/json; charset=utf-8");
      return res.send(text);
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
