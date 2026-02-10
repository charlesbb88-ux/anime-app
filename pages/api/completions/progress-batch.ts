// pages/api/completions/progress-batch.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type ReqBody = {
    userId: string;
    items: { id: string; kind: "anime" | "manga" }[];
};

type ProgressRow = { current: number; total: number; pct: number | null };

type Ok = {
    byKey: Record<string, ProgressRow>;
};

type Err = { error: string; debug?: any };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
if (!serviceRoleKey) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
});

function isUuid(v: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

async function countDistinctIds(params: {
    table: string;
    idColumn: string;
    filters: Record<string, string>;
}) {
    const q = supabase.from(params.table).select(params.idColumn);

    for (const [k, v] of Object.entries(params.filters)) {
        q.eq(k, v);
    }

    const { data, error, status } = await q;

    if (error) return { ok: false as const, error, status, count: 0 };

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

    if (error) return { ok: false as const, error, status, count: 0 };

    return { ok: true as const, count: count ?? 0 };
}

function pctFrom(current: number, total: number) {
    if (!Number.isFinite(total) || total <= 0) return null;
    const raw = (current / total) * 100;
    const clamped = Math.max(0, Math.min(100, Math.floor(raw)));
    return clamped;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Ok | Err>) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Method not allowed" });
    }

    const body = req.body as ReqBody | undefined;
    const userId = body?.userId ?? "";
    const items = body?.items ?? [];

    if (!userId || !Array.isArray(items)) {
        return res.status(400).json({
            error: "Missing/invalid body",
            debug: { expected: "{ userId, items: [{id, kind}] }", got: req.body },
        });
    }

    if (!isUuid(userId)) {
        return res.status(400).json({ error: "userId must be UUID", debug: { userId } });
    }

    // Validate items
    const clean = items
        .filter((it) => it && typeof it.id === "string" && (it.kind === "anime" || it.kind === "manga"))
        .filter((it) => isUuid(it.id));

    try {
        const byKey: Record<string, ProgressRow> = {};

        // Compute in parallel, but keep it simple for now.
        await Promise.all(
            clean.map(async (it) => {
                const key = `${it.kind}:${it.id}`;

                if (it.kind === "anime") {
                    const logged = await countDistinctIds({
                        table: "anime_episode_logs",
                        idColumn: "anime_episode_id",
                        filters: { user_id: userId, anime_id: it.id },
                    });

                    if (!logged.ok) return;

                    const total = await countTotal({
                        table: "anime_episodes",
                        filters: { anime_id: it.id },
                    });

                    if (!total.ok) return;

                    const currentRaw = logged.count;
                    const totalRaw = total.count;

                    // If there are no episodes in the database for this anime,
                    // but it appears in "completions" (meaning there IS a series log),
                    // treat it as 1/1 (100%).
                    const adjustedCurrent = totalRaw === 0 ? 1 : currentRaw;
                    const adjustedTotal = totalRaw === 0 ? 1 : totalRaw;

                    byKey[key] = {
                        current: adjustedCurrent,
                        total: adjustedTotal,
                        pct: pctFrom(adjustedCurrent, adjustedTotal),
                    };
                    return;
                }

                // manga
                const logged = await countDistinctIds({
                    table: "manga_chapter_logs",
                    idColumn: "manga_chapter_id",
                    filters: { user_id: userId, manga_id: it.id },
                });

                if (!logged.ok) return;

                const total = await countTotal({
                    table: "manga_chapters",
                    filters: { manga_id: it.id },
                });

                if (!total.ok) return;

                const currentRaw = logged.count;
                const totalRaw = total.count;

                // If there are no chapters in the database for this manga,
                // but it appears in "completions" (meaning there IS a series log),
                // treat it as 1/1 (100%).
                const adjustedCurrent = totalRaw === 0 ? 1 : currentRaw;
                const adjustedTotal = totalRaw === 0 ? 1 : totalRaw;

                byKey[key] = {
                    current: adjustedCurrent,
                    total: adjustedTotal,
                    pct: pctFrom(adjustedCurrent, adjustedTotal),
                };
            })
        );

        return res.status(200).json({ byKey });
    } catch (e: any) {
        return res.status(500).json({
            error: "Failed to compute progress batch",
            debug: { message: e?.message, name: e?.name },
        });
    }
}
