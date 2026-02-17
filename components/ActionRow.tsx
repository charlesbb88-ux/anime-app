"use client";

import React from "react";
import { MessageCircle, Heart } from "lucide-react";

function ShareArrowIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2v13" />
      <path d="m16 6-4-4-4 4" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    </svg>
  );
}

export type ActionRowVariant = "feed" | "main";

type Props = {
  variant?: ActionRowVariant;

  iconSize: number;
  replyCount?: number;
  likeCount?: number;
  likedByMe?: boolean;

  onReply?: (e: any) => void;
  onLike?: (e: any) => void;
  onShare?: (e: any) => void;
};

export default function ActionRow({
  variant = "feed",
  iconSize,
  replyCount = 0,
  likeCount = 0,
  likedByMe = false,
  onReply,
  onLike,
  onShare,
}: Props) {
  const isMain = variant === "main";

  const iconButtonBase: React.CSSProperties = {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: "6px",
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.12s ease, transform 0.12s ease, color 0.12s ease",
    color: "#555",
  };

  const countStyle: React.CSSProperties = {
    fontSize: "0.9rem",
    color: "inherit",
  };

  const actionSlotStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "0.35rem",
    minWidth: 0,
  };

  const barStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    maxWidth: "90%",
    padding: isMain ? "0.1rem 0 0.4rem 2rem" : "0.05rem 0 0.35rem 2rem",
    marginLeft: ".3rem",
    marginRight: "auto",
  };

  return (
    <div style={barStyle}>
      {/* Reply */}
      <button
        onClick={onReply}
        style={{
          ...iconButtonBase,
          ...actionSlotStyle,
          padding: "6px 10px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.color = "#1d9bf0";
          e.currentTarget.style.background = "#1d9bf01a";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.color = "#555";
          e.currentTarget.style.background = "transparent";
        }}
      >
        <MessageCircle width={iconSize} height={iconSize} strokeWidth={1.7} />
        <span style={countStyle}>{replyCount}</span>
      </button>

      {/* Like */}
      <button
        onClick={onLike}
        style={{
          ...iconButtonBase,
          ...actionSlotStyle,
          padding: "6px 10px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.color = "#f91880";
          e.currentTarget.style.background = "#f918801a";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.color = "#555";
          e.currentTarget.style.background = "transparent";
        }}
      >
        <Heart
          width={iconSize}
          height={iconSize}
          strokeWidth={1.7}
          fill={likedByMe ? "currentColor" : "none"}
        />
        <span style={countStyle}>{likeCount}</span>
      </button>

      {/* Share */}
      <button
        onClick={onShare}
        style={iconButtonBase}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.color = "#1d9bf0";
          e.currentTarget.style.background = "#1d9bf01a";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.color = "#555";
          e.currentTarget.style.background = "transparent";
        }}
      >
        <ShareArrowIcon size={iconSize} />
      </button>
    </div>
  );
}
