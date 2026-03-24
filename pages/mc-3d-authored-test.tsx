"use client";

import { useEffect, useRef, useState } from "react";
import Mc3DCharacter from "@/components/mc/Mc3DCharacter";
import { AUTHORED_TEST_REPLAY } from "@/lib/mc3d/authoredTestReplay";

export default function Mc3DAuthoredTestPage() {
  const [timeMs, setTimeMs] = useState(0);
  const [playbackKey, setPlaybackKey] = useState(0);

  const rafRef = useRef<number | null>(null);
  const playbackTimeRef = useRef(0);
  const lastNowRef = useRef<number | null>(null);

  const PLAYBACK_SPEED = 0.6;
  const replay = AUTHORED_TEST_REPLAY;

  useEffect(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
    }

    playbackTimeRef.current = 0;
    lastNowRef.current = null;
    setTimeMs(0);

    const tick = (now: number) => {
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
  }, [playbackKey, replay.durationMs]);

  return (
    <div className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-semibold">3D Authored Test</h1>

        <div className="mt-4 flex flex-wrap items-center gap-3">
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

          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
            Exchanges: <span className="font-semibold">{replay.exchanges.length}</span>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/80">
          <div className="mb-2 text-sm font-medium text-white">Authored Sequence Notes</div>
          <div>Exchange 1: left runs in and lands first grounded hit</div>
          <div>Exchange 2: right counters after reset</div>
          <div>Exchange 3: left applies short pressure hit</div>
          <div>Exchange 4: left lands launcher-style finisher</div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8">
          <Mc3DCharacter replay={replay} timeMs={timeMs} />
        </div>
      </div>
    </div>
  );
}