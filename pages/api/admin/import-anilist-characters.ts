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

async function anilistFetch<T>(query: string, variables: any): Promise<T> {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    requireAdmin(req);

    const mediaIdRaw = (req.query.media_id ?? req.query.id) as string | undefined;
    const mediaId = Number(mediaIdRaw);
    if (!mediaId || Number.isNaN(mediaId)) {
      return res.status(400).json({ error: "Provide ?media_id=ANILIST_MEDIA_ID" });
    }

    // Map AniList media -> your anime row
    const { data: animeRow, error: animeErr } = await supabaseAdmin
      .from("anime")
      .select("id, anilist_id, title")
      .eq("anilist_id", mediaId)
      .maybeSingle();

    if (animeErr) throw animeErr;
    if (!animeRow) {
      return res.status(404).json({
        error: "No public.anime row found where anime.anilist_id = media_id",
        mediaId,
      });
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

    // Upsert characters (deduped by anilist_id)
    const characterRows = edges.map((e) => ({
      anilist_id: e.node.id,
      name_full: e.node.name?.full ?? null,
      name_native: e.node.name?.native ?? null,
      image_large: e.node.image?.large ?? null,
      image_medium: e.node.image?.medium ?? null,
      description: e.node.description ?? null,
      site_url: e.node.siteUrl ?? null,
      favourites: e.node.favourites ?? null,
    }));

    const { error: upsertCharsErr } = await supabaseAdmin
      .from("characters")
      .upsert(characterRows, { onConflict: "anilist_id" });

    if (upsertCharsErr) throw upsertCharsErr;

    // Fetch UUIDs for join rows
    const anilistIds = Array.from(new Set(edges.map((e) => e.node.id)));
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

    return res.status(200).json({
      ok: true,
      anime: { id: animeRow.id, anilist_id: animeRow.anilist_id, title: animeRow.title },
      anilist: { mediaId, title: mediaTitle },
      imported: { characters: characterRows.length, joins: joinRows.length },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? String(err) });
  }
}
