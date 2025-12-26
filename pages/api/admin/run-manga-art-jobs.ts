import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function requireAdmin(req: NextApiRequest) {
  const secret = req.headers["x-admin-secret"];
  if (!process.env.ADMIN_SECRET) throw new Error("ADMIN_SECRET not set");
  if (secret !== process.env.ADMIN_SECRET) throw new Error("Unauthorized");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    requireAdmin(req);

    const limit = Math.max(1, Math.min(10, Number(req.query.limit || 3)));

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.trim() || `http://${req.headers.host}`;

    // Pick oldest pending jobs
    const { data: jobs, error } = await supabaseAdmin
      .from("manga_art_jobs")
      .select("id, manga_id, attempts")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) throw error;

    let processed = 0;

    for (const job of jobs || []) {
      // mark running
      await supabaseAdmin
        .from("manga_art_jobs")
        .update({ status: "running", updated_at: new Date().toISOString() })
        .eq("id", job.id);

      try {
        const mangaId = job.manga_id;

        const cacheRes = await fetch(
          `${baseUrl}/api/admin/cache-mangadex-art?manga_id=${mangaId}`,
          {
            headers: { "x-admin-secret": process.env.ADMIN_SECRET! },
          }
        );

        if (!cacheRes.ok) {
          const txt = await cacheRes.text().catch(() => "");
          throw new Error(
            `cache-mangadex-art failed (${cacheRes.status}): ${txt.slice(0, 300)}`
          );
        }

        // ✅ After caching art: pick earliest volume cover and set it as main cover
        const { data: covers, error: covErr } = await supabaseAdmin
          .from("manga_covers")
          .select("cached_url, volume, created_at")
          .eq("manga_id", mangaId)
          .not("cached_url", "is", null);

        if (covErr) throw covErr;

        function parseVol(v: any) {
          const n = Number(String(v ?? "").trim());
          return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
        }

        const best = (covers || [])
          .filter(
            (c: any) => typeof c.cached_url === "string" && c.cached_url.length > 0
          )
          .sort((a: any, b: any) => {
            const av = parseVol(a.volume);
            const bv = parseVol(b.volume);
            if (av !== bv) return av - bv;

            const at = new Date(a.created_at || 0).getTime();
            const bt = new Date(b.created_at || 0).getTime();
            return at - bt;
          })[0];

        if (best?.cached_url) {
          const { error: updErr } = await supabaseAdmin
            .from("manga")
            .update({
              cover_image_url: best.cached_url,
              image_url: best.cached_url, // optional legacy support
            })
            .eq("id", mangaId);

          if (updErr) throw updErr;
        }

        // mark done
        await supabaseAdmin
          .from("manga_art_jobs")
          .update({ status: "done", updated_at: new Date().toISOString() })
          .eq("id", job.id);

        processed += 1;
      } catch (err: any) {
        await supabaseAdmin
          .from("manga_art_jobs")
          .update({
            status: "error",
            attempts: (job as any).attempts ? Number((job as any).attempts) + 1 : 1,
            last_error: String(err?.message || err),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
      }
    }

    return res.status(200).json({
      ok: true,
      picked: jobs?.length || 0,
      processed,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
