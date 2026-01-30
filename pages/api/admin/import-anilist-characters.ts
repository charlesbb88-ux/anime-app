import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function requireAdmin(req: NextApiRequest) {
  const secret = req.headers["x-admin-secret"];
  if (!process.env.ADMIN_SECRET) throw new Error("ADMIN_SECRET not set");
  if (secret !== process.env.ADMIN_SECRET) throw new Error("Unauthorized");
}

const ANILIST_URL = "https://graphql.anilist.co";

const QUERY = `
query ($id: Int!, $page: Int!) {
  Media(id: $id, type: ANIME) {
    id
    title { romaji english native }
    characters(page: $page, perPage: 50, sort: [ROLE, RELEVANCE, ID]) {
      pageInfo { currentPage hasNextPage }
      edges {
        role
        node {
          id
          name { full native }
          image { large medium }
          description(asHtml: false)
          siteUrl
          favourites
        }
      }
    }
  }
}
`;

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function anilistFetch<T>(query: string, variables: any): Promise<T> {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  // Basic rate-limit handling
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after") ?? "2");
    await sleep(Math.max(1, retryAfter) * 1000);
    return anilistFetch<T>(query, variables);
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`AniList error (${res.status}): ${txt.slice(0, 400)}`);
  }

  const json = await res.json();
  if (json?.errors?.length) {
    throw new Error(
      `AniList GraphQL errors: ${JSON.stringify(json.errors).slice(0, 400)}`
    );
  }
  return json.data as T;
}

type AniEdge = {
  role: string | null;
  node: {
    id: number;
    name?: { full?: string | null; native?: string | null } | null;
    image?: { large?: string | null; medium?: string | null } | null;
    description?: string | null;
    siteUrl?: string | null;
    favourites?: number | null;
  };
};

type AnimeRow = {
  id: string;
  anilist_id: number | null;
  title: string | null;
};

async function importCharactersForMedia(mediaId: number): Promise<{
  animeRow: AnimeRow;
  mediaTitle: { romaji: string | null; english: string | null; native: string | null } | null;
  imported: { characters: number; joins: number };
}> {
  // Map AniList media -> your anime row
  const { data: animeRow, error: animeErr } = await supabaseAdmin
    .from("anime")
    .select("id, anilist_id, title")
    .eq("anilist_id", mediaId)
    .maybeSingle();

  if (animeErr) throw animeErr;
  if (!animeRow) {
    throw new Error(`No anime row found where anime.anilist_id = ${mediaId}`);
  }

  // Pull all character pages
  let page = 1;
  const edges: AniEdge[] = [];
  let mediaTitle: any = null;

  while (true) {
    const data = await anilistFetch<{
      Media: {
        id: number;
        title: { romaji: string | null; english: string | null; native: string | null };
        characters: { pageInfo: { hasNextPage: boolean }; edges: AniEdge[] };
      };
    }>(QUERY, { id: mediaId, page });

    mediaTitle = data.Media.title;
    edges.push(...(data.Media.characters.edges || []));

    if (!data.Media.characters.pageInfo.hasNextPage) break;
    page += 1;
  }

  // Dedup characters by anilist_id
  const byId = new Map<number, AniEdge["node"]>();
  for (const e of edges) byId.set(e.node.id, e.node);

  const characterRows = Array.from(byId.entries()).map(([id, node]) => ({
    anilist_id: id,
    name_full: node.name?.full ?? null,
    name_native: node.name?.native ?? null,
    image_large: node.image?.large ?? null,
    image_medium: node.image?.medium ?? null,
    description: node.description ?? null,
    site_url: node.siteUrl ?? null,
    favourites: node.favourites ?? null,
  }));

  const { error: upsertCharsErr } = await supabaseAdmin
    .from("characters")
    .upsert(characterRows, { onConflict: "anilist_id" });

  if (upsertCharsErr) throw upsertCharsErr;

  // Fetch UUIDs for join rows
  const anilistIds = Array.from(byId.keys());
  const { data: chars, error: fetchCharsErr } = await supabaseAdmin
    .from("characters")
    .select("id, anilist_id")
    .in("anilist_id", anilistIds);

  if (fetchCharsErr) throw fetchCharsErr;

  const idMap = new Map<number, string>();
  for (const c of chars || []) idMap.set(c.anilist_id, c.id);

  // Upsert join rows (idempotent)
  const joinRows = edges
    .map((e, idx) => {
      const character_uuid = idMap.get(e.node.id);
      if (!character_uuid) return null;
      return {
        anime_id: animeRow.id,
        character_id: character_uuid,
        role: e.role ?? null,
        order_index: idx,
      };
    })
    .filter(Boolean) as Array<{
    anime_id: string;
    character_id: string;
    role: string | null;
    order_index: number;
  }>;

  const { error: upsertJoinErr } = await supabaseAdmin
    .from("anime_characters")
    .upsert(joinRows, { onConflict: "anime_id,character_id" });

  if (upsertJoinErr) throw upsertJoinErr;

  return {
    animeRow,
    mediaTitle,
    imported: { characters: characterRows.length, joins: joinRows.length },
  };
}

