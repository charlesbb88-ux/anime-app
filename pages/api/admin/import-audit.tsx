// pages/admin/import-audit.tsx

import type { GetServerSideProps, NextPage } from "next";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type AnimeRow = {
  id: string;
  title: string | null;
  slug: string | null;

  anilist_id: number | null;
  tmdb_id: number | null;
  tvdb_id: number | null;

  image_url: string | null;
  banner_image_url: string | null;

  total_episodes: number | null;
  format: string | null;
  status: string | null;
  season_year: number | null;

  start_date: string | null;
  end_date: string | null;

  created_at: string | null;
};

type SeasonRow = {
  id: string;
  season_number: number | null;
  title: string | null;
  air_date: string | null;
  tmdb_season_id: number | null;
  tvdb_season_id: number | null;
};

type EpisodeRow = {
  id: string;
  episode_number: number | null;
  season_number: number | null;
  season_episode_number: number | null;
  title: string | null;
  air_date: string | null;
  tmdb_episode_id: number | null;
  tvdb_episode_id: number | null;
};

type ArtworkRow = {
  source: string | null;
  kind: string | null;
  url: string;
  lang: string | null;
  width: number | null;
  height: number | null;
  vote: number | null;
  is_primary: boolean | null;
};

type SeasonArtworkRow = ArtworkRow & { anime_season_id: string };
type EpisodeArtworkRow = ArtworkRow & { anime_episode_id: string };

type CharacterRow = {
  source: string | null;
  tvdb_character_id: number | null;
  character_name: string | null;
  character_image_url: string | null;
  person_name: string | null;
  person_image_url: string | null;
  role: string | null;
  sort_order: number | null;
};

type GroupedCounts = Record<string, number>;
type GroupedBySourceKind = Record<string, Record<string, number>>;

