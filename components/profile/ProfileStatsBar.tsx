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

  // ✅ NEW: controls sizing (padding, fonts, etc.)
  size?: "desktop" | "phone";
};

type SizeCfg = {
  // per-block
  minw: string;
  px: string;
  py: string;

  // typography
  valueText: string; // number
  labelText: string; // label

  labelMt: string;
  labelTracking: string;

  // container chrome
  radius: string;
  divider: string;

  // optional: tighten hitbox + alignment
  leading: string;
};

const SIZE: Record<NonNullable<Props["size"]>, SizeCfg> = {
  desktop: {
    minw: "min-w-[84px]",
    px: "px-5",
    py: "py-1.5",
    valueText: "text-[22px]",
    labelText: "text-[10px]",
    labelMt: "mt-1",
    labelTracking: "tracking-[0.22em]",
    radius: "rounded-md",
    divider: "divide-x divide-white/12",
    leading: "leading-none",
  },
  phone: {
    // ✅ PHONE KNOBS (tweak these freely)
    minw: "min-w-[60px]",
    px: "px-1",
    py: "py-1",
    valueText: "text-[15px]",
    labelText: "text-[8px]",
    labelMt: "mt-0.5",
    labelTracking: "tracking-[0.18em]",
    radius: "rounded-md", // you can do rounded-sm if you want
    divider: "divide-x divide-white/12",
    leading: "leading-none",
  },
};

function StatBlock({
  label,
  value,
  onClick,
  cfg,
}: {
  label: string;
  value: number;
  onClick?: () => void;
  cfg: SizeCfg;
}) {
  const clickable = typeof onClick === "function";

  const inner = (
    <div className={`flex flex-col items-center justify-center ${cfg.leading}`}>
      <div className={`${cfg.valueText} font-semibold text-white tabular-nums ${cfg.leading}`}>
        {value.toLocaleString()}
      </div>
      <div
        className={`${cfg.labelMt} ${cfg.labelText} font-semibold uppercase ${cfg.labelTracking} text-white/80`}
      >
        {label}
      </div>
    </div>
  );

  const base = [
    cfg.minw,
    cfg.px,
    cfg.py,
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
  size = "desktop",
  followersCount,
  followingCount,
  animeWatchedCount,
  mangaReadCount,
  onFollowersClick,
  onFollowingClick,
}: Props) {
  const cfg = SIZE[size];

  const blocks: Array<React.ReactNode> = [];

  blocks.push(
    <StatBlock
      key="followers"
      label="Followers"
      value={followersCount}
      onClick={onFollowersClick}
      cfg={cfg}
    />
  );

  blocks.push(
    <StatBlock
      key="following"
      label="Following"
      value={followingCount}
      onClick={onFollowingClick}
      cfg={cfg}
    />
  );

  if (typeof animeWatchedCount === "number") {
    blocks.push(<StatBlock key="episodes" label="Episodes" value={animeWatchedCount} cfg={cfg} />);
  }

  if (typeof mangaReadCount === "number") {
    blocks.push(<StatBlock key="chapters" label="Chapters" value={mangaReadCount} cfg={cfg} />);
  }

  return (
    <div className="w-full">
      <div
        className={[
          "inline-flex items-stretch overflow-hidden",
          cfg.radius,
          "bg-black/90 backdrop-blur-md",
          "ring-1 ring-white/10",
          cfg.divider,
          "shadow-sm shadow-black/30",
        ].join(" ")}
      >
        {blocks}
      </div>
    </div>
  );
}