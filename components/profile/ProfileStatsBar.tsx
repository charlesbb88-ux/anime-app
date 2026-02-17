"use client";

import React from "react";

type Props = {
  followersCount: number;
  followingCount: number;

  // optional future stats
  animeWatchedCount?: number | null;
  mangaReadCount?: number | null;

  onFollowersClick?: () => void;
  onFollowingClick?: () => void;
};

function StatPill({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick?: () => void;
}) {
  const clickable = typeof onClick === "function";

  const className = [
    "h-10 px-3 rounded-xl",
    "bg-white ring-1 ring-slate-200",
    "flex items-center gap-2",
    clickable ? "cursor-pointer hover:bg-slate-50 active:bg-slate-100" : "",
  ].join(" ");

  const content = (
    <>
      <span className="text-sm font-semibold text-slate-900 tabular-nums">{value}</span>
      <span className="text-sm text-slate-500">{label}</span>
    </>
  );

  if (!clickable) return <div className={className}>{content}</div>;

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

export default function ProfileStatsBar({
  followersCount,
  followingCount,
  animeWatchedCount,
  mangaReadCount,
  onFollowersClick,
  onFollowingClick,
}: Props) {
  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2">
        <StatPill label="Followers" value={followersCount} onClick={onFollowersClick} />
        <StatPill label="Following" value={followingCount} onClick={onFollowingClick} />

        {/* Future stats (only render if provided) */}
        {typeof animeWatchedCount === "number" ? (
          <StatPill label="Anime watched" value={animeWatchedCount} />
        ) : null}

        {typeof mangaReadCount === "number" ? (
          <StatPill label="Manga read" value={mangaReadCount} />
        ) : null}
      </div>
    </div>
  );
}