import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminGuard";
import { importMangaTagsFromAniList } from "@/lib/importMangaTagsFromAnilist";

type FailureRow = {
  mangaId: string;
  anilistId: number | null;
  error: string;
};

function parseLimit(value: unknown) {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : NaN;

  if (!Number.isFinite(n)) return 100;
  return Math.max(1, Math.min(Math.floor(n), 500));
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!requireAdmin(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  const limit = parseLimit(req.body?.limit);

  try {
    const { data: mangaList, error: mangaListError } = await supabaseAdmin
      .from("manga")
      .select("id, anilist_id")
      .not("anilist_id", "is", null)
      .is("anilist_tags_imported_at", null)
      .is("anilist_tags_import_error", null)
      .order("id", { ascending: true })
      .limit(limit);

    if (mangaListError) {
      throw new Error(mangaListError.message);
    }

    let success = 0;
    let failed = 0;
    const failures: FailureRow[] = [];

    for (const row of mangaList ?? []) {
      const mangaId = typeof row.id === "string" ? row.id : "";
      const anilistId =
        typeof row.anilist_id === "number"
          ? row.anilist_id
          : typeof row.anilist_id === "string"
          ? Number(row.anilist_id)
          : NaN;

      if (!mangaId || !Number.isFinite(anilistId) || anilistId <= 0) {
        const message = "Invalid manga id or anilist id";

        if (mangaId) {
          const { error: updateInvalidError } = await supabaseAdmin
            .from("manga")
            .update({
              anilist_tags_import_error: message,
            })
            .eq("id", mangaId);

if (updateInvalidError) {
  throw new Error(
    `Failed to save invalid-id error for mangaId=${mangaId}: ${updateInvalidError.message}`
  );
}
        }

        failed++;
        failures.push({
          mangaId,
          anilistId: Number.isFinite(anilistId) ? anilistId : null,
          error: message,
        });
        continue;
      }

      try {
        await importMangaTagsFromAniList(mangaId, anilistId);

        const { error: markDoneError } = await supabaseAdmin
          .from("manga")
          .update({
            anilist_tags_imported_at: new Date().toISOString(),
            anilist_tags_import_error: null,
          })
          .eq("id", mangaId);

if (markDoneError) {
  throw new Error(
    `Failed to mark import done for mangaId=${mangaId}: ${markDoneError.message}`
  );
}

        success++;
      } catch (err: any) {
        const message =
          err instanceof Error
            ? err.message || err.name || "Unknown row error"
            : typeof err === "string" && err.trim() !== ""
            ? err
            : JSON.stringify(err) || "Unknown row error";

        const { error: markFailedError } = await supabaseAdmin
          .from("manga")
          .update({
            anilist_tags_import_error: message,
          })
          .eq("id", mangaId);

if (markFailedError) {
  throw new Error(
    `Failed to save import error for mangaId=${mangaId}: ${markFailedError.message}`
  );
}

        failed++;
        failures.push({
          mangaId,
          anilistId,
          error: message,
        });
      }
    }

    const { count: totalEligible, error: totalEligibleError } =
      await supabaseAdmin
        .from("manga")
        .select("id", { count: "exact", head: true })
        .not("anilist_id", "is", null);

    if (totalEligibleError) {
      throw new Error(totalEligibleError.message);
    }

    const { count: done, error: doneError } = await supabaseAdmin
      .from("manga")
      .select("id", { count: "exact", head: true })
      .not("anilist_id", "is", null)
      .not("anilist_tags_imported_at", "is", null);

    if (doneError) {
      throw new Error(doneError.message);
    }

    const { count: leftCount, error: leftError } = await supabaseAdmin
      .from("manga")
      .select("id", { count: "exact", head: true })
      .not("anilist_id", "is", null)
      .is("anilist_tags_imported_at", null)
      .is("anilist_tags_import_error", null);

    if (leftError) {
      throw new Error(leftError.message);
    }

    const { count: failedTotal, error: failedTotalError } = await supabaseAdmin
      .from("manga")
      .select("id", { count: "exact", head: true })
      .not("anilist_id", "is", null)
      .is("anilist_tags_imported_at", null)
      .not("anilist_tags_import_error", "is", null);

    if (failedTotalError) {
      throw new Error(failedTotalError.message);
    }

    const safeTotal =
      typeof totalEligible === "number" && Number.isFinite(totalEligible)
        ? totalEligible
        : 0;

    const safeDone =
      typeof done === "number" && Number.isFinite(done)
        ? done
        : 0;

    const safeLeft =
      typeof leftCount === "number" && Number.isFinite(leftCount)
        ? leftCount
        : Math.max(0, safeTotal - safeDone);

    const safeFailedTotal =
      typeof failedTotal === "number" && Number.isFinite(failedTotal)
        ? failedTotal
        : 0;

    return res.status(200).json({
      ok: true,
      limit,
      processed: (mangaList ?? []).length,
      success,
      failed,
      totalEligible: safeTotal,
      done: safeDone,
      left: safeLeft,
      failedTotal: safeFailedTotal,
      failures,
    });
  } catch (err: any) {
    const errorMessage =
      err instanceof Error
        ? err.message || err.name || "Unknown server error"
        : typeof err === "string" && err.trim() !== ""
        ? err
        : JSON.stringify(err) || "Unknown server error";

    console.error("batch-import-manga-tags fatal error:", err);

    return res.status(500).json({
      ok: false,
      error: errorMessage,
    });
  }
}