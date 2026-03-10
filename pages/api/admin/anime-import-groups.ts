import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminGuard";
import { getAniListAnimeById } from "@/lib/anilist";
import type { AniListAnime } from "@/lib/anilist";

type IncomingItem = {
  anilistId?: number | string;
  tmdbId?: number | string | null;
  manualTotalEpisodes?: number | string | null;
  importCharactersToo?: boolean;
};

function parsePositiveInt(v: unknown): number | null {
  const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseOptionalPositiveInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  return parsePositiveInt(v);
}

function pickSnapshotTitle(a: AniListAnime) {
  const t = a.title;
  return t.english || t.userPreferred || t.romaji || t.native || "Untitled";
}

function normalizeItems(items: IncomingItem[]) {
  const out: Array<{
    order_index: number;
    anilist_id: number;
    tmdb_id: number | null;
    manual_total_episodes: number | null;
    import_characters: boolean;
  }> = [];

  for (let i = 0; i < items.length; i++) {
    const raw = items[i] ?? {};
    const anilistId = parsePositiveInt(raw.anilistId);
    const tmdbId = parseOptionalPositiveInt(raw.tmdbId);
    const manualTotalEpisodes = parseOptionalPositiveInt(raw.manualTotalEpisodes);

    if (!anilistId) continue;

    out.push({
      order_index: i,
      anilist_id: anilistId,
      tmdb_id: tmdbId,
      manual_total_episodes: manualTotalEpisodes,
      import_characters: raw.importCharactersToo !== false,
    });
  }

  return out;
}

async function resolveAniListTitle(anilistId: number): Promise<string | null> {
  try {
    const { data } = await getAniListAnimeById(anilistId);
    if (!data) return null;
    return pickSnapshotTitle(data);
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) return;

  try {
    if (req.method === "GET") {
      const id = typeof req.query.id === "string" ? req.query.id : null;

      if (id) {
        const { data: group, error: groupErr } = await supabaseAdmin
          .from("admin_anime_import_groups")
          .select("id, name, created_at, updated_at")
          .eq("id", id)
          .maybeSingle();

        if (groupErr) return res.status(500).json({ ok: false, error: groupErr.message });
        if (!group) return res.status(200).json({ ok: false, error: "Group not found" });

        const { data: items, error: itemsErr } = await supabaseAdmin
          .from("admin_anime_import_group_items")
          .select(`
            id,
            group_id,
            order_index,
            anilist_id,
            tmdb_id,
            manual_total_episodes,
            import_characters,
            title_snapshot,
            created_at,
            updated_at
          `)
          .eq("group_id", id)
          .order("order_index", { ascending: true });

        if (itemsErr) return res.status(500).json({ ok: false, error: itemsErr.message });

        return res.status(200).json({
          ok: true,
          group,
          items: items ?? [],
        });
      }

      const { data: groups, error: groupsErr } = await supabaseAdmin
        .from("admin_anime_import_groups")
        .select("id, name, created_at, updated_at")
        .order("updated_at", { ascending: false });

      if (groupsErr) return res.status(500).json({ ok: false, error: groupsErr.message });

      const groupIds = (groups ?? []).map((g: any) => g.id);
      let countsMap = new Map<string, number>();

      if (groupIds.length > 0) {
        const { data: items, error: itemsErr } = await supabaseAdmin
          .from("admin_anime_import_group_items")
          .select("group_id")
          .in("group_id", groupIds);

        if (itemsErr) return res.status(500).json({ ok: false, error: itemsErr.message });

        for (const row of items ?? []) {
          const key = row.group_id as string;
          countsMap.set(key, (countsMap.get(key) ?? 0) + 1);
        }
      }

      return res.status(200).json({
        ok: true,
        groups: (groups ?? []).map((g: any) => ({
          ...g,
          item_count: countsMap.get(g.id) ?? 0,
        })),
      });
    }

    if (req.method === "POST") {
      const body = (req.body ?? {}) as {
        id?: string;
        name?: string;
        items?: IncomingItem[];
      };

      const id = typeof body.id === "string" && body.id.trim() ? body.id.trim() : null;
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const items = Array.isArray(body.items) ? normalizeItems(body.items) : [];

      if (!name) {
        return res.status(200).json({ ok: false, error: "Group name is required" });
      }

      if (items.length === 0) {
        return res.status(200).json({ ok: false, error: "Add at least one valid anime row" });
      }

      const duplicateCheck = new Set<number>();
      for (const item of items) {
        if (duplicateCheck.has(item.anilist_id)) {
          return res.status(200).json({
            ok: false,
            error: `Duplicate AniList ID in group: ${item.anilist_id}`,
          });
        }
        duplicateCheck.add(item.anilist_id);
      }

      let groupId = id;

      if (groupId) {
        const { error: upErr } = await supabaseAdmin
          .from("admin_anime_import_groups")
          .update({
            name,
            updated_at: new Date().toISOString(),
          })
          .eq("id", groupId);

        if (upErr) return res.status(500).json({ ok: false, error: upErr.message });

        const { error: delErr } = await supabaseAdmin
          .from("admin_anime_import_group_items")
          .delete()
          .eq("group_id", groupId);

        if (delErr) return res.status(500).json({ ok: false, error: delErr.message });
      } else {
        const { data: insertedGroup, error: insErr } = await supabaseAdmin
          .from("admin_anime_import_groups")
          .insert({
            name,
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (insErr || !insertedGroup) {
          return res.status(500).json({ ok: false, error: insErr?.message || "Failed to create group" });
        }

        groupId = insertedGroup.id as string;
      }

      const rowsToInsert = [];
      for (const item of items) {
        const titleSnapshot = await resolveAniListTitle(item.anilist_id);

        rowsToInsert.push({
          group_id: groupId!,
          order_index: item.order_index,
          anilist_id: item.anilist_id,
          tmdb_id: item.tmdb_id,
          manual_total_episodes: item.manual_total_episodes,
          import_characters: item.import_characters,
          title_snapshot: titleSnapshot,
          updated_at: new Date().toISOString(),
        });
      }

      const { error: itemsInsErr } = await supabaseAdmin
        .from("admin_anime_import_group_items")
        .insert(rowsToInsert);

      if (itemsInsErr) return res.status(500).json({ ok: false, error: itemsInsErr.message });

      return res.status(200).json({
        ok: true,
        id: groupId,
        savedCount: rowsToInsert.length,
      });
    }

    if (req.method === "DELETE") {
      const id = typeof req.query.id === "string" ? req.query.id : null;
      if (!id) return res.status(200).json({ ok: false, error: "Missing group id" });

      const { error } = await supabaseAdmin
        .from("admin_anime_import_groups")
        .delete()
        .eq("id", id);

      if (error) return res.status(500).json({ ok: false, error: error.message });

      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: false, error: "Method not allowed" });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
}