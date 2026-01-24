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

const BUILD_STAMP = "delta-sync-2026-01-24-FULL-REWRITE-01";

function requireAdmin(req: NextApiRequest) {
  const secret = req.headers["x-admin-secret"];
  if (!process.env.ADMIN_SECRET) throw new Error("ADMIN_SECRET not set");
  if (secret !== process.env.ADMIN_SECRET) throw new Error("Unauthorized");
}

function parseIsoMs(ts: string | null): number | null {
  if (!ts) return null;
  const ms = Date.parse(ts);
  return Number.isFinite(ms) ? ms : null;
}

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

function mdUpdatedAtFromManga(m: any): string | null {
  const v = m?.attributes?.updatedAt || m?.attributes?.updated_at || null;
  return typeof v === "string" ? v : null;
}

function mdUpdatedAtFromChapter(c: any): string | null {
  const v = c?.attributes?.updatedAt || c?.attributes?.updated_at || null;
  return typeof v === "string" ? v : null;
}

function chapterMangaId(c: any): string | null {
  const rels = c?.relationships;
  if (!Array.isArray(rels)) return null;
  const m = rels.find((r: any) => r?.type === "manga");
  return typeof m?.id === "string" ? m.id : null;
}

async function fetchRecentMangaUpdated(limit: number, offset: number) {
  const url = new URL("https://api.mangadex.org/manga");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("order[updatedAt]", "desc");
  url.searchParams.append("includes[]", "cover_art");
  url.searchParams.append("includes[]", "author");
  url.searchParams.append("includes[]", "artist");

  const r = await fetch(url.toString(), { headers: { "User-Agent": "your-app-delta-sync" } });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`MangaDex /manga failed: ${r.status} ${txt}`.slice(0, 500));
  }
  const j = await r.json();
  const data = (j?.data || []) as MangaDexManga[];
  return { data };
}

async function fetchRecentChapterUpdated(limit: number, offset: number) {
  const url = new URL("https://api.mangadex.org/chapter");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("order[updatedAt]", "desc");
  url.searchParams.append("includes[]", "manga");

  const r = await fetch(url.toString(), { headers: { "User-Agent": "your-app-delta-sync" } });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`MangaDex /chapter failed: ${r.status} ${txt}`.slice(0, 500));
  }
  const j = await r.json();
  const data = (j?.data || []) as any[];
  return { data };
}

