// pages/api/profile/about.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { renderProfileAboutToHtml } from "@/lib/markdown/renderProfileAbout";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Ok = { ok: true; about_markdown: string; about_html: string };
type Err = { ok: false; error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Ok | Err>) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";

    if (!token) return res.status(401).json({ ok: false, error: "Missing auth token" });

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userRes?.user?.id) return res.status(401).json({ ok: false, error: "Invalid auth token" });

    const userId = userRes.user.id;

    const about_markdown = String(req.body?.about_markdown ?? "");
    if (about_markdown.length > 20000) {
      return res.status(400).json({ ok: false, error: "About is too long (max 20,000 chars)." });
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

    if (upErr) return res.status(500).json({ ok: false, error: "Failed to save profile." });

    return res.status(200).json({ ok: true, about_markdown, about_html });
  } catch {
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}