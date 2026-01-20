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

/**
 * fetch() wrapper:
 * - short retry loop for transient network issues (timeouts, Cloudflare hiccups)
 * - exponential backoff
 * - DOES NOT throw away your batch; per-manga try/catch handles failures
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts?: {
    retries?: number;
    backoffMs?: number;
    timeoutMs?: number;
  }
) {
  const retries = opts?.retries ?? 4; // total attempts = retries+1
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

      // Backoff: 0.75s, 1.5s, 3s, 6s, 8s cap
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
  const msg = `${step}: ${JSON.stringify(payload)}`;
  throw new Error(msg);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let step = "start";

  try {
    step = "auth";
    requireAdmin(req);

    step = "parse_query";
    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 25)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    // How many candidate rows to scan per request (independent from limit)
    // Keep this at 2000 unless you have CPU issues.
    const overfetch = 2000;

    // IN() chunk size for looking up existing maps (prevents PostgREST "Bad Request")
    const IN_CHUNK = 200;

    // Progress metrics (no schema changes):
    // totalEligible = mangadex manga you have in manga_external_ids
    // totalMapped   = rows present in manga_volume_chapter_map
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
    const mapped = totalMapped ?? 0;
    const remaining = Math.max(0, eligible - mapped);

    // 1) Pull candidates from manga_external_ids (no joins)
    step = "select_candidates_range";
    const { data: candidates, error: candErr } = await supabaseAdmin
      .from("manga_external_ids")
      .select("manga_id, external_id")
      .eq("source", "mangadex")
      .order("manga_id", { ascending: true })
      .range(offset, offset + overfetch - 1);

    if (candErr) throwStep(step, candErr);

    const candidateIds = (candidates || []).map((c: any) => c.manga_id).filter(Boolean);

    // Move the scan window forward regardless of whether we processed anything
    const nextOffset = candidates && candidates.length > 0 ? offset + candidates.length : null;

    // 2) Find which candidates already have a map row (chunked IN())
    step = "select_existing_maps_in";
    const existingSet = new Set<string>();

    if (candidateIds.length > 0) {
      for (let i = 0; i < candidateIds.length; i += IN_CHUNK) {
        const chunkIds = candidateIds
          .slice(i, i + IN_CHUNK)
          .map((x: any) => String(x))
          .filter(Boolean);

        if (chunkIds.length === 0) continue;

        const { data: existingChunk, error: existErr } = await supabaseAdmin
          .from("manga_volume_chapter_map")
          .select("manga_id")
          .in("manga_id", chunkIds);

        if (existErr) {
          throwStep(`${step} chunk ${i}-${Math.min(i + IN_CHUNK - 1, candidateIds.length - 1)}`, existErr);
        }

        for (const row of existingChunk || []) {
          existingSet.add(String((row as any).manga_id));
        }
      }
    }

    // 3) Only unmapped, then take up to limit
    step = "filter_rows_to_process";
    const rows = (candidates || [])
      .filter((c: any) => !existingSet.has(String(c.manga_id)))
      .slice(0, limit);

    let processed = 0;
    const updated: Array<{
      manga_id: string;
      external_id: string;
      total_chapters: number;
      total_volumes: number;
    }> = [];
    const errors: Array<{ manga_id: string; external_id: string; error: string }> = [];

    step = "process_rows_loop";
    for (const r of rows || []) {
      const mangaId = String(r.manga_id);
      const mdId = String(r.external_id || "").trim();
      if (!mdId) continue;

      // IMPORTANT: Everything inside here must be per-manga safe.
      // We NEVER throw out of the whole request due to MangaDex flakiness.
      try {
        // Aggregate (try without language first)
        let url = new URL(`${BASE}/manga/${mdId}/aggregate`);

        let aggRes = await fetchWithRetry(
          url.toString(),
          { headers: { "User-Agent": "your-app-mangadex-volume-map" } },
          { retries: 4, timeoutMs: 20_000, backoffMs: 750 }
        );

        // Retry with EN if first attempt returns non-OK response (not network failure)
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

        // Upsert the map (per-manga failure should NOT kill whole batch)
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

        if (upErr) {
          // include which part failed, but keep batch alive
          throw new Error(`upsert_map: ${JSON.stringify(serializeErr(upErr))}`);
        }

        // Update totals in manga table (optional, but you’re using it)
        const { error: mangaUpdErr } = await supabaseAdmin
          .from("manga")
          .update({ total_volumes: totalVolumes, total_chapters: totalChapters })
          .eq("id", mangaId);

        if (mangaUpdErr) {
          throw new Error(`update_manga_totals: ${JSON.stringify(serializeErr(mangaUpdErr))}`);
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

      // Scan info
      offset,
      nextOffset,

      // Progress
      totalEligible: eligible,
      totalMapped: mapped,
      remaining,
      percentComplete: eligible > 0 ? Math.round((mapped / eligible) * 1000) / 10 : 0,

      // Batch stats
      picked: rows.length,
      processed,
      updatedCount: updated.length,
      errorCount: errors.length,

      // Preview
      updated: updated.slice(0, 10),
      errors: errors.slice(0, 10),
    });
  } catch (e: any) {
    // Only fatal errors should land here (auth, Supabase picker queries, etc.)
    return res.status(500).json({
      error: String(e?.message || e),
      step,
    });
  }
}
