// pages/api/admin/mangadex-recent-chapters-sync.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUILD_STAMP = "recent-chapters-sync-2026-01-24-01";
const DB_MODE_SAFE = "updatedat";

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

function mdUpdatedAtFromChapter(c: any): string | null {
  const v = c?.attributes?.updatedAt || c?.attributes?.updated_at || null;
  return typeof v === "string" ? v : null;
}

function mdReadableAtFromChapter(c: any): string | null {
  const v = c?.attributes?.readableAt || null;
  return typeof v === "string" ? v : null;
}

function mdPublishedAtFromChapter(c: any): string | null {
  const v = c?.attributes?.publishAt || c?.attributes?.publishedAt || null;
  return typeof v === "string" ? v : null;
}

function relId(c: any, type: string): string | null {
  const rels = c?.relationships;
  if (!Array.isArray(rels)) return null;
  const r = rels.find((x: any) => x?.type === type);
  return typeof r?.id === "string" ? r.id : null;
}

function relName(c: any, type: string): { id: string | null; name: string | null } {
  const rels = c?.relationships;
  if (!Array.isArray(rels)) return { id: null, name: null };
  const r = rels.find((x: any) => x?.type === type);
  const id = typeof r?.id === "string" ? r.id : null;
  const name = typeof r?.attributes?.name === "string" ? r.attributes.name : null;
  return { id, name };
}

async function fetchRecentChapters(limit: number, offset: number) {
  const url = new URL("https://api.mangadex.org/chapter");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  // IMPORTANT: homepage-style feed is better modeled by readableAt/publishAt,
  // but MangaDex supports updatedAt ordering reliably. We'll use updatedAt for cursoring.
  url.searchParams.set("order[updatedAt]", "desc");

  // include manga + group so we can map + display without extra calls
  url.searchParams.append("includes[]", "manga");
  url.searchParams.append("includes[]", "scanlation_group");

  const r = await fetch(url.toString(), { headers: { "User-Agent": "your-app-recent-chapters-sync" } });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`MangaDex /chapter failed: ${r.status} ${txt}`.slice(0, 600));
  }
  const j = await r.json();
  const data = (j?.data || []) as any[];
  return { data };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    requireAdmin(req);

    const stateId = String(req.query.state_id || "recent_chapters");
    const maxPages = Math.max(1, Math.min(25, Number(req.query.max_pages || 5)));
    const hardCap = Math.max(1, Math.min(5000, Number(req.query.hard_cap || 500)));
    const force = String(req.query.force || "") === "1";

    // load cursor
    const { data: st, error: stErr } = await supabaseAdmin
      .from("mangadex_crawl_state")
      .select("*")
      .eq("id", stateId)
      .maybeSingle();

    if (stErr) throw stErr;
    if (!st) throw new Error(`mangadex_crawl_state missing id="${stateId}"`);

    const pageLimit = Math.max(10, Math.min(200, Number(st.page_limit || 100)));
    const cursorUpdatedAt: string | null = st.cursor_updated_at ?? null;
    const cursorLastId: string | null = st.cursor_last_id ?? null;
    const cursorMs = parseIsoMs(cursorUpdatedAt);

    let processed = 0;
    let pages = 0;
    let offset = 0;

    let newestUpdatedAt: string | null = null;
    let newestId: string | null = null;

    const sample: any[] = [];

    outer: while (pages < maxPages && processed < hardCap) {
      const { data } = await fetchRecentChapters(pageLimit, offset);
      pages += 1;
      if (!data.length) break;

      for (const c of data) {
        if (processed >= hardCap) break outer;

        const chapterId = String(c?.id || "");
        const updatedAt = mdUpdatedAtFromChapter(c);
        const updatedMs = parseIsoMs(updatedAt);

        // cursor stop (feed is desc)
        if (!force && cursorMs != null && updatedMs != null) {
          if (updatedMs < cursorMs) break outer;
          if (updatedMs === cursorMs && cursorLastId && chapterId <= cursorLastId) break outer;
        }

        // record newest cursor from first valid item
        if (!newestUpdatedAt && updatedAt) {
          newestUpdatedAt = updatedAt;
          newestId = chapterId;
        }

        const mdMangaId = relId(c, "manga");
        if (!mdMangaId) {
          processed += 1;
          continue;
        }

        // map to your manga_id if you've ingested the manga
        const { data: link, error: linkErr } = await supabaseAdmin
          .from("manga_external_ids")
          .select("manga_id")
          .eq("source", "mangadex")
          .eq("external_id", mdMangaId)
          .maybeSingle();
        if (linkErr) throw linkErr;

        const grp = relName(c, "scanlation_group");

        const row = {
          mangadex_chapter_id: chapterId,
          manga_id: link?.manga_id ?? null,
          mangadex_manga_id: mdMangaId,

          chapter: c?.attributes?.chapter ?? null,
          volume: c?.attributes?.volume ?? null,
          title: c?.attributes?.title ?? null,
          translated_language: c?.attributes?.translatedLanguage ?? null,

          readable_at: mdReadableAtFromChapter(c),
          published_at: mdPublishedAtFromChapter(c),
          mangadex_updated_at: updatedAt,

          group_id: grp.id,
          group_name: grp.name,

          raw_json: {
            id: chapterId,
            attributes: c?.attributes ?? null,
            relationships: c?.relationships ?? null,
          },
          updated_at: new Date().toISOString(),
        };

        const { error: upErr } = await supabaseAdmin
          .from("mangadex_recent_chapters")
          .upsert(row, { onConflict: "mangadex_chapter_id" });

        if (upErr) throw upErr;

        processed += 1;

        if (sample.length < 25) {
          sample.push({
            chapter_id: chapterId,
            md_manga_id: mdMangaId,
            manga_id: link?.manga_id ?? null,
            ch: row.chapter,
            vol: row.volume,
            lang: row.translated_language,
            group: row.group_name,
            readable_at: row.readable_at,
            updated_at: row.mangadex_updated_at,
          });
        }
      }

      offset += pageLimit;
    }

    // heartbeat
    const { error: hbErr } = await supabaseAdmin
      .from("mangadex_crawl_state")
      .update({ updated_at: new Date().toISOString(), page_limit: pageLimit, mode: DB_MODE_SAFE })
      .eq("id", stateId);
    if (hbErr) throw hbErr;

    // update cursor
    if (processed > 0 && newestUpdatedAt) {
      const { error: updErr } = await supabaseAdmin
        .from("mangadex_crawl_state")
        .update({
          cursor_updated_at: newestUpdatedAt,
          cursor_last_id: newestId,
          cursor_offset: 0,
          processed_count: (st.processed_count ?? 0) + processed,
          updated_at: new Date().toISOString(),
          mode: DB_MODE_SAFE,
          page_limit: pageLimit,
        })
        .eq("id", stateId);
      if (updErr) throw updErr;
    }

    return res.status(200).json({
      ok: true,
      build_stamp: BUILD_STAMP,
      state_id: stateId,
      cursor_before: { cursorUpdatedAt, cursorLastId },
      cursor_after: processed > 0 ? { cursorUpdatedAt: newestUpdatedAt, cursorLastId: newestId } : null,
      pages,
      processed,
      forced: force,
      sample,
      note: "Stores true chapter feed rows into mangadex_recent_chapters (safe: does not modify manga).",
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg === "Unauthorized") return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: msg });
  }
}
