// pages/api/admin/debug-external-link.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ADMIN_IMPORT_SECRET = process.env.ANIME_IMPORT_SECRET || "";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (ADMIN_IMPORT_SECRET) {
    const token =
      (req.headers["x-import-secret"] as string | undefined) ||
      (req.body && (req.body.secret as string | undefined));

    if (!token || token !== ADMIN_IMPORT_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const animeId = String(req.body?.animeId || "").trim();
  if (!animeId) return res.status(400).json({ error: "Missing animeId" });

  const payload = {
    anime_id: animeId,
    source: "tmdb",
    external_id: "DEBUG_123",
    external_type: "tv",
    title: "debug row",
    year: 2025,
    start_date: "2025-01-01",
    episodes: 12,
    status: "debug",
    confidence: 100,
    match_method: "debug",
    notes: "debug insert",
  };

  const { data, error } = await supabaseAdmin
  .from("anime_external_links")
  .upsert(payload, { onConflict: "anime_id,source" })
  .select("*")
  .single();

  if (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
      payload,
    });
  }

  return res.status(200).json({
    ok: true,
    inserted: data,
  });
}
