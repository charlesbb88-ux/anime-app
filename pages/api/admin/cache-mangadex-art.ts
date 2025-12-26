// pages/api/admin/cache-mangadex-art.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { listMangaDexCovers, coverCandidates } from "../../../lib/mangadexCovers";

function requireAdmin(req: NextApiRequest) {
    const secret = req.headers["x-admin-secret"];
    if (!process.env.ADMIN_SECRET) throw new Error("ADMIN_SECRET not set");
    if (secret !== process.env.ADMIN_SECRET) throw new Error("Unauthorized");
}

async function downloadBestAvailable(urls: string[]): Promise<{ buf: Buffer; contentType: string; usedUrl: string }> {
    let lastStatus: number | null = null;
    let lastUrl: string | null = null;

    for (const url of urls) {
        lastUrl = url;
        const res = await fetch(url, { headers: { "User-Agent": "your-app-cover-cacher" } });
        if (!res.ok) {
            lastStatus = res.status;
            continue;
        }
        const contentType = res.headers.get("content-type") || "image/jpeg";
        const buf = Buffer.from(await res.arrayBuffer());
        return { buf, contentType, usedUrl: url };
    }

    throw new Error(`All cover candidates failed. Last: ${lastUrl} (status ${lastStatus})`);
}

function safePart(s: string | null | undefined) {
    const v = (s || "").trim();
    if (!v) return "unknown";
    return v.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 50);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        requireAdmin(req);

        const manga_id = String(req.query.manga_id || "").trim();
        if (!manga_id) return res.status(400).json({ error: "Missing manga_id (your DB uuid)" });

        const limit = Math.max(1, Math.min(100, Number(req.query.limit || 25)));
        const offset = Math.max(0, Number(req.query.offset || 0));

        // Load manga row so we know slug + external id (mangadex id)
        const { data: manga, error: mErr } = await supabaseAdmin
            .from("manga")
            .select("id, slug, source")
            .eq("id", manga_id)
            .maybeSingle();

        if (mErr) throw mErr;
        if (!manga) return res.status(404).json({ error: "manga not found" });
        if (manga.source !== "mangadex") return res.status(400).json({ error: "manga.source is not mangadex" });

        const { data: snap, error: snapErr } = await supabaseAdmin
            .from("manga_source_snapshots")
            .select("raw_json")
            .eq("manga_id", manga.id)
            .order("fetched_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (snapErr) throw snapErr;

        const mangadexMangaId = snap?.raw_json?.mangadex_id;
        if (typeof mangadexMangaId !== "string" || mangadexMangaId.length < 10) {
            return res.status(400).json({ error: "Could not find mangadex_id in latest snapshot" });
        }

        // Fetch a page of covers
        const page = await listMangaDexCovers({ mangadexMangaId, limit, offset });

        // ✅ Build a fast lookup of already-cached cover ids (so we can skip downloads)
        const pageCoverIds = (page.covers || []).map((c: any) => c.id).filter(Boolean);

        const cachedIdSet = new Set<string>();

        if (pageCoverIds.length > 0) {
            const { data: existing, error: exErr } = await supabaseAdmin
                .from("manga_covers")
                .select("mangadex_cover_id, cached_url")
                .eq("manga_id", manga.id)
                .in("mangadex_cover_id", pageCoverIds);

            if (exErr) throw exErr;

            for (const row of existing || []) {
                if (row?.mangadex_cover_id && row?.cached_url) {
                    cachedIdSet.add(String(row.mangadex_cover_id));
                }
            }
        }

        let cachedCount = 0;
        let upsertedCount = 0;
        let skippedCount = 0;

        for (const c of page.covers || []) {
            const coverId = c.id;
            // ✅ Skip if we already cached this cover id
            if (cachedIdSet.has(String(coverId))) {
                skippedCount += 1;
                continue;
            }
            const fileName = c.attributes?.fileName;
            const volume = c.attributes?.volume ?? null;
            const locale = c.attributes?.locale ?? null;

            if (!fileName) continue;

            // Build candidates and download best available
            const candidates = coverCandidates(mangadexMangaId, fileName);
            const dl = await downloadBestAvailable(candidates);

            if (process.env.NODE_ENV !== "production") {
                console.log("cached mangadex cover", { coverId, volume, locale, usedUrl: dl.usedUrl });
            }

            // Figure ext from URL we used
            const urlPath = new URL(dl.usedUrl).pathname.toLowerCase();
            const ext = urlPath.includes(".png") ? "png" : "jpg";

            // Storage path: slug/art/vol-<volume>/locale-<locale>/<coverId>.<ext>
            const volPart = `vol-${safePart(volume)}`;
            const locPart = `loc-${safePart(locale)}`;
            const storagePath = `${manga.slug}/art/${volPart}/${locPart}/${coverId}.${ext}`;

            // Upload to storage
            const { error: upErr } = await supabaseAdmin.storage.from("manga-covers").upload(storagePath, dl.buf, {
                contentType: dl.contentType,
                upsert: true,
                metadata: {
                    source: "mangadex",
                    image: { type: "volume_cover", resolution: "best_available", format: ext },
                    mangadex: { mangaId: mangadexMangaId, coverId, volume, locale },
                },
            });
            if (upErr) throw upErr;

            const { data: pub } = supabaseAdmin.storage.from("manga-covers").getPublicUrl(storagePath);
            const cachedUrl = pub.publicUrl;

            // Upsert row into manga_covers (unique by mangadex_cover_id)
            const { error: insErr } = await supabaseAdmin.from("manga_covers").upsert(
                {
                    manga_id: manga.id,
                    mangadex_cover_id: coverId,
                    volume,
                    locale,
                    file_name: fileName,
                    source_url: dl.usedUrl,
                    cached_url: cachedUrl,
                },
                { onConflict: "mangadex_cover_id" }
            );

            if (insErr) throw insErr;

            cachedCount += 1;
            upsertedCount += 1;
        }

        return res.status(200).json({
            ok: true,
            manga_id: manga.id,
            slug: manga.slug,
            mangadex_id: mangadexMangaId,
            page: { limit: page.limit, offset: page.offset, total: page.total },
            cachedCount,
            upsertedCount,
            skippedCount,
            nextOffset: page.offset + page.limit < page.total ? page.offset + page.limit : null,
        });
    } catch (e: any) {
        console.error("cache-mangadex-art error:", e);
        return res.status(500).json({
            error: String(e?.message || "Unknown error"),
            cause: e?.cause ? String(e.cause) : null,
            stack: e?.stack ? String(e.stack).split("\n").slice(0, 6).join("\n") : null,
        });
    }
}
