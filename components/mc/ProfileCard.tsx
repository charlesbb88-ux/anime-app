"use client";

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";

type Props = {
  accountLevel: number;
  accountXp: number;
  progressPercent: number;
  progressIntoLevel: number;
  progressNeededInLevel: number;
  title?: string;
  rank?: string;
  xpBreakdown?: {
    follow_xp: number;
    log_xp: number;
    rating_xp: number;
    review_xp: number;
    total_xp: number;
  } | null;
};

function safeNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default function ProfileCard({
  accountLevel,
  accountXp,
  progressPercent,
  progressIntoLevel,
  progressNeededInLevel,
  title = "Unranked Wanderer",
  rank = "F Rank",
  xpBreakdown = null,
}: Props) {
  const percent = safeNumber(progressPercent);
  const into = safeNumber(progressIntoLevel);
  const needed = safeNumber(progressNeededInLevel);

  const [showXpTooltip, setShowXpTooltip] = useState(false);
  const xpTooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        xpTooltipRef.current &&
        event.target instanceof Node &&
        !xpTooltipRef.current.contains(event.target)
      ) {
        setShowXpTooltip(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowXpTooltip(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="rounded-md border-2 border-black bg-white px-4 py-3 text-black">
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-black">
        Profile
      </div>

      <div className="mt-2 space-y-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-black bg-white/20 px-4 py-2">
            <div className="text-xs uppercase tracking-wide text-black">Level</div>
            <div className="mt-2 text-3xl font-bold text-black">
              {safeNumber(accountLevel, 1)}
            </div>
          </div>

          <div ref={xpTooltipRef} className="relative">
            <button
              type="button"
              onClick={() => setShowXpTooltip((prev) => !prev)}
              className="relative w-full rounded-2xl border border-black bg-white/20 px-4 py-2 text-left transition hover:bg-black/5"
            >
              {/* Top row */}
              <div className="relative">
                <div className="text-xs uppercase tracking-wide text-black">XP</div>

                <Info
                  size={14}
                  className="absolute -right-1 top-0 text-black hover:text-black"
                />
              </div>

              {/* Value */}
              <div className="mt-2 text-3xl font-bold text-black">
                {safeNumber(accountXp, 0)}
              </div>
            </button>

            {showXpTooltip ? (
              <div className="absolute left-0 top-full z-30 mt-2 w-[320px] rounded-2xl border-2 border-black bg-white px-4 py-3 text-sm text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="font-bold uppercase tracking-wide text-black">
                  Account XP
                </div>

                <div className="mt-2 space-y-2 leading-relaxed text-black">
                  <div className="rounded-xl border border-black bg-black/[0.03] px-3 py-2">
                    <div className="mb-1 text-xs font-bold uppercase tracking-wide text-black/70">
                      Current breakdown
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Followers</span>
                        <span className="font-semibold">{xpBreakdown?.follow_xp ?? 0}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span>Logs</span>
                        <span className="font-semibold">{xpBreakdown?.log_xp ?? 0}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span>Ratings</span>
                        <span className="font-semibold">{xpBreakdown?.rating_xp ?? 0}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span>Reviews</span>
                        <span className="font-semibold">{xpBreakdown?.review_xp ?? 0}</span>
                      </div>

                      <div className="mt-2 flex items-center justify-between border-t border-black pt-2 font-bold">
                        <span>Total</span>
                        <span>{xpBreakdown?.total_xp ?? 0} XP</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-black bg-black/[0.03] px-3 py-2">
                    <div className="mb-1 text-xs font-bold uppercase tracking-wide text-black/70">
                      XP per action
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Followers</span>
                        <span className="font-semibold">+5 XP</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span>Logs</span>
                        <span className="font-semibold">+8 XP</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span>Ratings</span>
                        <span className="font-semibold">+2 XP</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span>Reviews</span>
                        <span className="font-semibold">+20 XP</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-black bg-white/20 px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-black">Progress to next level</span>
            <span className="text-sm font-semibold text-black">
              {percent.toFixed(2)}%
            </span>
          </div>

          <div className="mt-3 h-3 w-full overflow-hidden rounded-full border border-black bg-black/10">
            <div
              className="h-full rounded-full bg-black"
              style={{
                width: `${Math.max(0, Math.min(100, percent))}%`,
              }}
            />
          </div>

          <div className="mt-2 text-xs text-black">
            {into.toFixed(2)} / {needed.toFixed(2)}
          </div>
        </div>

        <div className="grid gap-2">
          <div className="rounded-2xl border border-black bg-white/20 px-4 py-2">
            <div className="text-xs uppercase tracking-wide text-black">Title</div>
            <div className="mt-2 text-lg font-semibold text-black">{title}</div>
          </div>

          <div className="rounded-2xl border border-black bg-white/20 px-4 py-2">
            <div className="text-xs uppercase tracking-wide text-black">Rank</div>
            <div className="mt-2 text-lg font-semibold text-black">{rank}</div>
          </div>
        </div>
      </div>
    </div>
  );
}