function toBool(v: any) {
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v ?? "").toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y";
}

async function computeProgress() {
  // total anime rows with anilist_id
  const { count: totalAnimeWithAnilist, error: totalErr } = await supabaseAdmin
    .from("anime")
    .select("id", { count: "exact", head: true })
    .not("anilist_id", "is", null);

  if (totalErr) throw totalErr;

  // anime ids that have at least 1 join
  // (note: count exact on anime_characters counts join rows, not distinct anime_id, so we fetch distinct via a lightweight select)
  // We'll do a two-step: get distinct anime_id from anime_characters, then count those that are in anime with anilist_id.
  const { data: joinedAnimeIds, error: joinErr } = await supabaseAdmin
    .from("anime_characters")
    .select("anime_id");

  if (joinErr) throw joinErr;

  const distinct = new Set<string>((joinedAnimeIds ?? []).map((r: any) => r.anime_id));
  const alreadyDone = distinct.size;

  const total = totalAnimeWithAnilist ?? 0;
  const done = Math.min(alreadyDone, total);
  const remaining = Math.max(0, total - done);

  const pct = total > 0 ? Math.round((done / total) * 1000) / 10 : 0;

  return { total, done, remaining, pct };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    requireAdmin(req);

    const allMode =
      toBool(req.query.all) || req.query.mode === "all" || toBool(req.query.bulk);

    // -----------------------------
    // SINGLE MODE: ?media_id=123
    // -----------------------------
    if (!allMode) {
      const mediaIdRaw = (req.query.media_id ?? req.query.id) as string | undefined;
      const mediaId = Number(mediaIdRaw);
      if (!mediaId || Number.isNaN(mediaId)) {
        return res.status(400).json({
          error: "Provide ?media_id=ANILIST_MEDIA_ID or use bulk ?all=1",
        });
      }

      const out = await importCharactersForMedia(mediaId);

      return res.status(200).json({
        ok: true,
        mode: "single",
        anime: {
          id: out.animeRow.id,
          anilist_id: out.animeRow.anilist_id,
          title: out.animeRow.title,
        },
        anilist: { mediaId, title: out.mediaTitle },
        imported: out.imported,
      });
    }

    // -----------------------------
    // BULK MODE
    // -----------------------------
    const limitRaw = Number(req.query.limit ?? 25);
    const limit = Math.max(1, Math.min(100, Number.isFinite(limitRaw) ? limitRaw : 25));

    // cursor is a scan offset through "anime ordered by anilist_id"
    const cursorRaw = Number(req.query.cursor ?? 0);
    let cursor = Math.max(0, Number.isFinite(cursorRaw) ? cursorRaw : 0);

    const loop = toBool(req.query.loop);
    const maxBatchesRaw = Number(req.query.max_batches ?? 20);
    const maxBatches = Math.max(1, Math.min(200, Number.isFinite(maxBatchesRaw) ? maxBatchesRaw : 20));

    // For filtering, over-fetch candidates so we can still fill `limit` after removing already-done anime
    const scanMultiplierRaw = Number(req.query.scan_multiplier ?? 5);
    const scanMultiplier = Math.max(2, Math.min(20, Number.isFinite(scanMultiplierRaw) ? scanMultiplierRaw : 5));
    const scanCount = limit * scanMultiplier;

    const startedAt = Date.now();

    const progressBefore = await computeProgress();

    const batchRuns: any[] = [];
    const sampleFailures: Array<{ mediaId: number | null; animeId: string | null; error: string }> = [];

    let totalSucceeded = 0;
    let totalFailed = 0;
    let totalImportedCharacters = 0;
    let totalImportedJoins = 0;

    for (let batchIndex = 0; batchIndex < (loop ? maxBatches : 1); batchIndex++) {
      // Pull candidate slice
      const { data: candidates, error: candErr } = await supabaseAdmin
        .from("anime")
        .select("id, anilist_id, title")
        .not("anilist_id", "is", null)
        .order("anilist_id", { ascending: true })
        .range(cursor, cursor + scanCount - 1);

      if (candErr) throw candErr;

      // No more candidates -> stop
      if (!candidates || candidates.length === 0) {
        batchRuns.push({
          batchIndex,
          cursorStart: cursor,
          cursorEnd: cursor,
          scanned: 0,
          selected: 0,
          succeeded: 0,
          failed: 0,
          note: "No more candidates in scan range.",
        });
        break;
      }

      const candidateAnimeIds = candidates.map((a) => a.id);

      // Determine which already have join rows
      let alreadyHasChars = new Set<string>();
      {
        const { data: existing, error: existErr } = await supabaseAdmin
          .from("anime_characters")
          .select("anime_id")
          .in("anime_id", candidateAnimeIds);

        if (existErr) throw existErr;

        alreadyHasChars = new Set((existing ?? []).map((r: any) => r.anime_id));
      }

      // Keep only those missing, take up to limit
      const rows = candidates.filter((a) => !alreadyHasChars.has(a.id)).slice(0, limit);

      let succeeded = 0;
      let failed = 0;

      for (const r of rows) {
        const mediaId = Number(r.anilist_id);
        if (!mediaId || Number.isNaN(mediaId)) {
          failed += 1;
          totalFailed += 1;
          if (sampleFailures.length < 25) {
            sampleFailures.push({
              mediaId: null,
              animeId: r.id ?? null,
              error: "Row has invalid anilist_id",
            });
          }
          continue;
        }

        try {
          const out = await importCharactersForMedia(mediaId);
          succeeded += 1;
          totalSucceeded += 1;
          totalImportedCharacters += out.imported.characters;
          totalImportedJoins += out.imported.joins;

          // small throttle
          await sleep(150);
        } catch (e: any) {
          failed += 1;
          totalFailed += 1;
          if (sampleFailures.length < 25) {
            sampleFailures.push({
              mediaId,
              animeId: r.id ?? null,
              error: e?.message ?? String(e),
            });
          }
          // backoff
          await sleep(600);
        }
      }

      const cursorStart = cursor;
      const cursorEnd = cursorStart + scanCount;
      cursor = cursorEnd;

      batchRuns.push({
        batchIndex,
        cursorStart,
        cursorEnd,
        scanned: candidates.length,
        selected: rows.length,
        succeeded,
        failed,
      });

      // If we selected nothing (meaning everything in scan had chars already),
      // keep looping to advance cursor (only if loop mode is on).
      if (!loop) break;

      // If we did select nothing and candidates was short, we likely reached end
      if (rows.length === 0 && candidates.length < scanCount) break;

      // If we selected less than limit AND candidates was short, end is near
      if (rows.length < limit && candidates.length < scanCount) break;
    }

    const progressAfter = await computeProgress();

    const elapsedMs = Date.now() - startedAt;

    return res.status(200).json({
      ok: true,
      mode: "bulk",
      params: {
        limit,
        cursor_start: Number(req.query.cursor ?? 0),
        cursor_end: cursor,
        loop,
        max_batches: loop ? maxBatches : 1,
        scan_multiplier: scanMultiplier,
      },
      progress: {
        totalAnimeWithAnilist: progressBefore.total,
        alreadyDone: progressBefore.done,
        remainingBefore: progressBefore.remaining,
        completedPctBefore: progressBefore.pct,

        alreadyDoneAfter: progressAfter.done,
        remainingAfter: progressAfter.remaining,
        completedPctAfter: progressAfter.pct,
      },
      totals: {
        batchesRun: batchRuns.length,
        succeeded: totalSucceeded,
        failed: totalFailed,
        importedCharacters: totalImportedCharacters,
        importedJoins: totalImportedJoins,
      },
      batches: batchRuns,
      sampleFailures,
      timing: { elapsedMs },
      next: {
        // if there is still remaining, you can call again with cursor_end
        nextCursor: cursor,
        hasRemaining: progressAfter.remaining > 0,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? String(err) });
  }
}
