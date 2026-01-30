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

  // Simple rate-limit handling
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
    throw new Error(`AniList GraphQL errors: ${JSON.stringify(json.errors).slice(0, 400)}`);
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

async function computeProgress() {
  const { data, error } = await supabaseAdmin.rpc("anime_character_sync_progress");
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  const total = Number(row?.total ?? 0);
  const done = Number(row?.done ?? 0);
  const remaining = Math.max(0, total - done);
  const pct = total > 0 ? Math.round((done / total) * 1000) / 10 : 0;
  return { total, done, remaining, pct };
}

async function fetchAllCharactersEdges(anilistMediaId: number) {
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
    }>(QUERY, { id: anilistMediaId, page });

    mediaTitle = data.Media.title;
    edges.push(...(data.Media.characters.edges || []));

    if (!data.Media.characters.pageInfo.hasNextPage) break;
    page += 1;
  }

  return { edges, mediaTitle };
}

async function syncAnimeCharacters(animeId: string, anilistId: number) {
  // Pull all character edges from AniList (paged)
  const { edges, mediaTitle } = await fetchAllCharactersEdges(anilistId);

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

  // Upsert characters
  if (characterRows.length > 0) {
    const { error: upsertCharsErr } = await supabaseAdmin
      .from("characters")
      .upsert(characterRows, { onConflict: "anilist_id" });
    if (upsertCharsErr) throw upsertCharsErr;
  }

  // Map anilist_id -> character uuid
  const anilistIds = Array.from(byId.keys());
  let idMap = new Map<number, string>();

  if (anilistIds.length > 0) {
    const { data: chars, error: fetchCharsErr } = await supabaseAdmin
      .from("characters")
      .select("id, anilist_id")
      .in("anilist_id", anilistIds);

    if (fetchCharsErr) throw fetchCharsErr;

    for (const c of chars || []) idMap.set(c.anilist_id, c.id);
  }

  // Upsert join rows
  const joinRows = edges
    .map((e, idx) => {
      const character_uuid = idMap.get(e.node.id);
      if (!character_uuid) return null;
      return {
        anime_id: animeId,
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

  if (joinRows.length > 0) {
    const { error: upsertJoinErr } = await supabaseAdmin
      .from("anime_characters")
      .upsert(joinRows, { onConflict: "anime_id,character_id" });
    if (upsertJoinErr) throw upsertJoinErr;
  }

  // ✅ Mark synced EVEN if joins are 0 (this is the key fix)
  const { error: markErr } = await supabaseAdmin
    .from("anime")
    .update({
      characters_synced_at: new Date().toISOString(),
      characters_sync_status: "ok",
      characters_sync_error: null,
      characters_sync_chars: characterRows.length,
      characters_sync_joins: joinRows.length,
    })
    .eq("id", animeId);

  if (markErr) throw markErr;

  return {
    anilistId,
    mediaTitle,
    counts: { characters: characterRows.length, joins: joinRows.length },
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    requireAdmin(req);

    const limitRaw = Number(req.query.limit ?? 25);
    const limit = Math.max(1, Math.min(100, Number.isFinite(limitRaw) ? limitRaw : 25));

    const progressBefore = await computeProgress();

    // Get next batch of UNSYNCED anime
    const { data: batch, error: batchErr } = await supabaseAdmin.rpc(
      "next_anime_missing_character_sync",
      { p_limit: limit }
    );

    if (batchErr) throw batchErr;

    const items = (batch ?? []) as Array<{ anime_id: string; anilist_id: number }>;

    let succeeded = 0;
    let failed = 0;
    let importedChars = 0;
    let importedJoins = 0;

    const failures: Array<{ anime_id: string; anilist_id: number; error: string }> = [];

    for (const it of items) {
      try {
        const out = await syncAnimeCharacters(it.anime_id, Number(it.anilist_id));
        succeeded += 1;
        importedChars += out.counts.characters;
        importedJoins += out.counts.joins;

        // small throttle
        await sleep(150);
      } catch (e: any) {
        failed += 1;
        failures.push({
          anime_id: it.anime_id,
          anilist_id: Number(it.anilist_id),
          error: e?.message ?? String(e),
        });

        // Record error, but DON'T mark synced (so it can retry later)
        await supabaseAdmin
          .from("anime")
          .update({
            characters_sync_status: "error",
            characters_sync_error: (e?.message ?? String(e)).slice(0, 500),
          })
          .eq("id", it.anime_id);

        // backoff
        await sleep(800);
      }
    }

    const progressAfter = await computeProgress();

    return res.status(200).json({
      ok: true,
      batchSize: items.length,
      totals: {
        succeeded,
        failed,
        importedCharacters: importedChars,
        importedJoins: importedJoins,
      },
      progress: {
        total: progressAfter.total,
        done: progressAfter.done,
        remaining: progressAfter.remaining,
        pct: progressAfter.pct,
        before: progressBefore,
      },
      failures: failures.slice(0, 25),
      next: {
        hasRemaining: progressAfter.remaining > 0,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? String(err) });
  }
}
