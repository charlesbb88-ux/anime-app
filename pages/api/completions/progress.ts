import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type Ok = { current: number; total: number };
type Err = { error: string; debug?: any };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
if (!serviceRoleKey) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

function isUuid(v: string) {
  // accepts UUID v1-v5 variants
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

async function countDistinctIds(params: {
  table: string;
  idColumn: string;
  filters: Record<string, string>;
}) {
  // Try fast path: fetch only the ID column (small) and dedupe.
  // (Using head:true doesn't help for distinct, so we do minimal-select + dedupe.)
  const q = supabase.from(params.table).select(params.idColumn);

  for (const [k, v] of Object.entries(params.filters)) {
    q.eq(k, v);
  }

  const { data, error, status } = await q;

  if (error) {
    return { ok: false as const, error, status, count: 0 };
  }

  const set = new Set<string>();
  for (const row of data ?? []) {
    const val = (row as any)?.[params.idColumn];
    if (typeof val === "string") set.add(val);
  }

  return { ok: true as const, count: set.size };
}

async function countTotal(params: { table: string; filters: Record<string, string> }) {
  let q = supabase.from(params.table).select("id", { count: "exact", head: true });

  for (const [k, v] of Object.entries(params.filters)) {
    q = q.eq(k, v);
  }

  const { count, error, status } = await q;

  if (error) {
    return { ok: false as const, error, status, count: 0 };
  }

  return { ok: true as const, count: count ?? 0 };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Ok | Err>) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = typeof req.query.userId === "string" ? req.query.userId : "";
  const id = typeof req.query.id === "string" ? req.query.id : "";
  const kind = typeof req.query.kind === "string" ? req.query.kind : "";

  if (!userId || !id || (kind !== "anime" && kind !== "manga")) {
    return res.status(400).json({
      error: "Missing/invalid query params",
      debug: { expected: "?userId=...&id=...&kind=anime|manga", got: req.query },
    });
  }

  // This is why your placeholder test fails:
  if (!isUuid(userId) || !isUuid(id)) {
    return res.status(400).json({
      error: "userId/id must be UUIDs",
      debug: { userId, id, kind },
    });
  }

  try {
    if (kind === "anime") {
      const logged = await countDistinctIds({
        table: "anime_episode_logs",
        idColumn: "anime_episode_id",
        filters: { user_id: userId, anime_id: id },
      });

      if (!logged.ok) {
        return res.status(500).json({
          error: "Failed query: anime_episode_logs",
          debug: { status: logged.status, message: logged.error?.message, error: logged.error },
        });
      }

      const total = await countTotal({
        table: "anime_episodes",
        filters: { anime_id: id },
      });

      if (!total.ok) {
        return res.status(500).json({
          error: "Failed query: anime_episodes",
          debug: { status: total.status, message: total.error?.message, error: total.error },
        });
      }

      const currentRaw = logged.count;
      const totalRaw = total.count;

      const adjustedCurrent = totalRaw === 0 ? 1 : currentRaw;
      const adjustedTotal = totalRaw === 0 ? 1 : totalRaw;

      return res.status(200).json({ current: adjustedCurrent, total: adjustedTotal });
    }

    // manga
    const logged = await countDistinctIds({
      table: "manga_chapter_logs",
      idColumn: "manga_chapter_id",
      filters: { user_id: userId, manga_id: id },
    });

    if (!logged.ok) {
      return res.status(500).json({
        error: "Failed query: manga_chapter_logs",
        debug: { status: logged.status, message: logged.error?.message, error: logged.error },
      });
    }

    const total = await countTotal({
      table: "manga_chapters",
      filters: { manga_id: id },
    });

    if (!total.ok) {
      return res.status(500).json({
        error: "Failed query: manga_chapters",
        debug: { status: total.status, message: total.error?.message, error: total.error },
      });
    }

    const currentRaw = logged.count;
    const totalRaw = total.count;

    const adjustedCurrent = totalRaw === 0 ? 1 : currentRaw;
    const adjustedTotal = totalRaw === 0 ? 1 : totalRaw;

    return res.status(200).json({ current: adjustedCurrent, total: adjustedTotal });
  } catch (e: any) {
    return res.status(500).json({
      error: "Failed to compute progress (unexpected throw)",
      debug: { message: e?.message, name: e?.name },
    });
  }
}
