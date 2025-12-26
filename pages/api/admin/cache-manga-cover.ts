import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function requireAdmin(req: NextApiRequest) {
    const secret = req.headers["x-admin-secret"];
    if (!process.env.ADMIN_SECRET) throw new Error("ADMIN_SECRET not set");
    if (secret !== process.env.ADMIN_SECRET) throw new Error("Unauthorized");
}

function extFromContentType(ct: string | null) {
    if (!ct) return "jpg";
    if (ct.includes("png")) return "png";
    if (ct.includes("webp")) return "webp";
    return "jpg";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        requireAdmin(req);

        const mangaId = String(req.query.manga_id || "").trim();
        if (!mangaId) return res.status(400).json({ error: "Missing manga_id" });

        // Fetch the manga row
        const { data: manga, error: mangaErr } = await supabaseAdmin
            .from("manga")
            .select("id, slug, cover_image_url")
            .eq("id", mangaId)
            .single();

        if (mangaErr) throw mangaErr;
        if (!manga) return res.status(404).json({ error: "Manga not found" });

        const currentUrl = String(manga.cover_image_url || "");
        if (!currentUrl) return res.status(400).json({ error: "No cover_image_url to cache" });

        // If it's already our storage, do nothing
        if (currentUrl.includes("/storage/v1/object/public/manga-covers/")) {
            return res.status(200).json({ ok: true, skipped: true, cover_image_url: currentUrl });
        }

        // Download the image server-side
        const imgRes = await fetch(currentUrl, { headers: { "User-Agent": "your-app-cover-cacher" } });
        if (!imgRes.ok) throw new Error(`Failed to download cover: ${imgRes.status}`);

        const contentType = imgRes.headers.get("content-type");
        const ext = extFromContentType(contentType);
        const buf = Buffer.from(await imgRes.arrayBuffer());

        const path = `${manga.slug}/cover.${ext}`;

        // Upload to Supabase Storage
        const { error: upErr } = await supabaseAdmin.storage
            .from("manga-covers")
            .upload(path, buf, {
                contentType: contentType || "image/jpeg",
                upsert: true,
                metadata: {
                    source: "mangadex",
                    image: {
                        type: "cover",
                        resolution: "original",
                        format: "jpg",
                    },
                },
            });

        if (upErr) throw upErr;

        // Get public URL
        const { data: pub } = supabaseAdmin.storage.from("manga-covers").getPublicUrl(path);
        const newUrl = pub.publicUrl;

        // Update manga row
        const { error: updateErr } = await supabaseAdmin
            .from("manga")
            .update({ cover_image_url: newUrl })
            .eq("id", manga.id);

        if (updateErr) throw updateErr;

        return res.status(200).json({
            ok: true,
            manga_id: manga.id,
            old_url: currentUrl,
            cover_image_url: newUrl,
            storage_path: path,
        });
    } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Unknown error" });
    }
}
