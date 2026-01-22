// pages/api/admin/mangadex-delta-sync.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { slugify } from "@/lib/slugify";
import {
    getCreators,
    getMangaDexCoverCandidates,
    normalizeMangaDexDescription,
    normalizeMangaDexTitle,
    splitTags,
    normalizeStatus,
    type MangaDexManga,
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

        const imgRes = await fetch(url, {
            headers: { "User-Agent": "your-app-cover-cacher" },
        });

        if (!imgRes.ok) {
            lastStatus = imgRes.status;
            continue;
        }

        const contentType = imgRes.headers.get("content-type") || "image/jpeg";
        const buf = Buffer.from(await imgRes.arrayBuffer());

        const urlPath = new URL(url).pathname.toLowerCase();
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

    throw new Error(
        `Failed to download cover from all candidates. Last: ${lastUrl} (status ${lastStatus})`
    );
}

function parseUpdatedAt(m: any): string | null {
    // MangaDex typically provides attributes.updatedAt as ISO string
    const v = m?.attributes?.updatedAt || m?.attributes?.updated_at || null;
    return typeof v === "string" ? v : null;
}

async function fetchRecentUpdated(limit: number, offset: number) {
    const url = new URL("https://api.mangadex.org/manga");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("order[updatedAt]", "desc");
    // includes cover_art makes cover candidates easier depending on your lib
    url.searchParams.append("includes[]", "cover_art");
    url.searchParams.append("includes[]", "author");
    url.searchParams.append("includes[]", "artist");

    const r = await fetch(url.toString(), {
        headers: { "User-Agent": "your-app-delta-sync" },
    });

    if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(`MangaDex list failed: ${r.status} ${txt}`.slice(0, 500));
    }

    const j = await r.json();
    const data = (j?.data || []) as MangaDexManga[];
    const total = typeof j?.total === "number" ? j.total : null;

    return { data, total };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        requireAdmin(req);

        const stateId = String(req.query.state_id || "titles_delta");
        const maxPages = Math.max(1, Math.min(50, Number(req.query.max_pages || 5))); // safety
        const hardCap = Math.max(1, Math.min(5000, Number(req.query.hard_cap || 500))); // max items per run

        // Load crawl state
        const { data: st, error: stErr } = await supabaseAdmin
            .from("mangadex_crawl_state")
            .select("*")
            .eq("id", stateId)
            .maybeSingle();

        if (stErr) throw stErr;

        const pageLimit = st?.page_limit ?? 100;
        const cursorUpdatedAt: string | null = st?.cursor_updated_at ?? null;
        const cursorLastId: string | null = st?.cursor_last_id ?? null;

        let processed = 0;
        let pages = 0;
        let offset = 0;

        // Track newest item we touched this run (for cursor advance)
        let newestUpdatedAt: string | null = null;
        let newestId: string | null = null;

        const touched: Array<{ mangadex_id: string; manga_id: string; updatedAt: string | null }> = [];

        outer: while (pages < maxPages && processed < hardCap) {
            const { data } = await fetchRecentUpdated(pageLimit, offset);
            pages += 1;

            if (!data.length) break;

            for (const m of data) {
                if (processed >= hardCap) break outer;

                const mdId = (m as any)?.id as string;
                const updatedAt = parseUpdatedAt(m);

                // Stop condition:
                // If we have a cursorUpdatedAt and this item is older than it, we're done.
                // If equal timestamp, use id tie-breaker: stop when we've reached <= cursorLastId in the sorted stream.
                if (cursorUpdatedAt && updatedAt) {
                    if (updatedAt < cursorUpdatedAt) break outer;
                    if (updatedAt === cursorUpdatedAt && cursorLastId && mdId <= cursorLastId) break outer;
                }

                // Build normalized fields (same as ingest)
                const publicationYear = (m as any)?.attributes?.year ?? null;
                const titles = normalizeMangaDexTitle(m);
                const description = normalizeMangaDexDescription(m);
                const status = normalizeStatus(m);
                const { genres, themes } = splitTags(m);
                const coverCandidates = getMangaDexCoverCandidates(m);
                const coverUrl = coverCandidates[0] || null;
                const { authors, artists } = getCreators(m);

                const mergedGenres = Array.from(new Set([...(genres || []), ...(themes || [])])).sort((a, b) =>
                    a.localeCompare(b)
                );

                const base =
                    titles.title_preferred ||
                    titles.title_english ||
                    titles.title ||
                    `mangadex-${mdId}`;

                const slug = slugify(base);

                // Upsert core manga row via RPC (now safe by external_id)
                const { data: mangaId, error: rpcErr } = await supabaseAdmin.rpc("upsert_manga_from_mangadex", {
                    p_slug: slug,
                    p_title: titles.title,
                    p_title_english: titles.title_english,
                    p_title_native: titles.title_native,
                    p_title_preferred: titles.title_preferred,
                    p_description: description,
                    p_status: status,
                    p_format: null,
                    p_source: "mangadex",
                    p_genres: mergedGenres,
                    p_publication_year: publicationYear,
                    p_total_chapters: null,
                    p_total_volumes: null,
                    p_cover_image_url: coverUrl, // temporary external
                    p_external_id: mdId,
                    p_snapshot: {
                        mangadex_id: mdId,
                        attributes: (m as any).attributes,
                        relationships: (m as any).relationships,
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

                if (rpcErr) throw rpcErr;

                // Log what we touched so we can see "what just changed" easily.
                await supabaseAdmin.from("mangadex_delta_log").insert({
                    state_id: stateId,
                    mangadex_id: mdId,
                    manga_id: mangaId,
                    mangadex_updated_at: updatedAt,
                });

                // Cache cover if we have candidates AND current manga row is missing it.
                // (Avoid re-downloading every delta run.)
                let cached_cover_image_url: string | null = null;

                if (coverCandidates.length > 0) {
                    const { data: cur, error: curErr } = await supabaseAdmin
                        .from("manga")
                        .select("id, slug, cover_image_url, image_url")
                        .eq("id", mangaId)
                        .maybeSingle();

                    if (curErr) throw curErr;

                    const alreadyHasCover = Boolean(cur?.cover_image_url || cur?.image_url);

                    if (!alreadyHasCover) {
                        const cached = await cacheCoverToStorage({ slug: cur?.slug || slug, sourceUrls: coverCandidates });
                        cached_cover_image_url = cached.publicUrl;

                        const { error: updErr } = await supabaseAdmin
                            .from("manga")
                            .update({
                                cover_image_url: cached_cover_image_url,
                                image_url: cached_cover_image_url,
                            })
                            .eq("id", mangaId);

                        if (updErr) throw updErr;
                    }
                }

                // Enqueue art job (idempotent)
                const { error: jobErr } = await supabaseAdmin
                    .from("manga_art_jobs")
                    .upsert(
                        {
                            manga_id: mangaId,
                            status: "pending",
                            updated_at: new Date().toISOString(),
                        },
                        { onConflict: "manga_id" }
                    );

                if (jobErr) throw jobErr;

                // Track newest cursor values (we’re iterating newest->older, so first item is newest)
                if (!newestUpdatedAt && updatedAt) {
                    newestUpdatedAt = updatedAt;
                    newestId = mdId;
                }

                processed += 1;
                touched.push({ mangadex_id: mdId, manga_id: mangaId, updatedAt });
            }

            offset += pageLimit;
        }

        // Advance cursor to the newest thing we processed (top of stream)
        if (processed > 0) {
            const { error: updStateErr } = await supabaseAdmin
                .from("mangadex_crawl_state")
                .update({
                    cursor_updated_at: newestUpdatedAt,
                    cursor_last_id: newestId,
                    cursor_offset: 0,
                    updated_at: new Date().toISOString(),
                    processed_count: (st?.processed_count ?? 0) + processed,
                    mode: "updatedat",
                    page_limit: pageLimit,
                })
                .eq("id", stateId);

            if (updStateErr) throw updStateErr;
        }

        return res.status(200).json({
            ok: true,
            state_id: stateId,
            cursor_before: { cursorUpdatedAt, cursorLastId },
            cursor_after: processed ? { cursorUpdatedAt: newestUpdatedAt, cursorLastId: newestId } : null,
            pages,
            processed,
            sample: touched.slice(0, 25),
        });
    } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Unknown error" });
    }
}
