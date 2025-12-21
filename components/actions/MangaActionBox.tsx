// components/actions/MangaActionBox.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Eye, Heart, BookmarkPlus } from "lucide-react";

import {
  getMyMangaWatchedMark,
  setMyMangaWatchedMark,
  getMyMangaLikedMark,
  setMyMangaLikedMark,
  getMyMangaWatchlistMark,
  setMyMangaWatchlistMark,
  getMyMangaRatingMark,
  setMyMangaRatingMark,
} from "@/lib/marks";

type Props = {
  onOpenLog: () => void;
  onShowActivity?: () => void;

  // series id is always present (for series page)
  mangaId?: string | null;

  // ✅ optional: if provided, becomes "chapter scoped"
  mangaChapterId?: string | null;
};

export default function MangaActionBox({
  onOpenLog,
  onShowActivity,
  mangaId = null,
  mangaChapterId = null,
}: Props) {
  const scopeKey = useMemo(() => {
    return mangaChapterId
      ? `chapter:${mangaChapterId}`
      : `series:${mangaId ?? "none"}`;
  }, [mangaId, mangaChapterId]);

  // top actions
  const [isWatched, setIsWatched] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);

  const [watchBusy, setWatchBusy] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [watchlistBusy, setWatchlistBusy] = useState(false);

  // rating stored as HALF-STARS: 1..10 (0.5★..5★)
  const [hoverHalfStars, setHoverHalfStars] = useState<number | null>(null);
  const [halfStars, setHalfStars] = useState<number | null>(null);
  const shownHalfStars = useMemo(
    () => hoverHalfStars ?? halfStars ?? 0,
    [hoverHalfStars, halfStars]
  );
  const [ratingBusy, setRatingBusy] = useState(false);

  // ✅ load watched/liked/watchlist/rating state from DB (series OR chapter scope)
  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!mangaId) return;

      const [watchedRes, likedRes, watchlistRes, ratingRes] = await Promise.all([
        getMyMangaWatchedMark(mangaId, mangaChapterId),
        getMyMangaLikedMark(mangaId, mangaChapterId),
        getMyMangaWatchlistMark(mangaId, mangaChapterId),
        getMyMangaRatingMark(mangaId, mangaChapterId),
      ]);

      if (!mounted) return;

      setIsWatched(watchedRes.exists);
      setIsLiked(likedRes.exists);
      setInWatchlist(watchlistRes.exists);

      if (ratingRes.exists && ratingRes.halfStars != null) {
        const n = clampInt(ratingRes.halfStars, 1, 10);
        setHalfStars(n);
      } else {
        setHalfStars(null);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [mangaId, mangaChapterId, scopeKey]);

  async function toggleWatched() {
    if (!mangaId) {
      setIsWatched((v) => !v);
      return;
    }
    if (watchBusy) return;

    const next = !isWatched;
    setIsWatched(next);
    setWatchBusy(true);

    const { error } = await setMyMangaWatchedMark(mangaId, next, mangaChapterId);
    if (error) setIsWatched(!next);

    setWatchBusy(false);
  }

  async function toggleLiked() {
    if (!mangaId) {
      setIsLiked((v) => !v);
      return;
    }
    if (likeBusy) return;

    const next = !isLiked;
    setIsLiked(next);
    setLikeBusy(true);

    const { error } = await setMyMangaLikedMark(mangaId, next, mangaChapterId);
    if (error) setIsLiked(!next);

    setLikeBusy(false);
  }

  async function toggleWatchlist() {
    if (!mangaId) {
      setInWatchlist((v) => !v);
      return;
    }
    if (watchlistBusy) return;

    const next = !inWatchlist;
    setInWatchlist(next);
    setWatchlistBusy(true);

    const { error } = await setMyMangaWatchlistMark(mangaId, next, mangaChapterId);
    if (error) setInWatchlist(!next);

    setWatchlistBusy(false);
  }

  async function setRatingHalfStars(nextHalfStars: number) {
    const clamped = clampInt(nextHalfStars, 1, 10);
    const nextValue = halfStars === clamped ? null : clamped;

    if (!mangaId) {
      setHalfStars(nextValue);
      return;
    }

    if (ratingBusy) return;

    const prev = halfStars;
    setHalfStars(nextValue);
    setRatingBusy(true);

    const { error } = await setMyMangaRatingMark(mangaId, nextValue, mangaChapterId);
    if (error) setHalfStars(prev);

    setRatingBusy(false);
  }

  return (
    <div className="w-full max-w-[240px] overflow-hidden rounded-md border border-gray-800 bg-[#2b323a] text-gray-200 shadow-sm">
      {/* TOP ACTIONS */}
      <div className="grid grid-cols-3">
        <TopAction
          icon={
            <Eye
              className={[
                "h-5 w-5",
                isWatched ? "text-emerald-400" : "text-gray-300",
                watchBusy ? "opacity-60" : "",
              ].join(" ")}
            />
          }
          label={isWatched ? "Watched" : "Read"}
          pressed={isWatched}
          onClick={toggleWatched}
          disabled={watchBusy}
        />

        <TopAction
          icon={
            <Heart
              className={[
                "h-5 w-5",
                isLiked ? "text-red-400" : "text-gray-300",
                likeBusy ? "opacity-60" : "",
              ].join(" ")}
            />
          }
          label="Like"
          pressed={isLiked}
          onClick={toggleLiked}
          disabled={likeBusy}
        />

        <TopAction
          icon={
            <BookmarkPlus
              className={[
                "h-5 w-5",
                inWatchlist ? "text-sky-400" : "text-gray-300",
                watchlistBusy ? "opacity-60" : "",
              ].join(" ")}
            />
          }
          label="Watchlist"
          pressed={inWatchlist}
          onClick={toggleWatchlist}
          disabled={watchlistBusy}
          hideRightDivider
        />
      </div>

      <Divider />

      {/* RATING (half-star) */}
      <div className="px-4 py-1.5">
        <div className="mb-0.5 text-center text-xs font-semibold text-gray-300">
          {halfStars == null ? "Rate" : "Rated"}
        </div>

        <div className="flex justify-center gap-[6px]">
          {Array.from({ length: 5 }).map((_, i) => {
            const starIndex = i + 1;
            const filled = computeStarFillPercent(shownHalfStars, starIndex);

            return (
              <div
                key={starIndex}
                className="relative"
                onMouseLeave={() => setHoverHalfStars(null)}
              >
                <StarVisual filledPercent={filled} dim={ratingBusy} />

                <button
                  type="button"
                  disabled={ratingBusy}
                  className="absolute inset-y-0 left-0 w-1/2"
                  onMouseEnter={() => setHoverHalfStars(starIndex * 2 - 1)}
                  onFocus={() => setHoverHalfStars(starIndex * 2 - 1)}
                  onClick={() => setRatingHalfStars(starIndex * 2 - 1)}
                  aria-label={`Rate ${starIndex - 0.5} stars`}
                  title={`Rate ${starIndex - 0.5} stars`}
                />

                <button
                  type="button"
                  disabled={ratingBusy}
                  className="absolute inset-y-0 right-0 w-1/2"
                  onMouseEnter={() => setHoverHalfStars(starIndex * 2)}
                  onFocus={() => setHoverHalfStars(starIndex * 2)}
                  onClick={() => setRatingHalfStars(starIndex * 2)}
                  aria-label={`Rate ${starIndex} stars`}
                  title={`Rate ${starIndex} stars`}
                />
              </div>
            );
          })}
        </div>
      </div>

      <Divider />

      {/* ROW 3 */}
      <div className="grid grid-cols-2">
        <HalfRowButton disabled={!onShowActivity} onClick={onShowActivity} left>
          Your Activity
        </HalfRowButton>

        <HalfRowButton onClick={onOpenLog} right emphasis>
          Log / Review
        </HalfRowButton>
      </div>

      <Divider />

      {/* ROW 4 */}
      <div className="flex flex-col">
        <MenuRow center>Share</MenuRow>
      </div>
    </div>
  );
}

