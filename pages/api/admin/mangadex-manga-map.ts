import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function safeStr(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

type MapOut = Record<string, { manga_id: string; slug: string | null }>;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "POST only" });
    }

    // DEBUG MODE: NO AUTH

    const idsRaw: unknown[] = Array.isArray((req.body as any)?.ids) ? ((req.body as any).ids as unknown[]) : [];
    const ids: string[] = idsRaw
      .map(safeStr)
      .filter((x): x is string => typeof x === "string" && x.length > 0);

    if (ids.length === 0) {
      return res.status(200).json({ ok: true, received: 0, matched: 0, map: {} satisfies MapOut });
    }

    const supabaseAdmin = getAdminSupabase();

    // 1) external_id (mangadex manga id) -> manga_id
    const { data: extRows, error: extErr } = await supabaseAdmin
      .from("manga_external_ids")
      .select("external_id,manga_id")
      .eq("source", "mangadex")
      .in("external_id", ids);

    if (extErr) throw extErr;

    const extToMangaId = new Map<string, string>();
    const mangaIds: string[] = [];

    for (const row of (extRows as any[]) || []) {
      const ext = safeStr(row?.external_id);
      const mid = safeStr(row?.manga_id);
      if (!ext || !mid) continue;
      extToMangaId.set(ext, mid);
      mangaIds.push(mid);
    }

    const uniqMangaIds = Array.from(new Set(mangaIds));

    // 2) manga_id -> slug
    const idToSlug = new Map<string, string>();
    if (uniqMangaIds.length > 0) {
      const { data: mangaRows, error: mangaErr } = await supabaseAdmin
        .from("manga")
        .select("id,slug")
        .in("id", uniqMangaIds);

      if (mangaErr) throw mangaErr;

      for (const row of (mangaRows as any[]) || []) {
        const id = safeStr(row?.id);
        const slug = safeStr(row?.slug);
        if (id && slug) idToSlug.set(id, slug);
      }
    }

    // 3) Build response keyed by external_id (md manga id)
    const out: MapOut = {};
    for (const [ext, mid] of extToMangaId.entries()) {
      out[ext] = { manga_id: mid, slug: idToSlug.get(mid) || null };
    }

    return res.status(200).json({
      ok: true,
      received: ids.length,
      matched: Object.keys(out).length,
      map: out,
    });
  } catch (e: any) {
    console.error("mangadex-manga-map error:", e);
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