async function fetchFullMangaById(mdMangaId: string) {
  const url = new URL(`https://api.mangadex.org/manga/${mdMangaId}`);
  url.searchParams.append("includes[]", "cover_art");
  url.searchParams.append("includes[]", "author");
  url.searchParams.append("includes[]", "artist");

  const r = await fetch(url.toString(), { headers: { "User-Agent": "your-app-delta-sync" } });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`MangaDex /manga/${mdMangaId} failed: ${r.status} ${txt}`.slice(0, 500));
  }
  const j = await r.json();
  return j?.data as MangaDexManga;
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

  throw new Error(`Failed to download cover from candidates. Last: ${lastUrl} (status ${lastStatus})`);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    requireAdmin(req);

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      process.env.SUPABASE_PROJECT_URL ||
      null;

    const feedMode = String(req.query.mode || "manga"); // "manga" | "chapter"
    const mode: "manga" | "chapter" = feedMode === "chapter" ? "chapter" : "manga";

    const peek = String(req.query.peek || "") === "1";
    const force = String(req.query.force || "") === "1";

    const stateId = String(req.query.state_id || (mode === "chapter" ? "chapters_delta" : "titles_delta"));

    const maxPages = Math.max(1, Math.min(50, Number(req.query.max_pages || 5)));
    const hardCap = Math.max(1, Math.min(5000, Number(req.query.hard_cap || 500)));

    // Load crawl state
    const { data: st, error: stErr } = await supabaseAdmin
      .from("mangadex_crawl_state")
      .select("*")
      .eq("id", stateId)
      .maybeSingle();

    if (stErr) throw stErr;
    if (!st) {
      throw new Error(
        `mangadex_crawl_state row not found for id="${stateId}". Create it with mode='updatedat' (NOT 'chapter').`
      );
    }

    const pageLimit = st?.page_limit ?? 100;
    const cursorUpdatedAt: string | null = st?.cursor_updated_at ?? null;
    const cursorLastId: string | null = st?.cursor_last_id ?? null;
    const cursorMs = parseIsoMs(cursorUpdatedAt);

    // PEEK (debug)
    if (peek) {
      if (mode === "chapter") {
        const { data } = await fetchRecentChapterUpdated(10, 0);
        const peekRows = data.map((c: any) => ({
          id: c?.id ?? null,
          updatedAt: mdUpdatedAtFromChapter(c),
          mangaId: chapterMangaId(c),
        }));

        return res.status(200).json({
          ok: true,
          mode: "peek_chapter",
          build_stamp: BUILD_STAMP,
          supabase_url: supabaseUrl,
          state_id: stateId,
          cursor_before: { cursorUpdatedAt, cursorLastId },
          peek: peekRows,
          note: "This is MangaDex /chapter order[updatedAt]=desc (homepage-style activity).",
        });
      }

      const { data } = await fetchRecentMangaUpdated(10, 0);
      const peekRows = data.map((m: any) => ({
        id: m?.id ?? null,
        updatedAt: mdUpdatedAtFromManga(m),
        title:
          m?.attributes?.title?.en ||
          (m?.attributes?.title ? Object.values(m.attributes.title)[0] : null) ||
          null,
      }));

      return res.status(200).json({
        ok: true,
        mode: "peek_manga",
        build_stamp: BUILD_STAMP,
        supabase_url: supabaseUrl,
        state_id: stateId,
        cursor_before: { cursorUpdatedAt, cursorLastId },
        peek: peekRows,
        note: "This is MangaDex /manga order[updatedAt]=desc (metadata).",
      });
    }

    let processedRecords = 0; // how many feed records we advanced through
    let refreshedManga = 0; // how many manga we actually upserted
    let pages = 0;
    let offset = 0;

    let newestUpdatedAt: string | null = null;
    let newestId: string | null = null;

    const refreshedThisRun = new Set<string>();
    const sample: any[] = [];

    outer: while (pages < maxPages && processedRecords < hardCap) {
      const feed =
        mode === "chapter"
          ? await fetchRecentChapterUpdated(pageLimit, offset)
          : await fetchRecentMangaUpdated(pageLimit, offset);

      const data = feed.data as any[];
      pages += 1;
      if (!data.length) break;

      for (const item of data) {
        if (processedRecords >= hardCap) break outer;

        const feedId = String(item?.id || "");
        const updatedAt = mode === "chapter" ? mdUpdatedAtFromChapter(item) : mdUpdatedAtFromManga(item);
        const updatedMs = parseIsoMs(updatedAt);

        // Cursor stop (desc feed)
        if (!force && cursorMs != null && updatedMs != null) {
          if (updatedMs < cursorMs) break outer;
          if (updatedMs === cursorMs && cursorLastId && feedId <= cursorLastId) break outer;
        }

        if (!newestUpdatedAt && updatedAt) {
          newestUpdatedAt = updatedAt;
          newestId = feedId;
        }

        processedRecords += 1;

        const mdMangaId = mode === "chapter" ? chapterMangaId(item) : feedId;
        if (!mdMangaId) {
          if (sample.length < 25) sample.push({ feed_id: feedId, updatedAt, skipped: "no_manga_id" });
          continue;
        }

        if (refreshedThisRun.has(mdMangaId)) {
          if (sample.length < 25) {
            sample.push({ feed_id: feedId, updatedAt, manga: mdMangaId, skipped: "already_refreshed_this_run" });
          }
          continue;
        }
        refreshedThisRun.add(mdMangaId);

        // Load existing link -> existing manga row
        const { data: beforeLink, error: beforeLinkErr } = await supabaseAdmin
          .from("manga_external_ids")
          .select("manga_id")
          .eq("source", "mangadex")
          .eq("external_id", mdMangaId)
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

        // Get full manga object if chapter-triggered
        const m: any = mode === "chapter" ? await fetchFullMangaById(mdMangaId) : item;

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

        const baseTitle = titles.title_preferred || titles.title_english || titles.title || `mangadex-${mdMangaId}`;
        const slug = slugify(baseTitle);

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
          p_external_id: mdMangaId,
          p_snapshot: {
            mangadex_id: mdMangaId,
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
        refreshedManga += 1;

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

        const changedWithTrigger =
          mode === "chapter"
            ? { __trigger: { mode: "chapter", feed_id: feedId, feed_updatedAt: updatedAt }, ...changed }
            : changed;

        const { error: logErr } = await supabaseAdmin.from("mangadex_delta_log").insert({
          state_id: stateId,
          mangadex_id: mdMangaId,
          manga_id: mangaId,
          mangadex_updated_at: updatedAt,
          action,
          changed_fields: changedWithTrigger,
          before_row: beforeRow,
          after_row: afterRow,
        });

        if (logErr) throw logErr;

        if (coverCandidates.length > 0) {
          const alreadyHasCover = Boolean(afterRaw?.cover_image_url || afterRaw?.image_url);
          if (!alreadyHasCover) {
            const cached = await cacheCoverToStorage({
              slug: afterRaw?.slug || slug,
              sourceUrls: coverCandidates,
            });

            const { error: updErr } = await supabaseAdmin
              .from("manga")
              .update({ cover_image_url: cached.publicUrl, image_url: cached.publicUrl })
              .eq("id", mangaId);

            if (updErr) throw updErr;
          }
        }

        const { error: jobErr } = await supabaseAdmin
          .from("manga_art_jobs")
          .upsert({ manga_id: mangaId, status: "pending", updated_at: new Date().toISOString() }, { onConflict: "manga_id" });

        if (jobErr) throw jobErr;

        if (sample.length < 25) {
          sample.push({ feed_id: feedId, updatedAt, manga: mdMangaId, manga_id: mangaId, action });
        }
      }

      offset += pageLimit;
    }

    // Heartbeat: DO NOT write "chapter" into st.mode (constraint). Keep the existing value.
    const { error: hbErr } = await supabaseAdmin
      .from("mangadex_crawl_state")
      .update({
        updated_at: new Date().toISOString(),
        page_limit: pageLimit,
      })
      .eq("id", stateId);

    if (hbErr) throw hbErr;

    if (processedRecords > 0 && newestUpdatedAt) {
      const { error: updStateErr } = await supabaseAdmin
        .from("mangadex_crawl_state")
        .update({
          cursor_updated_at: newestUpdatedAt,
          cursor_last_id: newestId,
          cursor_offset: 0,
          processed_count: (st?.processed_count ?? 0) + processedRecords,
          updated_at: new Date().toISOString(),
          page_limit: pageLimit,
          // IMPORTANT: keep cursor strategy stable for constraint
          mode: "updatedat",
        })
        .eq("id", stateId);

      if (updStateErr) throw updStateErr;
    }

    return res.status(200).json({
      ok: true,
      build_stamp: BUILD_STAMP,
      supabase_url: supabaseUrl,
      mode,
      state_id: stateId,
      cursor_before: { cursorUpdatedAt, cursorLastId },
      cursor_after: processedRecords > 0 ? { cursorUpdatedAt: newestUpdatedAt, cursorLastId: newestId } : null,
      pages,
      processed: processedRecords,
      refreshed_manga: refreshedManga,
      forced: force,
      sample,
      note:
        mode === "manga"
          ? "MangaDex /manga updatedAt (metadata). Often quiet."
          : "MangaDex /chapter updatedAt (homepage-style). Refreshes parent manga so you see constant activity.",
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
