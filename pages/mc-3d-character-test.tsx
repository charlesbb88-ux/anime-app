"use client";

import { useEffect, useRef, useState } from "react";
import Mc3DCharacter from "@/components/mc/Mc3DCharacter";
import { supabase } from "@/lib/supabaseClient";
import type { Mc3DReplay } from "@/lib/mc3d/mc3dReplayTypes";

type BattleRow = {
  id: string;
  challenger_user_id: string;
  defender_user_id: string;
  winner_user_id: string | null;
  replay_data: {
    replay_kind?: string;
    fighter_side_map?: {
      left?: string;
      right?: string;
    };
    dot_replay?: any;
    choreo_3d_replay?: Mc3DReplay;
  } | null;
};

export default function Mc3DTestPage() {
  const [battleRow, setBattleRow] = useState<BattleRow | null>(null);
  const [replay, setReplay] = useState<Mc3DReplay | null>(null);
  const [timeMs, setTimeMs] = useState(0);
  const [playbackKey, setPlaybackKey] = useState(0);

  const rafRef = useRef<number | null>(null);
  const playbackTimeRef = useRef(0);
  const lastNowRef = useRef<number | null>(null);

  const PLAYBACK_SPEED = 0.45;

  const loadLatestBattle = async () => {
    const { data, error } = await supabase
      .from("mc_battles")
      .select(`
        id,
        challenger_user_id,
        defender_user_id,
        winner_user_id,
        replay_data
      `)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.error("Failed to load latest battle:", error);
      return;
    }

    const typedData = data as BattleRow;
    const choreoReplay = typedData.replay_data?.choreo_3d_replay ?? null;

    if (!choreoReplay) {
      console.error("No choreo_3d_replay found. Did simulateMcBattle run?");
      return;
    }

    setBattleRow(typedData);
    setReplay(choreoReplay);
    setTimeMs(0);
    playbackTimeRef.current = 0;
    lastNowRef.current = null;
  };

  useEffect(() => {
    loadLatestBattle();
  }, []);

  useEffect(() => {
    if (!replay) return;

    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
    }

    playbackTimeRef.current = 0;
    lastNowRef.current = null;
    setTimeMs(0);

    const tick = (now: number) => {
      if (!replay) return;

      if (lastNowRef.current == null) {
        lastNowRef.current = now;
      }

      const rawDelta = now - lastNowRef.current;
      lastNowRef.current = now;

      const deltaMs = Math.min(rawDelta, 50) * PLAYBACK_SPEED;

      playbackTimeRef.current = Math.min(
        playbackTimeRef.current + deltaMs,
        replay.durationMs
      );

      setTimeMs(playbackTimeRef.current);

      if (playbackTimeRef.current < replay.durationMs) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [replay, playbackKey]);

  if (!battleRow || !replay) {
    return (
      <div className="min-h-screen bg-black px-6 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-2xl font-semibold">3D Character Test</h1>
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-semibold">3D Character Test</h1>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={loadLatestBattle}
            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm"
          >
            Load Latest Battle
          </button>

          <button
            onClick={() => {
              playbackTimeRef.current = 0;
              lastNowRef.current = null;
              setTimeMs(0);
              setPlaybackKey((p) => p + 1);
            }}
            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm"
          >
            Replay
          </button>

          <div className="text-sm">
            Time: {Math.round(timeMs)} ms
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8">
          <Mc3DCharacter replay={replay} timeMs={timeMs} />
        </div>
      </div>
    </div>
  );
}