"use client";

import React from "react";

type Props = {
  followersCount: number;
  followingCount: number;

  // optional stats
  animeWatchedCount?: number | null;
  mangaReadCount?: number | null;

  onFollowersClick?: () => void;
  onFollowingClick?: () => void;
};

function StatBlock({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick?: () => void;
}) {
  const clickable = typeof onClick === "function";

  const inner = (
    <div className="flex flex-col items-center justify-center leading-none">
      <div className="text-[22px] font-semibold text-white tabular-nums leading-none">
        {value.toLocaleString()}
      </div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80">
        {label}
      </div>
    </div>
  );

  const base = [
    "min-w-[84px] px-5 py-1.5",
    "flex items-center justify-center",
    "transition-colors",
  ].join(" ");

  if (!clickable) return <div className={base}>{inner}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        base,
        "group",
        "hover:bg-white/6 active:bg-white/10",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-0",
      ].join(" ")}
    >
      <div className="group-hover:opacity-95">{inner}</div>
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
  const blocks: Array<React.ReactNode> = [];

  // 1️⃣ Followers (left-most)
  blocks.push(
    <StatBlock
      key="followers"
      label="Followers"
      value={followersCount}
      onClick={onFollowersClick}
    />
  );

  // 2️⃣ Following
  blocks.push(
    <StatBlock
      key="following"
      label="Following"
      value={followingCount}
      onClick={onFollowingClick}
    />
  );

  // 3️⃣ Episodes
  if (typeof animeWatchedCount === "number") {
    blocks.push(
      <StatBlock
        key="episodes"
        label="Episodes"
        value={animeWatchedCount}
      />
    );
  }

  // 4️⃣ Chapters
  if (typeof mangaReadCount === "number") {
    blocks.push(
      <StatBlock
        key="chapters"
        label="Chapters"
        value={mangaReadCount}
      />
    );
  }

  return (
    <div className="w-full">
      <div
        className={[
          "inline-flex items-stretch overflow-hidden",
          "rounded-md",
          "bg-black/90 backdrop-blur-md",
          "ring-1 ring-white/10",
          "divide-x divide-white/12",
          "shadow-sm shadow-black/30",
        ].join(" ")}
      >
        {blocks}
      </div>
    </div>
  );
}