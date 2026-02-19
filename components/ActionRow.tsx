"use client";

import React from "react";
import { MessageCircle, Heart } from "lucide-react";
import ShareButton from "@/components/buttons/ShareButton";

export type ActionRowVariant = "feed" | "main";

type Props = {
  variant?: ActionRowVariant;

  iconSize: number;
  replyCount?: number;
  likeCount?: number;
  likedByMe?: boolean;

  onReply?: (e: any) => void;
  onLike?: (e: any) => void;

  // ✅ NEW: if provided, show the Share button
  sharePath?: string;
};

export default function ActionRow({
  variant = "feed",
  iconSize,
  replyCount = 0,
  likeCount = 0,
  likedByMe = false,
  onReply,
  onLike,
  sharePath,
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
          color: likedByMe ? "#f91880" : "#555",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.color = "#f91880";
          e.currentTarget.style.background = "#f918801a";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.color = likedByMe ? "#f91880" : "#555";
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

      {/* ✅ Share */}
      {sharePath ? (
        <ShareButton iconSize={iconSize} path={sharePath} />
      ) : (
        <div />
      )}
    </div>
  );
}
