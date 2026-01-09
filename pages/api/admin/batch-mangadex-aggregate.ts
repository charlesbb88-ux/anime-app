// pages/api/admin/batch-mangadex-aggregate.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function requireAdmin(req: NextApiRequest) {
    const secret = req.headers["x-admin-secret"];
    if (!process.env.ADMIN_SECRET) throw new Error("ADMIN_SECRET not set");
    if (secret !== process.env.ADMIN_SECRET) throw new Error("Unauthorized");
}

const BASE = "https://api.mangadex.org";

type MdAggregateResponse = {
    result: string;
    volumes?: Record<
        string,
        {
            volume?: string | null;
            chapters?: Record<string, { chapter?: string | null; count?: number }>;
        }
    >;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        requireAdmin(req);

        // You can raise this safely; 100 is a good default for draining fast.
        const limit = Math.max(1, Math.min(200, Number(req.query.limit || 100)));

        /**
         * ✅ Key change:
         * Pick from manga WHERE totals are missing,
         * and INNER JOIN manga_external_ids to get the mangadex id.
         *
         * This guarantees we keep finding remaining work until the whole DB is done.
         */
        const { data: rows, error: pickErr } = await supabaseAdmin
            .from("manga")
            .select(
                `
        id,
        total_chapters,
        total_volumes,
        manga_external_ids!inner (
          external_id,
          source
        )
      `
            )
            .or("total_chapters.is.null,total_volumes.is.null")
            .eq("manga_external_ids.source", "mangadex")
            .order("id", { ascending: true })
            .limit(limit);

        if (pickErr) throw pickErr;

        const work = rows || [];

        let processed = 0;
        const updated: Array<{
            manga_id: string;
            external_id: string;
            total_chapters: number | null;
            total_volumes: number | null;
        }> = [];
        const errors: Array<{ manga_id: string; external_id: string; error: string }> = [];

        for (const r of work as any[]) {
            const mangaId = String(r?.id || "");
            const mdRow = Array.isArray(r?.manga_external_ids) ? r.manga_external_ids[0] : r?.manga_external_ids;
            const mdId = String(mdRow?.external_id || "").trim();

            if (!mangaId || !mdId) continue;

            try {
                // Try aggregate without language filters first
                let url = new URL(`${BASE}/manga/${mdId}/aggregate`);

                let aggRes = await fetch(url.toString(), {
                    headers: { "User-Agent": "your-app-mangadex-aggregate" },
                });

                // Retry with EN if needed
                if (!aggRes.ok) {
                    const retryUrl = new URL(`${BASE}/manga/${mdId}/aggregate`);
                    retryUrl.searchParams.append("translatedLanguage[]", "en");

                    aggRes = await fetch(retryUrl.toString(), {
                        headers: { "User-Agent": "your-app-mangadex-aggregate" },
                    });
                }

                if (!aggRes.ok) {
                    const txt = await aggRes.text().catch(() => "");
                    throw new Error(`aggregate failed (${aggRes.status}): ${txt.slice(0, 200)}`);
                }

                const json = (await aggRes.json()) as MdAggregateResponse;

                const volumesObj = json.volumes || {};
                const volumeKeys = Object.keys(volumesObj);

                // total volumes = count real volumes (ignore "none"/null-ish)
                const realVolumeKeys = volumeKeys.filter((k) => {
                    const v = (volumesObj as any)[k]?.volume ?? k;
                    const s = String(v ?? "").toLowerCase().trim();
                    return s !== "" && s !== "none" && s !== "null";
                });

                const totalVolumes = realVolumeKeys.length;

                // total chapters = unique chapter keys across all volumes
                const chapterSet = new Set<string>();
                for (const volKey of volumeKeys) {
                    const vol = volumesObj[volKey];
                    const chapters = vol?.chapters || {};
                    for (const chKey of Object.keys(chapters)) {
                        const cleaned = String(chKey ?? "").trim();
                        if (cleaned) chapterSet.add(cleaned);
                    }
                }

                const totalChapters = chapterSet.size;

                const { error: updErr } = await supabaseAdmin
                    .from("manga")
                    .update({
                        total_chapters: totalChapters,
                        total_volumes: totalVolumes,
                    })
                    .eq("id", mangaId);

                if (updErr) throw updErr;

                // ✅ create missing chapter rows
                if (totalChapters && totalChapters > 0) {
                    const { error: syncErr } = await supabaseAdmin.rpc("sync_manga_chapter_rows", {
                        p_manga_id: mangaId,
                    });
                    if (syncErr) throw syncErr;
                }

                processed += 1;
                updated.push({
                    manga_id: mangaId,
                    external_id: mdId,
                    total_chapters: totalChapters,
                    total_volumes: totalVolumes,
                });
            } catch (e: any) {
                errors.push({
                    manga_id: mangaId,
                    external_id: mdId,
                    error: String(e?.message || e),
                });
            }
        }

        return res.status(200).json({
            ok: true,
            picked: work.length,
            processed,
            updatedCount: updated.length,
            errorCount: errors.length,
            updated: updated.slice(0, 10),
            errors: errors.slice(0, 10),
        });
    } catch (e: any) {
        const msg = String(e?.message || "Unknown error");
        if (msg === "Unauthorized") return res.status(401).json({ error: "Unauthorized" });
        return res.status(500).json({ error: msg });
    }
}
