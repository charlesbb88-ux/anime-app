// pages/api/profile/about.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { renderProfileAboutToHtml } from "@/lib/markdown/renderProfileAbout";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-only admin client for updating profiles safely
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type Ok = { ok: true; about_markdown: string; about_html: string };
type Err = { ok: false; error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Ok | Err>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

    if (!token) return res.status(401).json({ ok: false, error: "Missing auth token" });

    // Validate user token -> get user id
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user?.id) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const userId = userData.user.id;

    const about_markdown = (req.body?.about_markdown ?? "").toString();

    // Basic limits (prevents abuse)
    if (about_markdown.length > 20000) {
      return res.status(400).json({ ok: false, error: "About is too long (max 20,000 chars)" });
    }

    const about_html = await renderProfileAboutToHtml(about_markdown);

    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({
        about_markdown,
        about_html,
        about_updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (upErr) return res.status(400).json({ ok: false, error: upErr.message });

    return res.status(200).json({ ok: true, about_markdown, about_html });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? "Server error" });
  }
}
