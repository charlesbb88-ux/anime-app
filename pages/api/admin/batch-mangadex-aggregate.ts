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

        const limit = Math.max(1, Math.min(50, Number(req.query.limit || 25)));

        /**
         * ✅ IMPORTANT:
         * PostgREST can't do OR filters on nested join fields like manga.total_chapters.
         * So we fetch a page and filter in JS.
         */
        const pickSize = Math.max(200, limit * 10); // pull extra so we can filter client-side

        const { data: rows, error: pickErr } = await supabaseAdmin
            .from("manga_external_ids")
            .select(
                `
        manga_id,
        external_id,
        manga:manga_id (
          total_chapters,
          total_volumes
        )
      `
            )
            .eq("source", "mangadex")
            .order("manga_id", { ascending: true })
            .limit(pickSize);

        if (pickErr) throw pickErr;

        // Keep only rows where totals are missing
        const candidates = (rows || []).filter((r: any) => {
            const m = r.manga;
            return !m || m.total_chapters == null || m.total_volumes == null;
        });

        const work = candidates.slice(0, limit);

        let processed = 0;
        const updated: Array<{
            manga_id: string;
            external_id: string;
            total_chapters: number | null;
            total_volumes: number | null;
        }> = [];
        const errors: Array<{ manga_id: string; external_id: string; error: string }> = [];

        for (const r of work) {
            const mangaId = String((r as any).manga_id || "");
            const mdId = String((r as any).external_id || "").trim();
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

                // ✅ create missing chapter rows 1..totalChapters
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
            picked: rows?.length || 0,
            eligible: candidates.length,
            processed,
            updatedCount: updated.length,
            errorCount: errors.length,
            updated: updated.slice(0, 10),
            errors: errors.slice(0, 10),
        });
    } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Unknown error" });
    }
}
