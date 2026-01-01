// pages/api/admin/summaries/list.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function asString(v: any) {
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] : "";
}

function asInt(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

type SummaryRow = {
  id: string;
  chapter_id: string;
  user_id: string;
  content: string;
  contains_spoilers: boolean;
  upvotes: number;
  created_at: string;
  updated_at: string | null;
  status: string | null;
  hidden_at: string | null;
  hidden_reason: string | null;

  // ✅ new
  reviewed_at: string | null;
};

type ChapterRow = {
  id: string;
  manga_id: string;
  chapter_number: number;
};

type MangaRow = {
  id: string;
  slug: string;
  title: string;
  title_english?: string | null;
  title_preferred?: string | null;
  title_native?: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const key = asString(req.query.key).trim();
    const envKey = (process.env.ADMIN_DASH_KEY ?? "").trim();

    if (!envKey || key !== envKey) {
      return res.status(401).json({
        error: "Unauthorized",
        debug: {
          hasEnvKey: Boolean(envKey),
          keyLen: key.length,
          envLen: envKey.length,
        },
      });
    }

    const status = asString(req.query.status); // "all" | "active" | "hidden" ...
    const chapterId = asString(req.query.chapterId);
    const q = asString(req.query.q);
    const reviewed = asString(req.query.reviewed) || "all"; // ✅ "all" | "seen" | "unseen"

    const page = Math.max(1, asInt(req.query.page, 1));
    const pageSize = Math.min(50, Math.max(1, asInt(req.query.pageSize, 20)));

    // 1) fetch summaries
    let query = supabaseAdmin
      .from("manga_chapter_summaries")
      .select(
        "id, chapter_id, user_id, content, contains_spoilers, upvotes, created_at, updated_at, status, hidden_at, hidden_reason, reviewed_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (status && status !== "all") query = query.eq("status", status);
    if (chapterId) query = query.eq("chapter_id", chapterId);
    if (q) query = query.ilike("content", `%${q}%`);

    // ✅ reviewed filter
    if (reviewed === "unseen") query = query.is("reviewed_at", null);
    if (reviewed === "seen") query = query.not("reviewed_at", "is", null);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: rows, error, count } = await query.range(from, to);

    if (error) {
      return res.status(500).json({ error: error.message ?? "Failed to list summaries" });
    }

    const summaries = (rows ?? []) as SummaryRow[];

    // 2) fetch chapter info for all chapter_ids in this page
    const chapterIds = Array.from(new Set(summaries.map((s) => s.chapter_id).filter(Boolean)));

    let chapterMap = new Map<string, ChapterRow>();
    let mangaMap = new Map<string, MangaRow>();

    if (chapterIds.length > 0) {
      const { data: chapters, error: chapErr } = await supabaseAdmin
        .from("manga_chapters")
        .select("id, manga_id, chapter_number")
        .in("id", chapterIds);

      if (!chapErr && chapters) {
        (chapters as ChapterRow[]).forEach((c) => chapterMap.set(c.id, c));
      }

      const mangaIds = Array.from(
        new Set((chapters as ChapterRow[] | null)?.map((c) => c.manga_id).filter(Boolean) ?? [])
      );

      if (mangaIds.length > 0) {
        const { data: mangaRows, error: mangaErr } = await supabaseAdmin
          .from("manga")
          .select("id, slug, title, title_english, title_preferred, title_native")
          .in("id", mangaIds);

        if (!mangaErr && mangaRows) {
          (mangaRows as MangaRow[]).forEach((m) => mangaMap.set(m.id, m));
        }
      }
    }

    // 3) merge
    const enriched = summaries.map((s) => {
      const ch = chapterMap.get(s.chapter_id);
      const m = ch ? mangaMap.get(ch.manga_id) : undefined;

      const mangaTitle =
        (m?.title_english && m.title_english.trim()) ||
        (m?.title_preferred && m.title_preferred.trim()) ||
        (m?.title && m.title.trim()) ||
        (m?.title_native && m.title_native.trim()) ||
        null;

      return {
        ...s,
        chapter_number: ch?.chapter_number ?? null,
        manga_id: ch?.manga_id ?? null,
        manga_slug: m?.slug ?? null,
        manga_title: mangaTitle,
      };
    });

    const total = count ?? enriched.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return res.status(200).json({
      items: enriched,
      page,
      pageSize,
      total,
      totalPages,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "Server error" });
  }
}
