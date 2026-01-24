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

const BUILD_STAMP = "delta-sync-debug-2026-01-24-01";

function requireAdmin(req: NextApiRequest) {
  const secret = req.headers["x-admin-secret"];
  if (!process.env.ADMIN_SECRET) throw new Error("ADMIN_SECRET not set");
  if (secret !== process.env.ADMIN_SECRET) throw new Error("Unauthorized");
}

function stripTrailingSlash(s: string) {
  return String(s || "").replace(/\/+$/, "");
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

    const { error: upErr } = await supabaseAdmin.storage.from("manga-covers").upload(path, buf, {
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
  const v = m?.attributes?.updatedAt || m?.attributes?.updated_at || null;
  return typeof v === "string" ? v : null;
}

async function fetchRecentUpdated(limit: number, offset: number) {
  const url = new URL("https://api.mangadex.org/manga");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("order[updatedAt]", "desc");
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

// Keep this small: only fields you want to diff in the dashboard.
function pickComparableMangaRow(row: any) {
  if (!row) return null;
  return {
    id: row.id ?? null,
    slug: row.slug ?? null,
    title: row.title ?? null,
    title_english: row.title_english ?? null,
    title_native: row.title_native ?? null,
    title_preferred: row.title_preferred ?? null,
    description: row.description ?? null,
    status: row.status ?? null,
    publication_year: row.publication_year ?? null,
    genres: row.genres ?? null,
    cover_image_url: row.cover_image_url ?? null,
    image_url: row.image_url ?? null,
    external_id: row.external_id ?? null,
    source: row.source ?? null,
  };
}

function diffObjects(before: any, after: any) {
  const changes: Record<string, { from: any; to: any }> = {};
  const keys = new Set<string>([...Object.keys(before || {}), ...Object.keys(after || {})]);

  for (const k of keys) {
    const bv = before?.[k];
    const av = after?.[k];

    const bNorm = Array.isArray(bv) ? [...bv].slice().sort() : bv;
    const aNorm = Array.isArray(av) ? [...av].slice().sort() : av;

    const same = JSON.stringify(bNorm ?? null) === JSON.stringify(aNorm ?? null);
    if (!same) changes[k] = { from: bv ?? null, to: av ?? null };
  }

  return changes;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    requireAdmin(req);

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      process.env.SUPABASE_PROJECT_URL ||
      null;

    // Controls
    const stateId = String(req.query.state_id || "titles_delta");
    const maxPages = Math.max(1, Math.min(50, Number(req.query.max_pages || 5)));
    const hardCap = Math.max(1, Math.min(5000, Number(req.query.hard_cap || 500)));

    // Debug helpers
    const peek = String(req.query.peek || "") === "1";     // show what MangaDex "updatedAt" actually returns
    const force = String(req.query.force || "") === "1";   // ignore cursor stop condition (TEST ONLY)
    const debugMdId = typeof req.query.md_id === "string" ? req.query.md_id : null;

    // DEBUG MODE: check if a specific md id exists already
    if (debugMdId) {
      const { data: beforeLink, error: beforeLinkErr } = await supabaseAdmin
        .from("manga_external_ids")
        .select("manga_id, source, external_id")
        .eq("source", "mangadex")
        .eq("external_id", debugMdId)
        .maybeSingle();

      if (beforeLinkErr) throw beforeLinkErr;

      let beforeRaw: any = null;

      if (beforeLink?.manga_id) {
        const { data: b, error: bErr } = await supabaseAdmin
          .from("manga")
          .select("id, slug, title, source")
          .eq("id", beforeLink.manga_id)
          .maybeSingle();

        if (bErr) throw bErr;
        beforeRaw = b;
      }

      return res.status(200).json({
        ok: true,
        mode: "debug_md_id",
        build_stamp: BUILD_STAMP,
        supabase_url: supabaseUrl,
        md_id: debugMdId,
        before_link: beforeLink,
        before_manga: beforeRaw,
        inferred_action: beforeRaw?.id ? "update" : "insert",
      });
    }

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

    // PEEK MODE: show the top results MangaDex returns for /manga updatedAt
    if (peek) {
      const { data } = await fetchRecentUpdated(10, 0);

      const peekRows = data.map((m: any) => ({
        id: m?.id ?? null,
        updatedAt: parseUpdatedAt(m),
        title:
          m?.attributes?.title?.en ||
          (m?.attributes?.title ? Object.values(m.attributes.title)[0] : null) ||
          null,
      }));

      return res.status(200).json({
        ok: true,
        mode: "peek",
        build_stamp: BUILD_STAMP,
        supabase_url: supabaseUrl,
        state_id: stateId,
        cursor_before: { cursorUpdatedAt, cursorLastId },
        peek: peekRows,
        note:
          "This is MangaDex /manga order[updatedAt]=desc. If these updatedAt values are NOT newer than your cursorUpdatedAt, processed will correctly be 0.",
      });
    }

    let processed = 0;
    let pages = 0;
    let offset = 0;

    let newestUpdatedAt: string | null = null;
    let newestId: string | null = null;

    const touched: Array<{ mangadex_id: string; manga_id: string; updatedAt: string | null; action: string }> = [];

    outer: while (pages < maxPages && processed < hardCap) {
      const { data } = await fetchRecentUpdated(pageLimit, offset);
      pages += 1;

      if (!data.length) break;

      for (const m of data) {
        if (processed >= hardCap) break outer;

        const mdId = (m as any)?.id as string;
        const updatedAt = parseUpdatedAt(m);

        // Stop condition (cursor) - unless force=1
        if (!force && cursorUpdatedAt && updatedAt) {
          if (updatedAt < cursorUpdatedAt) break outer;
          if (updatedAt === cursorUpdatedAt && cursorLastId && mdId <= cursorLastId) break outer;
        }

        // BEFORE: do we already have it? (via manga_external_ids)
        const { data: beforeLink, error: beforeLinkErr } = await supabaseAdmin
          .from("manga_external_ids")
          .select("manga_id")
          .eq("source", "mangadex")
          .eq("external_id", mdId)
          .maybeSingle();

        if (beforeLinkErr) throw beforeLinkErr;

        let beforeRaw: any = null;

        if (beforeLink?.manga_id) {
          const { data: b, error: bErr } = await supabaseAdmin
            .from("manga")
            .select(
              "id, slug, title, title_english, title_native, title_preferred, description, status, publication_year, genres, cover_image_url, image_url, external_id, source"
            )
            .eq("id", beforeLink.manga_id)
            .maybeSingle();

          if (bErr) throw bErr;
          beforeRaw = b;
        }

        const action = beforeRaw?.id ? "update" : "insert";
        const beforeRow = pickComparableMangaRow(beforeRaw);

        // Normalize fields
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

        const baseTitle =
          titles.title_preferred || titles.title_english || titles.title || `mangadex-${mdId}`;
        const slug = slugify(baseTitle);

        // Upsert
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
          p_cover_image_url: coverUrl,
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

        // AFTER: load and diff
        const { data: afterRaw, error: afterErr } = await supabaseAdmin
          .from("manga")
          .select(
            "id, slug, title, title_english, title_native, title_preferred, description, status, publication_year, genres, cover_image_url, image_url, external_id, source"
          )
          .eq("id", mangaId)
          .maybeSingle();

        if (afterErr) throw afterErr;

        const afterRow = pickComparableMangaRow(afterRaw);
        const changed = diffObjects(beforeRow, afterRow);

        // Log
        const { error: logErr } = await supabaseAdmin.from("mangadex_delta_log").insert({
          state_id: stateId,
          mangadex_id: mdId,
          manga_id: mangaId,
          mangadex_updated_at: updatedAt,
          action,
          changed_fields: changed,
          before_row: beforeRow,
          after_row: afterRow,
        });

        if (logErr) throw logErr;

        // Cache cover if missing
        if (coverCandidates.length > 0) {
          const alreadyHasCover = Boolean(afterRaw?.cover_image_url || afterRaw?.image_url);
          if (!alreadyHasCover) {
            const cached = await cacheCoverToStorage({
              slug: afterRaw?.slug || slug,
              sourceUrls: coverCandidates,
            });

            const { error: updErr } = await supabaseAdmin
              .from("manga")
              .update({
                cover_image_url: cached.publicUrl,
                image_url: cached.publicUrl,
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

        if (!newestUpdatedAt && updatedAt) {
          newestUpdatedAt = updatedAt;
          newestId = mdId;
        }

        processed += 1;
        touched.push({ mangadex_id: mdId, manga_id: mangaId, updatedAt, action });
      }

      offset += pageLimit;
    }

    // Always update heartbeat so you can tell the job ran,
    // even when processed=0 (this is what your "last checked" shows).
    const { error: hbErr } = await supabaseAdmin
      .from("mangadex_crawl_state")
      .update({
        updated_at: new Date().toISOString(),
        page_limit: pageLimit,
      })
      .eq("id", stateId);

    if (hbErr) throw hbErr;

    if (processed > 0) {
      const { error: updStateErr } = await supabaseAdmin
        .from("mangadex_crawl_state")
        .update({
          cursor_updated_at: newestUpdatedAt,
          cursor_last_id: newestId,
          cursor_offset: 0,
          processed_count: (st?.processed_count ?? 0) + processed,
          mode: "updatedat",
          page_limit: pageLimit,
          updated_at: new Date().toISOString(),
        })
        .eq("id", stateId);

      if (updStateErr) throw updStateErr;
    }

    return res.status(200).json({
      ok: true,
      build_stamp: BUILD_STAMP,
      supabase_url: supabaseUrl,
      state_id: stateId,
      cursor_before: { cursorUpdatedAt, cursorLastId },
      cursor_after: processed ? { cursorUpdatedAt: newestUpdatedAt, cursorLastId: newestId } : null,
      pages,
      processed,
      forced: force,
      sample: touched.slice(0, 25),
      note:
        "If processed=0 consistently, MangaDex /manga updatedAt isn't advancing past your cursor. Use ?peek=1 to prove it. MangaDex homepage 'recent updates' is mostly chapter activity, not manga metadata.",
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
