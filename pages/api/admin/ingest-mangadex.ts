// pages/api/admin/ingest-mangadex.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { slugify } from "@/lib/slugify";
import {
    getCreators,
    getMangaDexCoverCandidates,
    getMangaDexMangaById,
    normalizeMangaDexDescription,
    normalizeMangaDexTitle,
    searchMangaDexByTitle,
    splitTags,
    normalizeStatus,
} from "@/lib/mangadex";

function requireAdmin(req: NextApiRequest) {
    const secret = req.headers["x-admin-secret"];
    if (!process.env.ADMIN_SECRET) throw new Error("ADMIN_SECRET not set");
    if (secret !== process.env.ADMIN_SECRET) throw new Error("Unauthorized");
}

async function cacheCoverToStorage(opts: {
    slug: string;
    sourceUrls: string[];
}): Promise<{ publicUrl: string; usedSourceUrl: string }> {
    const { slug, sourceUrls } = opts;

    let lastStatus: number | null = null;
    let lastUrl: string | null = null;

    for (const url of sourceUrls) {
        lastUrl = url;

        const imgRes = await fetch(url, { headers: { "User-Agent": "your-app-cover-cacher" } });
        if (!imgRes.ok) {
            lastStatus = imgRes.status;
            continue; // try next candidate
        }

        const contentType = imgRes.headers.get("content-type") || "image/jpeg";
        const buf = Buffer.from(await imgRes.arrayBuffer());

        const urlPath = new URL(url).pathname.toLowerCase();

        // MangaDex cover filename often includes ".png" or ".jpg" before the size suffix
        const ext = urlPath.includes(".png") ? "png" : "jpg";

        const path = `${slug}/cover.${ext}`;

        const { error: upErr } = await supabaseAdmin.storage
            .from("manga-covers")
            .upload(path, buf, {
                contentType,
                upsert: true,
                metadata: {
                    source: "mangadex",
                    image: { type: "cover", resolution: "best_available", format: ext },
                },
            });

        if (upErr) throw upErr;

        const { data: pub } = supabaseAdmin.storage.from("manga-covers").getPublicUrl(path);
        return { publicUrl: pub.publicUrl, usedSourceUrl: url };
    }

    throw new Error(`Failed to download cover from all candidates. Last: ${lastUrl} (status ${lastStatus})`);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        requireAdmin(req);

        const mode = String(req.query.mode || "");
        if (mode === "search") {
            const query = String(req.query.query || "").trim();
            if (!query) return res.status(400).json({ error: "Missing query" });

            const results = await searchMangaDexByTitle(query, 10);
            const preview = results.map((m) => {
                const t = normalizeMangaDexTitle(m);
                return {
                    id: m.id,
                    title: t.title,
                    title_english: t.title_english,
                    status: normalizeStatus(m),
                    cover: getMangaDexCoverCandidates(m)[0] || null,
                };
            });

            return res.status(200).json({ results: preview });
        }

        if (mode === "ingest") {
            const id = String(req.query.id || "").trim();
            if (!id) return res.status(400).json({ error: "Missing id" });

            const m = await getMangaDexMangaById(id);

            const titles = normalizeMangaDexTitle(m);
            const description = normalizeMangaDexDescription(m);
            const status = normalizeStatus(m);
            const { genres, themes } = splitTags(m);
            const coverCandidates = getMangaDexCoverCandidates(m);
            const coverUrl = coverCandidates[0] || null;
            const { authors, artists } = getCreators(m);

            // Your existing manga table has only `genres` (not themes)
            // We'll store themes by appending to genres with a prefix OR ignore.
            // Safer: ignore themes for now, or merge.
            const mergedGenres = Array.from(new Set([...genres, ...themes])).sort((a, b) => a.localeCompare(b));

            // slug: stable from preferred title, fallback to id
            const base = titles.title_preferred || titles.title_english || titles.title || `mangadex-${id}`;
            const slug = slugify(base);

            const { data, error } = await supabaseAdmin.rpc("upsert_manga_from_mangadex", {
                p_slug: slug,
                p_title: titles.title,
                p_title_english: titles.title_english,
                p_title_native: titles.title_native,
                p_title_preferred: titles.title_preferred,
                p_description: description,
                p_status: status,
                p_format: null, // MangaDex "contentRating"/"publicationDemographic" exists but format is not clean; set later if you want
                p_source: "mangadex",
                p_genres: mergedGenres,
                p_total_chapters: null,
                p_total_volumes: null,
                p_cover_image_url: coverUrl, // NOTE: later we will cache into Supabase Storage and replace this
                p_external_id: id,
                p_snapshot: {
                    mangadex_id: id,
                    attributes: m.attributes,
                    relationships: m.relationships,
                    // IMPORTANT: no chapters, no at-home, nothing else
                    normalized: {
                        ...titles,
                        status,
                        genres,
                        themes,
                        coverUrl,
                        coverCandidates,
                        authors,
                        artists,
                    },
                },
            });

            if (error) throw error;

            let cached_cover_image_url: string | null = null;
            let cover_used_source_url: string | null = null;

            // ✅ Cache original cover into Supabase Storage and update the manga row
            if (coverCandidates.length > 0) {
                const cached = await cacheCoverToStorage({ slug, sourceUrls: coverCandidates });
                cached_cover_image_url = cached.publicUrl;
                cover_used_source_url = cached.usedSourceUrl;

                const { error: updErr } = await supabaseAdmin
                    .from("manga")
                    .update({
                        cover_image_url: cached_cover_image_url,
                        image_url: cached_cover_image_url,
                    })
                    .eq("slug", slug);

                if (updErr) throw updErr;
            }

            // ✅ enqueue art caching job (idempotent)  ✅✅ PUT IT HERE
            await supabaseAdmin
                .from("manga_art_jobs")
                .upsert(
                    {
                        manga_id: data, // this is the manga.id returned by your RPC
                        status: "pending",
                    },
                    { onConflict: "manga_id" }
                );

            // ✅ enqueue art caching job (idempotent)
            const { error: jobErr } = await supabaseAdmin
                .from("manga_art_jobs")
                .upsert(
                    {
                        manga_id: data, // manga UUID returned by your RPC
                        status: "pending",
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: "manga_id" }
                );

            if (jobErr) throw jobErr;


            return res.status(200).json({
                ok: true,
                manga_id: data,
                slug,
                titles,
                status,
                genres,
                themes,
                cached_cover_image_url,
                cover_used_source_url,
                coverUrl,
                coverCandidates,
                creators: { authors, artists },
            });
        }

        return res.status(400).json({ error: "Invalid mode. Use mode=search or mode=ingest" });
    } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Unknown error" });
    }
}
