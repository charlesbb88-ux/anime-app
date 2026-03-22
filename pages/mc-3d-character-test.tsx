"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Mc3DCharacter from "@/components/mc/Mc3DCharacter";
import { supabase } from "@/lib/supabaseClient";
import type { DotReplayFrame, McDotReplay } from "@/lib/dot/mcDotReplayTypes";

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
    dot_replay?: McDotReplay;
  } | null;
};

function getInterpolatedFrame(frames: DotReplayFrame[], t: number): DotReplayFrame | null {
  if (!frames.length) return null;
  if (t <= frames[0].t) return frames[0];
  if (t >= frames[frames.length - 1].t) return frames[frames.length - 1];

  for (let i = 0; i < frames.length - 1; i += 1) {
    const a = frames[i];
    const b = frames[i + 1];

    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t || 1;
      const localT = (t - a.t) / span;

      return {
        t,
        fighters: {
          left: {
            x: a.fighters.left.x + (b.fighters.left.x - a.fighters.left.x) * localT,
            y: a.fighters.left.y + (b.fighters.left.y - a.fighters.left.y) * localT,
            facing: localT < 0.5 ? a.fighters.left.facing : b.fighters.left.facing,
            action: localT < 0.5 ? a.fighters.left.action : b.fighters.left.action,
            hp: localT < 0.5 ? a.fighters.left.hp : b.fighters.left.hp,
          },
          right: {
            x: a.fighters.right.x + (b.fighters.right.x - a.fighters.right.x) * localT,
            y: a.fighters.right.y + (b.fighters.right.y - a.fighters.right.y) * localT,
            facing: localT < 0.5 ? a.fighters.right.facing : b.fighters.right.facing,
            action: localT < 0.5 ? a.fighters.right.action : b.fighters.right.action,
            hp: localT < 0.5 ? a.fighters.right.hp : b.fighters.right.hp,
          },
        },
      };
    }
  }

  return frames[frames.length - 1];
}

export default function Mc3DTestPage() {
  const [battleRow, setBattleRow] = useState<BattleRow | null>(null);
  const [replay, setReplay] = useState<McDotReplay | null>(null);
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
    const dotReplay = typedData.replay_data?.dot_replay ?? null;

    if (!dotReplay) {
      console.error("Latest battle row does not contain replay_data.dot_replay");
      return;
    }

    setBattleRow(typedData);
    setReplay(dotReplay);
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
      window.cancelAnimationFrame(rafRef.current);
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
        rafRef.current = window.requestAnimationFrame(tick);
      }
    };

    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, [replay, playbackKey]);

  const frame = useMemo(() => {
    if (!replay) return null;
    return getInterpolatedFrame(replay.frames, timeMs);
  }, [replay, timeMs]);

  if (!battleRow || !replay || !frame) {
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
            type="button"
            onClick={loadLatestBattle}
            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
          >
            Load Latest Battle
          </button>

          <button
            type="button"
            onClick={() => {
              playbackTimeRef.current = 0;
              lastNowRef.current = null;
              setTimeMs(0);
              setPlaybackKey((prev) => prev + 1);
            }}
            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
          >
            Replay
          </button>

          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
            Winner: <span className="font-semibold">{replay.winner}</span>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
            Duration: <span className="font-semibold">{replay.durationMs} ms</span>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
            Time: <span className="font-semibold">{Math.round(timeMs)} ms</span>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/80">
          <div className="mb-2 text-sm font-medium text-white">Loaded Battle Row</div>
          <div>Battle ID: {battleRow.id}</div>
          <div>Challenger: {battleRow.challenger_user_id}</div>
          <div>Defender: {battleRow.defender_user_id}</div>
          <div>Winner User ID: {battleRow.winner_user_id ?? "none"}</div>
          <div>Replay Kind: {battleRow.replay_data?.replay_kind ?? "missing"}</div>
          <div>Left Side: {battleRow.replay_data?.fighter_side_map?.left ?? "missing"}</div>
          <div>Right Side: {battleRow.replay_data?.fighter_side_map?.right ?? "missing"}</div>
          <div>Frame Count: {replay.frames.length}</div>
          <div>Hit Event Count: {replay.hitEvents.length}</div>
          <div>Event Count: {replay.events.length}</div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8">
          <Mc3DCharacter
            leftFighter={frame.fighters.left}
            rightFighter={frame.fighters.right}
          />
        </div>
      </div>
    </div>
  );
}