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
  // Numeric chapters in numeric order, everything else after (stable)
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    requireAdmin(req);

    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 25)));

    // Pick manga that are sourced from mangadex AND missing a map row (or older than X days if you want later)
    // IMPORTANT: your mangadex id is in manga_external_ids (not manga.external_id)
    const { data: rows, error: pickErr } = await supabaseAdmin
      .from("manga_external_ids")
      .select("manga_id, external_id, manga!inner(id, source)")
      .eq("source", "mangadex")
      .eq("manga.source", "mangadex")
      .order("manga_id", { ascending: true })
      .limit(limit);

    if (pickErr) throw pickErr;

    let processed = 0;
    const updated: Array<{
      manga_id: string;
      external_id: string;
      total_chapters: number;
      total_volumes: number;
    }> = [];
    const errors: Array<{ manga_id: string; external_id: string; error: string }> = [];

    for (const r of rows || []) {
      const mangaId = String(r.manga_id);
      const mdId = String(r.external_id || "").trim();
      if (!mdId) continue;

      try {
        // Try aggregate without language filters first (best “overall” picture)
        let url = new URL(`${BASE}/manga/${mdId}/aggregate`);

        let aggRes = await fetch(url.toString(), {
          headers: { "User-Agent": "your-app-mangadex-volume-map" },
        });

        // Retry with EN if needed
        if (!aggRes.ok) {
          const retryUrl = new URL(`${BASE}/manga/${mdId}/aggregate`);
          retryUrl.searchParams.append("translatedLanguage[]", "en");
          aggRes = await fetch(retryUrl.toString(), {
            headers: { "User-Agent": "your-app-mangadex-volume-map" },
          });
        }

        if (!aggRes.ok) {
          const txt = await aggRes.text().catch(() => "");
          throw new Error(`aggregate failed (${aggRes.status}): ${txt.slice(0, 200)}`);
        }

        const json = (await aggRes.json()) as MdAggregateResponse;
        const volumesObj = json.volumes || {};
        const volumeKeys = Object.keys(volumesObj);

        // Build mapping: volume -> [chapter keys]
        const mapping: Record<string, string[]> = {};
        let totalChaptersSet = new Set<string>();

        for (const volKey of volumeKeys) {
          const vol = volumesObj[volKey];
          const vKey = normalizeVolKey(vol?.volume ?? volKey);

          const chaptersObj = vol?.chapters || {};
          const chapterKeys = Object.keys(chaptersObj).map((k) => String(k).trim()).filter(Boolean);

          if (chapterKeys.length === 0) continue;

          const sorted = sortChapterKeys(chapterKeys);
          mapping[vKey] = sorted;

          for (const ck of sorted) totalChaptersSet.add(`${vKey}::${ck}`);
        }

        // total volumes: count “real” volumes (exclude "none")
        const volNames = Object.keys(mapping);
        const totalVolumes = volNames.filter((v) => v.toLowerCase() !== "none").length;

        // total chapters overall:
        // - If you want “unique chapter number regardless of volume”, that’s different.
        // - This count is “chapter entries by volume” (what you asked: which chapters belong to which volumes).
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

        if (upErr) throw upErr;

        // Optional: also fill your manga table totals (since you want them)
        const { error: mangaUpdErr } = await supabaseAdmin
          .from("manga")
          .update({
            total_volumes: totalVolumes,
            total_chapters: totalChapters,
          })
          .eq("id", mangaId);

        if (mangaUpdErr) throw mangaUpdErr;

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
      picked: rows?.length || 0,
      processed,
      updatedCount: updated.length,
      errorCount: errors.length,
      updated: updated.slice(0, 10),
      errors: errors.slice(0, 10),
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
