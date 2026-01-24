// pages/api/admin/process-mangadex-activity.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function requireAdmin(req: NextApiRequest) {
    const secret = req.headers["x-admin-secret"];
    if (!process.env.ADMIN_SECRET) throw new Error("ADMIN_SECRET not set");
    if (secret !== process.env.ADMIN_SECRET) throw new Error("Unauthorized");
}

function getBaseUrl(req: NextApiRequest) {
    const envBase =
        process.env.SITE_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.VERCEL_URL ||
        null;

    if (envBase) {
        const b = envBase.startsWith("http") ? envBase : `https://${envBase}`;
        return b.replace(/\/+$/, "");
    }

    const proto = (req.headers["x-forwarded-proto"] as string) || "https";
    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
    return `${proto}://${host}`.replace(/\/+$/, "");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        requireAdmin(req);
        const baseUrl = getBaseUrl(req);

        // Pull a larger window so you don't miss IDs
        const { data: rows, error } = await supabaseAdmin
            .from("mangadex_recent_chapters")
            .select("mangadex_manga_id, updated_at")
            .order("updated_at", { ascending: false })
            .limit(300);

        if (error) throw error;

        const ids = (rows || [])
            .map((r: any) => r?.mangadex_manga_id)
            .filter((v: any) => typeof v === "string" && v.length > 0);

        const uniqueIds = Array.from(new Set(ids));

        const results: Array<{
            mangadex_id: string;
            ok: boolean;
            status: number;
            response: any;
        }> = [];

        for (const mdId of uniqueIds) {
            const url =
                `${baseUrl}/api/admin/mangadex-delta-sync` +
                `?md_manga_id=${encodeURIComponent(mdId)}` +
                `&force=1` +
                `&mode=chapter` +
                `&state_id=activity_chapter_feed` +
                `&max_pages=1` +
                `&hard_cap=1`;

            try {
                const r = await fetch(url, {
                    method: "GET",
                    headers: {
                        "x-admin-secret": process.env.ADMIN_SECRET!,
                        accept: "application/json",
                    },
                });

                const text = await r.text();
                let payload: any;
                try {
                    payload = JSON.parse(text);
                } catch {
                    payload = { raw: text?.slice(0, 1000) };
                }

                results.push({ mangadex_id: mdId, ok: r.ok, status: r.status, response: payload });
            } catch (e: any) {
                results.push({
                    mangadex_id: mdId,
                    ok: false,
                    status: 0,
                    response: { error: e?.message || "fetch failed" },
                });
            }
        }

        return res.status(200).json({
            ok: true,
            baseUrl,
            processed_count: uniqueIds.length,
            processed: uniqueIds,
            results,
        });
    } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Unknown error" });
    }
}
