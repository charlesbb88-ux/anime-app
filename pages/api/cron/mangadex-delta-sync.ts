// pages/api/cron/mangadex-delta-sync.ts
import type { NextApiRequest, NextApiResponse } from "next";

const CRON_TOKEN = process.env.CRON_TOKEN || "";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

// Hard timeout so this endpoint can NEVER “load forever”
const TIMEOUT_MS = 25_000;

function stripTrailingSlash(s: string) {
  return String(s || "").replace(/\/+$/, "");
}

function getToken(req: NextApiRequest) {
  const headerToken = String(req.headers["x-cron-token"] || "");
  const queryToken = String(req.query.token || "");
  return headerToken || queryToken;
}

function getBaseUrl() {
  const raw =
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "";
  return stripTrailingSlash(raw);
}

function buildForwardedQuery(req: NextApiRequest) {
  const qs = new URLSearchParams();

  // common knobs
  qs.set("max_pages", String(req.query.max_pages || "5"));
  qs.set("hard_cap", String(req.query.hard_cap || "500"));
  qs.set("state_id", String(req.query.state_id || "titles_delta"));

  // debug knobs
  if (String(req.query.peek || "") === "1") qs.set("peek", "1");
  if (String(req.query.force || "") === "1") qs.set("force", "1");
  if (typeof req.query.md_id === "string" && req.query.md_id) qs.set("md_id", req.query.md_id);

  return qs.toString();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("cache-control", "no-store");

  try {
    const token = getToken(req);
    if (!CRON_TOKEN || token !== CRON_TOKEN) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const base = getBaseUrl();
    if (!base) {
      return res.status(500).json({
        ok: false,
        error:
          "missing base url env (set SITE_URL or NEXT_PUBLIC_SITE_URL, or rely on VERCEL_URL)",
      });
    }

    if (!ADMIN_SECRET) {
      return res.status(500).json({ ok: false, error: "missing ADMIN_SECRET env" });
    }

    const forwarded = buildForwardedQuery(req);
    const url = `${base}/api/admin/mangadex-delta-sync?${forwarded}`;

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

      const text = await r.text();
      const ct = r.headers.get("content-type") || "text/plain; charset=utf-8";

      res.status(r.status);
      res.setHeader("content-type", ct);

      // Pass-through the upstream response so you see exact output
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
