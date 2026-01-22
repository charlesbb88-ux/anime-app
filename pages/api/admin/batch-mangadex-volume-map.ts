import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function requireAdmin(req: NextApiRequest) {
  const secret = req.headers["x-admin-secret"];
  if (!process.env.ADMIN_SECRET) throw new Error("ADMIN_SECRET not set");
  if (secret !== process.env.ADMIN_SECRET) throw new Error("Unauthorized");
}

const BASE = "https://api.mangadex.org";

type MdAggregateResponse = {
  volumes?: Record<
    string,
    {
      volume?: string | null;
      chapters?: Record<string, { chapter?: string | null; count?: number }>;
    }
  >;
};

function isNumericLike(s: string) {
  return /^(\d+)(\.\d+)?$/.test(s);
}

function sortChapterKeys(keys: string[]) {
  const numeric: string[] = [];
  const other: string[] = [];
  for (const k of keys) (isNumericLike(k) ? numeric : other).push(k);

  numeric.sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (na !== nb) return na - nb;
    return a.localeCompare(b);
  });

  other.sort((a, b) => a.localeCompare(b));
  return [...numeric, ...other];
}

function normalizeVolKey(v: any) {
  const s = String(v ?? "").trim();
  if (!s) return "none";
  const low = s.toLowerCase();
  if (low === "null") return "none";
  return s;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts?: {
    retries?: number;
    backoffMs?: number;
    timeoutMs?: number;
  }
) {
  const retries = opts?.retries ?? 4;
  const baseBackoffMs = opts?.backoffMs ?? 750;
  const timeoutMs = opts?.timeoutMs ?? 20_000;

  let lastErr: any = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(t);
      return res;
    } catch (e: any) {
      clearTimeout(t);
      lastErr = e;
      const delay = Math.min(8000, baseBackoffMs * Math.pow(2, attempt));
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastErr;
}

function serializeErr(e: any) {
  if (!e) return e;
  const out: any = {
    message: e.message,
    details: e.details,
    hint: e.hint,
    code: e.code,
    status: e.status,
    statusCode: e.statusCode,
    name: e.name,
  };
  for (const k of Object.keys(e)) {
    if (out[k] === undefined && typeof e[k] !== "object") out[k] = e[k];
  }
  return out;
}

