import type { NextApiRequest, NextApiResponse } from "next";

const CRON_TOKEN = process.env.CRON_TOKEN || "";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

// Prefer explicit SITE_URL, but fall back to Vercel’s envs safely.
// NOTE: VERCEL_URL is usually like "myapp.vercel.app" (no https://)
function getBaseUrl() {
  const raw =
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "";

  return stripTrailingSlash(raw);
}

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

function pickQueryString(req: NextApiRequest) {
  // Forward these to the admin endpoint if present
  const stateId = typeof req.query.state_id === "string" ? req.query.state_id : null;
  const mdId = typeof req.query.md_id === "string" ? req.query.md_id : null;

  // These are already supported in your admin endpoint
  const maxPages = typeof req.query.max_pages === "string" ? req.query.max_pages : "5";
  const hardCap = typeof req.query.hard_cap === "string" ? req.query.hard_cap : "500";

  const qs = new URLSearchParams();
  qs.set("max_pages", maxPages);
  qs.set("hard_cap", hardCap);

  if (stateId) qs.set("state_id", stateId);
  if (mdId) qs.set("md_id", mdId);

  return qs.toString();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Always disable caching for cron endpoints
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

    const qs = pickQueryString(req);
    const url = `${base}/api/admin/mangadex-delta-sync?${qs}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let upstreamText = "";
    let upstreamStatus = 0;
    let upstreamContentType = "text/plain; charset=utf-8";

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
      upstreamContentType = r.headers.get("content-type") || upstreamContentType;
      upstreamText = await r.text();

      // If upstream returned JSON, pass it through exactly
      if (upstreamContentType.includes("application/json")) {
        res.status(upstreamStatus);
        res.setHeader("content-type", upstreamContentType);
        return res.send(upstreamText);
      }

      // Otherwise, return a wrapper so you still see status + url + body
      res.status(upstreamStatus);
      res.setHeader("content-type", "application/json; charset=utf-8");
      return res.send(
        JSON.stringify(
          {
            ok: upstreamStatus >= 200 && upstreamStatus < 300,
            called: url,
            upstream_status: upstreamStatus,
            upstream_content_type: upstreamContentType,
            upstream_body: upstreamText,
          },
          null,
          2
        )
      );
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
