import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const externalId = String(req.query.external_id || "").trim();

  if (!externalId) {
    return res.status(400).json({ error: "Missing external_id" });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("manga_external_ids")
      .select(`
        manga_id,
        manga:manga_id (
          slug,
          title
        )
      `)
      .eq("source", "mangadex")
      .eq("external_id", externalId)
      .maybeSingle();

    if (error) throw error;

    return res.json({ ok: true, data });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