function throwStep(step: string, err: any) {
  const payload = serializeErr(err);
  throw new Error(`${step}: ${JSON.stringify(payload)}`);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let step = "start";

  try {
    step = "auth";
    requireAdmin(req);

    step = "parse_query";
    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 25)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    // Supabase/PostgREST effectively caps responses around 1000 rows.
    // We'll scan in 1000-row pages and NOT skip within a page.
    const PAGE = 1000;

    // IN() chunk size for looking up existing maps
    const IN_CHUNK = 200;

    // Progress
    step = "count_totalEligible";
    const { count: totalEligible, error: totalEligibleErr } = await supabaseAdmin
      .from("manga_external_ids")
      .select("manga_id", { count: "exact", head: true })
      .eq("source", "mangadex");
    if (totalEligibleErr) throwStep(step, totalEligibleErr);

    step = "count_totalMapped";
    const { count: totalMapped, error: totalMappedErr } = await supabaseAdmin
      .from("manga_volume_chapter_map")
      .select("manga_id", { count: "exact", head: true });
    if (totalMappedErr) throwStep(step, totalMappedErr);

    const eligible = totalEligible ?? 0;
    const mappedBefore = totalMapped ?? 0;

    // 1) Scan forward from `offset` until we collect `limit` unmapped rows.
    step = "scan_for_unmapped";
    let scanOffset = offset;
    let scanned = 0;

    const rows: Array<{ manga_id: any; external_id: any }> = [];

    // This will become the next cursor position. We set it precisely to the row
    // AFTER the last row we examined (even if we stop mid-page).
    let nextOffset: number | null = null;

    while (rows.length < limit) {
      const { data: candidates, error: candErr } = await supabaseAdmin
        .from("manga_external_ids")
        .select("manga_id, external_id")
        .eq("source", "mangadex")
        .order("manga_id", { ascending: true })
        .range(scanOffset, scanOffset + PAGE - 1);

      if (candErr) throwStep("select_candidates_range", candErr);

      if (!candidates || candidates.length === 0) {
        // end of table
        nextOffset = null;
        break;
      }

      scanned += candidates.length;

      // Build list of ids in this page
      const candidateIds = candidates
        .map((c: any) => c.manga_id)
        .filter(Boolean)
        .map((x: any) => String(x));

      // Find existing map rows for this page
      const existingSet = new Set<string>();
      step = "select_existing_maps_in";
      for (let i = 0; i < candidateIds.length; i += IN_CHUNK) {
        const chunkIds = candidateIds.slice(i, i + IN_CHUNK).filter(Boolean);
        if (chunkIds.length === 0) continue;

        const { data: existingChunk, error: existErr } = await supabaseAdmin
          .from("manga_volume_chapter_map")
          .select("manga_id")
          .in("manga_id", chunkIds);

        if (existErr) {
          throwStep(
            `${step} chunk ${i}-${Math.min(i + IN_CHUNK - 1, candidateIds.length - 1)}`,
            existErr
          );
        }

        for (const row of existingChunk || []) existingSet.add(String((row as any).manga_id));
      }

      // Walk this page in order; stop EXACTLY when we’ve gathered enough,
      // and set nextOffset to the next row index within the full sorted list.
      let stoppedInsidePage = false;

      for (let idx = 0; idx < candidates.length; idx++) {
        const c: any = candidates[idx];
        const id = String(c.manga_id);

        if (!existingSet.has(id)) {
          rows.push(c);
          if (rows.length >= limit) {
            // We examined candidates[0..idx], so the next scan should begin at scanOffset + idx + 1
            nextOffset = scanOffset + idx + 1;
            stoppedInsidePage = true;
            break;
          }
        }
      }

      if (stoppedInsidePage) break;

      // We examined the entire page; next scan begins after the page.
      scanOffset += candidates.length;

      // If we got a short page, we’re at the end.
      if (candidates.length < PAGE) {
        nextOffset = null;
        break;
      }
    }

    // 2) Process the batch (per-manga safe)
    step = "process_rows_loop";
    let processed = 0;

    const updated: Array<{
      manga_id: string;
      external_id: string;
      total_chapters: number;
      total_volumes: number;
    }> = [];

    const errors: Array<{ manga_id: string; external_id: string; error: string }> = [];

    for (const r of rows) {
      const mangaId = String((r as any).manga_id);
      const mdId = String((r as any).external_id || "").trim();
      if (!mangaId || mangaId === "null" || !mdId) continue;

      try {
        let url = new URL(`${BASE}/manga/${mdId}/aggregate`);

        let aggRes = await fetchWithRetry(
          url.toString(),
          { headers: { "User-Agent": "your-app-mangadex-volume-map" } },
          { retries: 4, timeoutMs: 20_000, backoffMs: 750 }
        );

        if (!aggRes.ok) {
          const retryUrl = new URL(`${BASE}/manga/${mdId}/aggregate`);
          retryUrl.searchParams.append("translatedLanguage[]", "en");

          aggRes = await fetchWithRetry(
            retryUrl.toString(),
            { headers: { "User-Agent": "your-app-mangadex-volume-map" } },
            { retries: 4, timeoutMs: 20_000, backoffMs: 750 }
          );
        }

        if (!aggRes.ok) {
          const txt = await aggRes.text().catch(() => "");
          throw new Error(`aggregate failed (${aggRes.status}): ${txt.slice(0, 200)}`);
        }

        const json = (await aggRes.json()) as MdAggregateResponse;
        const volumesObj = json.volumes || {};
        const volumeKeys = Object.keys(volumesObj);

        const mapping: Record<string, string[]> = {};
        const totalChaptersSet = new Set<string>();

        for (const volKey of volumeKeys) {
          const vol = volumesObj[volKey];
          const vKey = normalizeVolKey(vol?.volume ?? volKey);

          const chaptersObj = vol?.chapters || {};
          const chapterKeys = Object.keys(chaptersObj)
            .map((k) => String(k).trim())
            .filter(Boolean);

          if (chapterKeys.length === 0) continue;

          const sorted = sortChapterKeys(chapterKeys);
          mapping[vKey] = sorted;

          for (const ck of sorted) totalChaptersSet.add(`${vKey}::${ck}`);
        }

        const volNames = Object.keys(mapping);
        const totalVolumes = volNames.filter((v) => v.toLowerCase() !== "none").length;
        const totalChapters = totalChaptersSet.size;

        const { error: upErr } = await supabaseAdmin
          .from("manga_volume_chapter_map")
          .upsert(
            {
              manga_id: mangaId,
              source: "mangadex",
              mapping,
              total_volumes: totalVolumes,
              total_chapters: totalChapters,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "manga_id" }
          );

        if (upErr) throw new Error(`upsert_map: ${JSON.stringify(serializeErr(upErr))}`);

        const { error: mangaUpdErr } = await supabaseAdmin
          .from("manga")
          .update({ total_volumes: totalVolumes, total_chapters: totalChapters })
          .eq("id", mangaId);

        if (mangaUpdErr) throw new Error(`update_manga_totals: ${JSON.stringify(serializeErr(mangaUpdErr))}`);

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

    // 3) Progress after (so your runner prints real numbers)
    step = "count_totalMapped_after";
    const { count: totalMappedAfter, error: totalMappedAfterErr } = await supabaseAdmin
      .from("manga_volume_chapter_map")
      .select("manga_id", { count: "exact", head: true });

    if (totalMappedAfterErr) throwStep(step, totalMappedAfterErr);

    const mappedAfter = totalMappedAfter ?? mappedBefore;
    const remainingAfter = Math.max(0, eligible - mappedAfter);

    return res.status(200).json({
      ok: true,

      offset,
      nextOffset,
      scanned,

      totalEligible: eligible,
      totalMapped: mappedAfter,
      remaining: remainingAfter,
      percentComplete: eligible > 0 ? Math.round((mappedAfter / eligible) * 1000) / 10 : 0,

      picked: rows.length,
      processed,
      updatedCount: updated.length,
      errorCount: errors.length,

      updated: updated.slice(0, 10),
      errors: errors.slice(0, 10),
    });
  } catch (e: any) {
    return res.status(500).json({
      error: String(e?.message || e),
      step,
    });
  }
}
