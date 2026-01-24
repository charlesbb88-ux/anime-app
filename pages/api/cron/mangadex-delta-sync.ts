// pages/api/cron/mangadex-delta-sync.ts
import type { NextApiRequest, NextApiResponse } from "next";

const CRON_TOKEN = process.env.CRON_TOKEN || "";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const SITE_URL = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "";

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

function pickQuery(req: NextApiRequest) {
  // Only allow known params to be forwarded
  const mode = typeof req.query.mode === "string" ? req.query.mode : undefined;
  const state_id = typeof req.query.state_id === "string" ? req.query.state_id : undefined;

  const max_pages = typeof req.query.max_pages === "string" ? req.query.max_pages : undefined;
  const hard_cap = typeof req.query.hard_cap === "string" ? req.query.hard_cap : undefined;

  const peek = typeof req.query.peek === "string" ? req.query.peek : undefined;
  const force = typeof req.query.force === "string" ? req.query.force : undefined;

  const md_id = typeof req.query.md_id === "string" ? req.query.md_id : undefined;

  return { mode, state_id, max_pages, hard_cap, peek, force, md_id };
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

    const q = pickQuery(req);

    // defaults if not provided
    const mode = q.mode || "manga";
    const stateId = q.state_id || (mode === "chapter" ? "chapters_delta" : "titles_delta");
    const maxPages = q.max_pages || "5";
    const hardCap = q.hard_cap || "500";

    const url = new URL(`${base}/api/admin/mangadex-delta-sync`);
    url.searchParams.set("mode", mode);
    url.searchParams.set("state_id", stateId);
    url.searchParams.set("max_pages", maxPages);
    url.searchParams.set("hard_cap", hardCap);

    if (q.peek != null) url.searchParams.set("peek", q.peek);
    if (q.force != null) url.searchParams.set("force", q.force);
    if (q.md_id != null) url.searchParams.set("md_id", q.md_id);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const r = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "x-admin-secret": ADMIN_SECRET,
          accept: "application/json",
        },
        signal: controller.signal,
        cache: "no-store",
      });

      const upstreamText = await r.text();
      res.status(r.status);
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
