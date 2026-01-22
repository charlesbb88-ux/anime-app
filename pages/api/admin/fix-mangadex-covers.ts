// pages/api/admin/fix-mangadex-covers.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchBestMangaDexCoverUrl } from "@/lib/mangadex_covers";

function requireAdmin(req: NextApiRequest) {
  const secret = req.headers["x-admin-secret"];
  if (!process.env.ADMIN_SECRET) throw new Error("ADMIN_SECRET not set");
  if (secret !== process.env.ADMIN_SECRET) throw new Error("Unauthorized");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    requireAdmin(req);

    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));

    // Pick manga that are missing cover_image_url, but have a mangadex external id.
    const { data: rows, error: pickErr } = await supabaseAdmin
      .from("manga")
      .select(
        `
          id,
          cover_image_url,
          manga_external_ids!inner (
            external_id,
            source
          )
        `
      )
      .is("cover_image_url", null)
      .eq("manga_external_ids.source", "mangadex")
      .order("id", { ascending: true })
      .limit(limit);

    if (pickErr) throw pickErr;

    const work = rows || [];

    let processed = 0;
    let updated = 0;

    const updatedSample: any[] = [];
    const errorsSample: any[] = [];

    for (const r of work as any[]) {
      const mangaId = String(r?.id || "");
      const mdRow = Array.isArray(r?.manga_external_ids) ? r.manga_external_ids[0] : r?.manga_external_ids;
      const mdId = String(mdRow?.external_id || "").trim();

      if (!mangaId || !mdId) continue;

      processed += 1;

      try {
        const coverUrl = await fetchBestMangaDexCoverUrl(mdId);

        if (!coverUrl) {
          errorsSample.push({ manga_id: mangaId, mangadex_id: mdId, error: "No cover returned by /cover" });
          if (errorsSample.length > 25) errorsSample.shift();
          continue;
        }

        const { error: updErr } = await supabaseAdmin
          .from("manga")
          .update({ cover_image_url: coverUrl })
          .eq("id", mangaId);

        if (updErr) throw updErr;

        updated += 1;
        updatedSample.push({ manga_id: mangaId, mangadex_id: mdId, cover_image_url: coverUrl });
        if (updatedSample.length > 25) updatedSample.shift();
      } catch (e: any) {
        errorsSample.push({ manga_id: mangaId, mangadex_id: mdId, error: String(e?.message || e) });
        if (errorsSample.length > 25) errorsSample.shift();
      }
    }

    return res.status(200).json({
      ok: true,
      picked: work.length,
      processed,
      updated,
      errors: errorsSample.length,
      updatedSample,
      errorsSample,
    });
  } catch (e: any) {
    const msg = String(e?.message || "Unknown error");
    if (msg === "Unauthorized") return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: msg });
  }
}