/* -------------------- Helpers -------------------- */

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function computeStarFillPercent(shownHalfStars: number, starIndex: number) {
  const starHalfStart = (starIndex - 1) * 2;
  const remaining = shownHalfStars - starHalfStart;

  if (remaining >= 2) return 100 as const;
  if (remaining === 1) return 50 as const;
  return 0 as const;
}

/* -------------------- Subcomponents -------------------- */

function StarVisual({
  filledPercent,
  dim,
}: {
  filledPercent: 0 | 50 | 100;
  dim?: boolean;
}) {
  return (
    <span className={["relative inline-block", dim ? "opacity-60" : ""].join(" ")}>
      <span className="text-[40px] leading-none text-gray-600">★</span>

      {filledPercent > 0 && (
        <span
          className="pointer-events-none absolute left-0 top-0 overflow-hidden text-[40px] leading-none text-emerald-400"
          style={{ width: `${filledPercent}%` }}
        >
          ★
        </span>
      )}
    </span>
  );
}

function TopAction({
  icon,
  label,
  onClick,
  pressed,
  disabled,
  hideRightDivider,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  pressed: boolean;
  disabled?: boolean;
  hideRightDivider?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-pressed={pressed}
      disabled={disabled}
      className={[
        "relative flex flex-col items-center justify-center gap-1 px-2 py-3",
        "text-gray-200",
        disabled
          ? "opacity-70 cursor-not-allowed"
          : "hover:bg-white/5 active:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/10",
      ].join(" ")}
    >
      <div className="opacity-95">{icon}</div>
      <div className="text-[11px] font-medium">{label}</div>

      {!hideRightDivider && (
        <span className="pointer-events-none absolute right-0 top-2 bottom-2 w-px bg-gray-700/60" />
      )}
    </button>
  );
}

function HalfRowButton({
  children,
  onClick,
  disabled,
  emphasis,
  left,
  right,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  emphasis?: boolean;
  left?: boolean;
  right?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={[
        "px-4 py-2 text-center text-[12px] font-medium",
        emphasis ? "text-white" : "text-gray-200",
        disabled
          ? "opacity-60 cursor-not-allowed"
          : "hover:bg-white/5 active:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/10",
        left ? "border-r border-gray-700/60" : "",
        right ? "" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function MenuRow({
  children,
  onClick,
  disabled,
  emphasis,
  center,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  emphasis?: boolean;
  center?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={[
        "w-full px-4 py-2 text-[12px] font-medium",
        center ? "text-center" : "text-left",
        emphasis ? "text-white" : "text-gray-200",
        disabled
          ? "opacity-60 cursor-not-allowed"
          : "hover:bg-white/5 active:bg-white/10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/10",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="h-px bg-gray-700/60" />;
}