function badge(label: string, colorClass: string) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-[2px] text-[11px] font-semibold ${colorClass}`}
    >
      {label}
    </span>
  );
}

function groupBySourceKind(rows: { source: any; kind: any }[]): GroupedBySourceKind {
  const out: GroupedBySourceKind = {};
  for (const r of rows) {
    const s = (r.source ?? "unknown").toString();
    const k = (r.kind ?? "unknown").toString();
    if (!out[s]) out[s] = {};
    out[s][k] = (out[s][k] || 0) + 1;
  }
  return out;
}

function groupBySource(rows: { source: any }[]): GroupedCounts {
  const out: GroupedCounts = {};
  for (const r of rows) {
    const s = (r.source ?? "unknown").toString();
    out[s] = (out[s] || 0) + 1;
  }
  return out;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return d;
}

type Props = {
  list: AnimeRow[];

  selectedAnimeId: string | null;
  selectedAnime: AnimeRow | null;

  seasons: SeasonRow[];
  episodes: EpisodeRow[];

  animeArtwork: ArtworkRow[];
  seasonArtwork: SeasonArtworkRow[];
  episodeArtwork: EpisodeArtworkRow[];

  characters: CharacterRow[];

  // rollups
  animeArtworkGrouped: GroupedBySourceKind;
  seasonArtworkGrouped: GroupedBySourceKind;
  episodeArtworkGrouped: GroupedBySourceKind;
  charactersBySource: GroupedCounts;

  error?: string | null;
};

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const selectedAnimeId =
    typeof ctx.query.animeId === "string" && ctx.query.animeId.length ? ctx.query.animeId : null;

  // List “imported” anime: anything with anilist_id OR tmdb_id OR tvdb_id present.
  const { data: list, error: listErr } = await supabaseAdmin
    .from("anime")
    .select(
      "id,title,slug,anilist_id,tmdb_id,tvdb_id,image_url,banner_image_url,total_episodes,format,status,season_year,start_date,end_date,created_at"
    )
    .or("anilist_id.not.is.null,tmdb_id.not.is.null,tvdb_id.not.is.null")
    .order("created_at", { ascending: false })
    .limit(250);

  if (listErr) {
    return {
      props: {
        list: [],
        selectedAnimeId,
        selectedAnime: null,
        seasons: [],
        episodes: [],
        animeArtwork: [],
        seasonArtwork: [],
        episodeArtwork: [],
        characters: [],
        animeArtworkGrouped: {},
        seasonArtworkGrouped: {},
        episodeArtworkGrouped: {},
        charactersBySource: {},
        error: listErr.message,
      },
    };
  }

  const typedList = (list || []) as AnimeRow[];

  let selectedAnime: AnimeRow | null = null;
  let seasons: SeasonRow[] = [];
  let episodes: EpisodeRow[] = [];
  let animeArtwork: ArtworkRow[] = [];
  let seasonArtwork: SeasonArtworkRow[] = [];
  let episodeArtwork: EpisodeArtworkRow[] = [];
  let characters: CharacterRow[] = [];

  if (selectedAnimeId) {
    const { data: a, error: aErr } = await supabaseAdmin
      .from("anime")
      .select(
        "id,title,slug,anilist_id,tmdb_id,tvdb_id,image_url,banner_image_url,total_episodes,format,status,season_year,start_date,end_date,created_at"
      )
      .eq("id", selectedAnimeId)
      .maybeSingle();

    if (!aErr && a) selectedAnime = a as AnimeRow;

    const { data: s } = await supabaseAdmin
      .from("anime_seasons")
      .select("id,season_number,title,air_date,tmdb_season_id,tvdb_season_id")
      .eq("anime_id", selectedAnimeId)
      .order("season_number", { ascending: true });

    seasons = (s || []) as SeasonRow[];

    const { data: e } = await supabaseAdmin
      .from("anime_episodes")
      .select(
        "id,episode_number,season_number,season_episode_number,title,air_date,tmdb_episode_id,tvdb_episode_id"
      )
      .eq("anime_id", selectedAnimeId)
      .order("episode_number", { ascending: true })
      .limit(500);

    episodes = (e || []) as EpisodeRow[];

    const { data: aw } = await supabaseAdmin
      .from("anime_artwork")
      .select("source,kind,url,lang,width,height,vote,is_primary")
      .eq("anime_id", selectedAnimeId)
      .order("source", { ascending: true })
      .order("kind", { ascending: true })
      .order("is_primary", { ascending: false });

    animeArtwork = (aw || []) as ArtworkRow[];

    // season artwork (for all seasons belonging to this anime)
    if (seasons.length) {
      const seasonIds = seasons.map((x) => x.id);
      const { data: saw } = await supabaseAdmin
        .from("anime_season_artwork")
        .select("source,kind,url,lang,width,height,vote,is_primary,anime_season_id")
        .in("anime_season_id", seasonIds)
        .order("source", { ascending: true })
        .order("kind", { ascending: true })
        .order("is_primary", { ascending: false });

      seasonArtwork = (saw || []) as SeasonArtworkRow[];
    }

    // episode artwork (for all episodes belonging to this anime)
    if (episodes.length) {
      const episodeIds = episodes.map((x) => x.id);
      const { data: eaw } = await supabaseAdmin
        .from("anime_episode_artwork")
        .select("source,kind,url,lang,width,height,vote,is_primary,anime_episode_id")
        .in("anime_episode_id", episodeIds)
        .order("source", { ascending: true })
        .order("kind", { ascending: true })
        .order("is_primary", { ascending: false });

      episodeArtwork = (eaw || []) as EpisodeArtworkRow[];
    }

    const { data: c } = await supabaseAdmin
      .from("anime_characters")
      .select(
        "source,tvdb_character_id,character_name,character_image_url,person_name,person_image_url,role,sort_order"
      )
      .eq("anime_id", selectedAnimeId)
      .order("sort_order", { ascending: true })
      .limit(500);

    characters = (c || []) as CharacterRow[];
  }

  return {
    props: {
      list: typedList,

      selectedAnimeId,
      selectedAnime,

      seasons,
      episodes,

      animeArtwork,
      seasonArtwork,
      episodeArtwork,

      characters,

      animeArtworkGrouped: groupBySourceKind(animeArtwork as any),
      seasonArtworkGrouped: groupBySourceKind(seasonArtwork as any),
      episodeArtworkGrouped: groupBySourceKind(episodeArtwork as any),
      charactersBySource: groupBySource(characters as any),

      error: null,
    },
  };
};

const Page: NextPage<Props> = (props) => {
  const selected = props.selectedAnime;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Import Audit</h1>
            <p className="text-zinc-400 text-sm mt-1">
              Visual view of what your importer wrote + which source it came from.
            </p>
          </div>
          <div className="text-xs text-zinc-400">
            Showing last{" "}
            <span className="text-zinc-200 font-semibold">{props.list.length}</span> imported anime
          </div>
        </div>

        {props.error ? (
          <div className="mt-4 rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-200">
            {props.error}
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: list */}
          <div className="lg:col-span-5 xl:col-span-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                <div className="text-sm font-semibold">Imported Anime</div>
                <div className="text-xs text-zinc-400">Click one</div>
              </div>

              <div className="max-h-[70vh] overflow-auto">
                {props.list.map((a) => {
                  const isSelected = props.selectedAnimeId === a.id;

                  return (
                    <Link
                      key={a.id}
                      href={{
                        pathname: "/admin/import-audit",
                        query: { animeId: a.id },
                      }}
                      className={`block px-4 py-3 border-b border-zinc-800 hover:bg-zinc-900/70 transition ${
                        isSelected ? "bg-zinc-900" : ""
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="h-12 w-9 rounded-md bg-zinc-800 overflow-hidden shrink-0">
                          {a.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.image_url} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate">
                                {a.title || "(untitled)"}
                              </div>
                              <div className="text-xs text-zinc-400 truncate">
                                {a.slug || "—"} • {a.season_year ?? "—"} • {a.format ?? "—"}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 justify-end">
                              {a.anilist_id
                                ? badge(
                                    "AniList",
                                    "bg-blue-500/15 text-blue-300 border border-blue-500/25"
                                  )
                                : null}
                              {a.tmdb_id
                                ? badge(
                                    "TMDB",
                                    "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                                  )
                                : null}
                              {a.tvdb_id
                                ? badge(
                                    "TVDB",
                                    "bg-amber-500/15 text-amber-300 border border-amber-500/25"
                                  )
                                : null}
                            </div>
                          </div>

                          <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-400">
                            <span>ID: {a.id.slice(0, 8)}…</span>
                            <span>•</span>
                            <span>
                              eps: <span className="text-zinc-200">{a.total_episodes ?? "—"}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}

                {!props.list.length ? (
                  <div className="p-4 text-sm text-zinc-400">No imported anime found yet.</div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Right: details */}
          <div className="lg:col-span-7 xl:col-span-8">
            {!selected ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-zinc-300">
                Select an anime on the left to see everything imported for it.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header card */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                  <div className="flex items-start gap-4">
                    <div className="h-20 w-14 rounded-lg bg-zinc-800 overflow-hidden shrink-0">
                      {selected.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selected.image_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h2 className="text-lg font-semibold truncate">{selected.title}</h2>
                          <div className="text-sm text-zinc-400 truncate">{selected.slug}</div>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end">
                          {selected.anilist_id
                            ? badge(
                                "AniList",
                                "bg-blue-500/15 text-blue-300 border border-blue-500/25"
                              )
                            : null}
                          {selected.tmdb_id
                            ? badge(
                                "TMDB",
                                "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                              )
                            : null}
                          {selected.tvdb_id
                            ? badge(
                                "TVDB",
                                "bg-amber-500/15 text-amber-300 border border-amber-500/25"
                              )
                            : null}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
                          <div className="text-xs text-zinc-400">Anime ID</div>
                          <div className="font-mono text-xs text-zinc-200 mt-1">{selected.id}</div>
                        </div>
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
                          <div className="text-xs text-zinc-400">IDs</div>
                          <div className="text-xs text-zinc-200 mt-1">
                            AniList: {selected.anilist_id ?? "—"}
                            <br />
                            TMDB: {selected.tmdb_id ?? "—"}
                            <br />
                            TVDB: {selected.tvdb_id ?? "—"}
                          </div>
                        </div>
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
                          <div className="text-xs text-zinc-400">Dates</div>
                          <div className="text-xs text-zinc-200 mt-1">
                            Start: {fmtDate(selected.start_date)}
                            <br />
                            End: {fmtDate(selected.end_date)}
                          </div>
                        </div>
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
                          <div className="text-xs text-zinc-400">Counts</div>
                          <div className="text-xs text-zinc-200 mt-1">
                            Seasons: {props.seasons.length}
                            <br />
                            Episodes: {props.episodes.length}
                            <br />
                            Characters: {props.characters.length}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rollups */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <RollupCard title="Anime Artwork" grouped={props.animeArtworkGrouped} />
                  <RollupCard title="Season Artwork" grouped={props.seasonArtworkGrouped} />
                  <RollupCard title="Episode Artwork" grouped={props.episodeArtworkGrouped} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SimpleCountsCard title="Characters by Source" counts={props.charactersBySource} />
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                    <div className="text-sm font-semibold">Imported From</div>
                    <div className="mt-2 text-sm text-zinc-300">
                      <div>
                        Anime row IDs:{" "}
                        {selected.anilist_id ? "AniList " : ""}
                        {selected.tmdb_id ? "TMDB " : ""}
                        {selected.tvdb_id ? "TVDB " : ""}
                      </div>
                      <div className="text-xs text-zinc-400 mt-2">
                        Artwork/characters rows store their own{" "}
                        <span className="text-zinc-200">source</span> field (tmdb/tvdb).
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seasons table */}
                <SectionTable
                  title={`Seasons (${props.seasons.length})`}
                  columns={[
                    { key: "season_number", label: "Season" },
                    { key: "title", label: "Title" },
                    { key: "air_date", label: "Air date" },
                    { key: "tmdb_season_id", label: "TMDB season id" },
                    { key: "tvdb_season_id", label: "TVDB season id" },
                  ]}
                  rows={props.seasons}
                />

                {/* Episodes table */}
                <SectionTable
                  title={`Episodes (${props.episodes.length})`}
                  columns={[
                    { key: "episode_number", label: "Ep#" },
                    { key: "season_number", label: "S" },
                    { key: "season_episode_number", label: "S-ep" },
                    { key: "title", label: "Title" },
                    { key: "air_date", label: "Air date" },
                    { key: "tmdb_episode_id", label: "TMDB ep id" },
                    { key: "tvdb_episode_id", label: "TVDB ep id" },
                  ]}
                  rows={props.episodes.slice(0, 200)}
                  footerNote={props.episodes.length > 200 ? "Showing first 200 episodes." : undefined}
                />

                {/* Characters table */}
                <SectionTable
                  title={`Characters (${props.characters.length})`}
                  columns={[
                    { key: "source", label: "Source" },
                    { key: "character_name", label: "Character" },
                    { key: "person_name", label: "Person" },
                    { key: "role", label: "Role" },
                    { key: "tvdb_character_id", label: "TVDB char id" },
                  ]}
                  rows={props.characters.slice(0, 200)}
                  footerNote={
                    props.characters.length > 200 ? "Showing first 200 characters." : undefined
                  }
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function RollupCard({ title, grouped }: { title: string; grouped: GroupedBySourceKind }) {
  const sources = Object.keys(grouped);
  const total = sources.reduce((sum, s) => {
    const kinds = grouped[s] || {};
    return sum + Object.values(kinds).reduce((a, b) => a + b, 0);
  }, 0);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-zinc-400">
          total: <span className="text-zinc-200 font-semibold">{total}</span>
        </div>
      </div>

      {sources.length === 0 ? (
        <div className="mt-2 text-sm text-zinc-400">No rows</div>
      ) : (
        <div className="mt-3 space-y-3">
          {sources.map((s) => {
            const kinds = grouped[s];
            const kindKeys = Object.keys(kinds).sort();
            return (
              <div key={s} className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
                <div className="text-xs text-zinc-400">
                  source: <span className="text-zinc-200 font-semibold">{s}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {kindKeys.map((k) => (
                    <span
                      key={k}
                      className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-900 px-2 py-[2px] text-[11px] text-zinc-200"
                    >
                      {k}: <span className="ml-1 text-zinc-100 font-semibold">{kinds[k]}</span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SimpleCountsCard({ title, counts }: { title: string; counts: GroupedCounts }) {
  const keys = Object.keys(counts);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-zinc-400">
          total: <span className="text-zinc-200 font-semibold">{total}</span>
        </div>
      </div>

      {keys.length === 0 ? (
        <div className="mt-2 text-sm text-zinc-400">No rows</div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {keys.sort().map((k) => (
            <span
              key={k}
              className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-900 px-2 py-[2px] text-[11px] text-zinc-200"
            >
              {k}: <span className="ml-1 text-zinc-100 font-semibold">{counts[k]}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionTable({
  title,
  columns,
  rows,
  footerNote,
}: {
  title: string;
  columns: { key: string; label: string }[];
  rows: any[];
  footerNote?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="text-sm font-semibold">{title}</div>
        {footerNote ? <div className="text-xs text-zinc-400">{footerNote}</div> : null}
      </div>

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-950/40">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className="text-left px-4 py-2 text-xs font-semibold text-zinc-300 whitespace-nowrap"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-zinc-400" colSpan={columns.length}>
                  No rows
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={idx} className="border-t border-zinc-800">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-2 text-zinc-200 whitespace-nowrap">
                      {r?.[c.key] === null || r?.[c.key] === undefined || r?.[c.key] === ""
                        ? "—"
                        : String(r?.[c.key])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Page;
