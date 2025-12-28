"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type EpisodeRow = {
  id: string;
  anime_id: string;
  season_number: number | null;
  episode_number: number | null;
  title: string | null;
};

type Props = {
  animeId: string;
  onOpenLog: (episodeId?: string) => void; // opens GlobalLogModal (optionally pass selected episode)
};

export default function QuickLogBox({ animeId, onOpenLog }: Props) {
  const [open, setOpen] = useState(false);

  const [episodes, setEpisodes] = useState<EpisodeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [season, setSeason] = useState<number | "all">("all");
  const [episodeId, setEpisodeId] = useState<string>("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // prevents duplicate fetches
  const fetchedForAnimeId = useRef<string | null>(null);

  // ✅ Fetch episodes ONCE per animeId (not on open) to prevent “open hitch”
  useEffect(() => {
    if (!animeId) return;

    // if we already fetched for this animeId, don’t refetch
    if (fetchedForAnimeId.current === animeId) return;

    let cancelled = false;

    async function run() {
      setLoading(true);
      setErrMsg(null);

      const { data, error } = await supabase
        .from("anime_episodes")
        .select("id, anime_id, season_number, episode_number, title")
        .eq("anime_id", animeId)
        .order("season_number", { ascending: true, nullsFirst: true })
        .order("episode_number", { ascending: true, nullsFirst: true });

      if (cancelled) return;

      if (error || !data) {
        console.error("QuickLogBox: error loading episodes", error);
        setEpisodes([]);
        setErrMsg("Couldn’t load episodes.");
        fetchedForAnimeId.current = null;
      } else {
        setEpisodes((data as EpisodeRow[]) ?? []);
        fetchedForAnimeId.current = animeId;
      }

      setLoading(false);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [animeId]);

  // Derive seasons list
  const seasons = useMemo(() => {
    const nums = new Set<number>();
    for (const e of episodes) {
      if (typeof e.season_number === "number") nums.add(e.season_number);
    }
    return Array.from(nums).sort((a, b) => a - b);
  }, [episodes]);

  const hasMultipleSeasons = seasons.length > 1;

  // Filter episodes by selected season
  const episodeOptions = useMemo(() => {
    const filtered =
      season === "all"
        ? episodes
        : episodes.filter((e) => (e.season_number ?? 1) === season);

    return filtered
      .filter((e) => e.id && typeof e.episode_number === "number")
      .sort((a, b) => (a.episode_number ?? 0) - (b.episode_number ?? 0));
  }, [episodes, season]);

  // When season changes, reset episode selection
  useEffect(() => {
    setEpisodeId("");
    setMsg(null);
  }, [season]);

  const selectedEpisode = useMemo(() => {
    return episodes.find((e) => e.id === episodeId) ?? null;
  }, [episodes, episodeId]);

  async function handleQuickLog() {
    if (!selectedEpisode?.id) return;
    if (busy) return;

    setBusy(true);
    setMsg(null);

    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      const user = auth?.user;

      if (authErr || !user) {
        setMsg("You must be logged in to log.");
        return;
      }

      const { error } = await supabase.from("anime_episode_logs").insert({
        user_id: user.id,
        anime_id: animeId,
        anime_episode_id: selectedEpisode.id,
      });

      if (error) {
        console.error("QuickLogBox: quick log error", error);
        setMsg("Couldn’t log (see console).");
        return;
      }

      setMsg("Logged ✅");
    } finally {
      setBusy(false);
    }
  }

  const canInteract = !loading && !errMsg && episodes.length > 0;

  return (
    <div className="mt-3 w-[240px] overflow-hidden rounded-md border border-gray-800 bg-black text-gray-200 shadow-sm">
      {/* Header row (click to expand) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "w-full px-4 py-2 text-left text-[12px] font-medium",
          "hover:bg-white/5 active:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/10",
          "flex items-center justify-between",
        ].join(" ")}
      >
        <span>Quick Log</span>
        <ChevronDown
          className={[
            "h-4 w-4 transition-transform duration-200",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      <Divider />

      {/* ✅ Always mounted panel (smooth) */}
      <div
        className={[
          "overflow-hidden transition-all duration-200 ease-out",
          open ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0",
        ].join(" ")}
      >
        <div className="px-4 py-3">
          {loading ? (
            <div className="text-xs text-gray-400">Loading episodes…</div>
          ) : errMsg ? (
            <div className="text-xs text-red-300">{errMsg}</div>
          ) : episodes.length === 0 ? (
            <div className="text-xs text-gray-400">No episodes found.</div>
          ) : (
            <>
              {/* Season selector (only if multiple seasons) */}
              {hasMultipleSeasons ? (
                <div className="mb-2">
                  <div className="mb-1 text-[10px] font-semibold text-gray-400">
                    Season
                  </div>
                  <select
                    value={season === "all" ? "all" : String(season)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSeason(v === "all" ? "all" : Number(v));
                    }}
                    className="w-full rounded-md border border-gray-800 bg-black px-2 py-1.5 text-[12px] text-gray-200 outline-none focus:ring-2 focus:ring-white/10"
                  >
                    <option value="all">All seasons</option>
                    {seasons.map((s) => (
                      <option key={s} value={String(s)}>
                        Season {s}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {/* Episode selector */}
              <div className="mb-3">
                <div className="mb-1 text-[10px] font-semibold text-gray-400">
                  Episode
                </div>
                <select
                  value={episodeId}
                  onChange={(e) => setEpisodeId(e.target.value)}
                  disabled={!canInteract}
                  className={[
                    "w-full rounded-md border border-gray-800 bg-black px-2 py-1.5 text-[12px] text-gray-200 outline-none focus:ring-2 focus:ring-white/10",
                    !canInteract ? "opacity-60 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  <option value="">Select episode…</option>
                  {episodeOptions.map((e) => (
                    <option key={e.id} value={e.id}>
                      Ep {e.episode_number}
                      {e.title ? ` — ${e.title}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <SmallButton
                  onClick={handleQuickLog}
                  disabled={!episodeId || busy || !canInteract}
                  emphasis
                >
                  {busy ? "Logging…" : "Quick Log"}
                </SmallButton>

                <SmallButton
                  onClick={() => onOpenLog(episodeId || undefined)}
                  disabled={!episodeId || !canInteract}
                >
                  Write Review
                </SmallButton>
              </div>

              {msg ? (
                <div className="mt-2 text-xs text-gray-300">{msg}</div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-gray-700/60" />;
}

function SmallButton({
  children,
  onClick,
  disabled,
  emphasis,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  emphasis?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={[
        "w-full rounded-md border px-2 py-2 text-center text-[12px] font-medium",
        emphasis ? "border-gray-700 text-white" : "border-gray-800 text-gray-200",
        disabled
          ? "opacity-60 cursor-not-allowed"
          : "hover:bg-white/5 active:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/10",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
