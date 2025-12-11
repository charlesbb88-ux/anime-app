"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { MessageCircle, Heart, Bookmark } from "lucide-react";

export type CommentRowProps = {
  id: string;
  userId: string;
  createdAt: string;
  content: string;

  displayName: string; // e.g. "@charles"
  initial: string;

  // canonical handle (lowercase, no @) for profile link
  username?: string;

  // avatar URL (if we have it)
  avatarUrl?: string | null;

  isMain?: boolean;
  isOwner?: boolean;
  replyCount?: number;
  likeCount?: number;
  likedByMe?: boolean;

  href?: string;
  onReplyClick?: (id: string, e: any) => void;
  onToggleLike?: (id: string, e: any) => void;
  onBookmarkClick?: (id: string, e: any) => void;
  onShareClick?: (id: string, e: any) => void;

  onEdit?: (id: string, e: any) => void;
  onDelete?: (id: string, e: any) => void;

  isMenuOpen?: boolean;
  onToggleMenu?: (id: string, e: any) => void;

  // whole-row click (like Twitter opening the detail page)
  onRowClick?: (id: string, e: any) => void;

  // let pages force-disable the hover highlight even if clickable
  disableHoverHighlight?: boolean;
};

function formatRelativeTime(dateString: string) {
  const target = new Date(dateString).getTime();
  if (Number.isNaN(target)) return "";

  const now = Date.now();
  const diff = Math.max(0, now - target);

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return `${seconds || 1}s`;
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  if (weeks < 4) return `${weeks}w`;
  if (months < 12) return `${months}mo`;
  return `${years}y`;
}

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

export default function CommentRow(props: CommentRowProps) {
  const router = useRouter();

  const {
    id,
    createdAt,
    content,
    displayName,
    initial,
    username,
    avatarUrl,
    isMain = false,
    isOwner = false,
    replyCount = 0,
    likeCount = 0,
    likedByMe = false,
    href,
    onReplyClick,
    onToggleLike,
    onBookmarkClick,
    onShareClick,
    onEdit,
    onDelete,
    isMenuOpen,
    onToggleMenu,
    onRowClick,
    disableHoverHighlight = false,
  } = props;

  const iconSize = isMain ? 22 : 20;
  const avatarSize = isMain ? 56 : 46;
  const nameFontSize = isMain ? "1.05rem" : "0.95rem";
  const contentFontSize = isMain ? "1.1rem" : "1rem";
  const contentFontWeight = 400;

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

  const isClickable = !!(href || onRowClick);
  const [isHovered, setIsHovered] = React.useState(false);

  function handleRowClick(e: React.MouseEvent<HTMLDivElement>) {
    if (onRowClick) {
      onRowClick(id, e);
    } else if (href) {
      router.push(href);
    }
  }

  // Avatar node (used raw or wrapped in a Link)
  const avatarNode = (
    <div
      style={{
        width: avatarSize,
        height: avatarSize,
        borderRadius: "999px",
        background: "#e5e5e5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: isMain ? "1.05rem" : "0.95rem",
        fontWeight: 600,
        color: "#333",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );

  const body = (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.7rem",
        padding: "0.8rem 0.8rem 0.4rem 0.8rem",
      }}
    >
      {/* Avatar: now clickable to profile if we have a username */}
      {username ? (
        <Link
          href={`/${username}`}
          onClick={(e) => e.stopPropagation()}
          style={{
            display: "inline-block",
            textDecoration: "none",
          }}
        >
          {avatarNode}
        </Link>
      ) : (
        avatarNode
      )}

      <div style={{ flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            marginBottom: "0.15rem",
          }}
        >
          {/* clickable display name if we have a handle */}
          {username ? (
            <Link
              href={`/${username}`}
              onClick={(e) => e.stopPropagation()}
              style={{
                fontSize: nameFontSize,
                fontWeight: 500,
                color: "#333",
                textDecoration: "none",
              }}
            >
              {displayName}
            </Link>
          ) : (
            <span
              style={{
                fontSize: nameFontSize,
                fontWeight: 500,
                color: "#333",
              }}
            >
              {displayName}
            </span>
          )}

          <span
            style={{
              color: "#aaa",
              fontSize: "0.8rem",
            }}
          >
            ·
          </span>
          <small
            style={{
              color: "#777",
              fontSize: "0.8rem",
            }}
          >
            {formatRelativeTime(createdAt)}
          </small>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: contentFontSize,
            fontWeight: contentFontWeight,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {content}
        </p>
      </div>
    </div>
  );

  const canHighlight = isClickable && !disableHoverHighlight;

  return (
    <div
      style={{
        position: "relative",
        border: "1px solid #11111111",
        borderRadius: 0,
        background: canHighlight && isHovered ? "#f7f9fb" : "#ffffff",
        cursor: isClickable ? "pointer" : "default",
        transition: "background 0.12s ease",
      }}
      onClick={handleRowClick}
      onMouseEnter={() => {
        if (canHighlight) setIsHovered(true);
      }}
      onMouseLeave={() => {
        if (canHighlight) setIsHovered(false);
      }}
    >
      {/* top-right edit / delete menu */}
      {isOwner && onToggleMenu && (
        <div
          style={{
            position: "absolute",
            top: "0.6rem",
            right: "0.5rem",
            zIndex: 10,
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu(id, e);
            }}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: "0 0.3rem",
              fontSize: "1.2rem",
              lineHeight: 1,
              color: "#555",
            }}
          >
            ⋯
          </button>

          {isMenuOpen && (
            <div
              style={{
                position: "absolute",
                top: "1.6rem",
                right: 0,
                background: "#fff",
                border: "1px solid #ddd",
                borderRadius: "4px",
                boxShadow: "0 2px 6px rgba(0, 0, 0, 0.08)",
                minWidth: "130px",
                zIndex: 20,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(id, e);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "0.45rem 0.7rem",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    color: "#333",
                  }}
                >
                  Edit
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(id, e);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "0.45rem 0.7rem",
                    borderTop: "1px solid #eee",
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    color: "#b00000",
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {body}

      {/* Action bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: "90%",
          padding: "0.4rem 0 0.8rem 3.4rem",
          marginLeft: ".3rem",
          marginRight: "auto",
        }}
      >
        {/* Reply */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onReplyClick?.(id, e);
          }}
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
          <MessageCircle
            width={iconSize}
            height={iconSize}
            strokeWidth={1.7}
          />
          <span style={countStyle}>{replyCount}</span>
        </button>

        {/* Like */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleLike?.(id, e);
          }}
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

        {/* Bookmark */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBookmarkClick?.(id, e);
          }}
          style={iconButtonBase}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.color = "#00ba7c";
            e.currentTarget.style.background = "#00ba7c1a";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.color = "#555";
            e.currentTarget.style.background = "transparent";
          }}
        >
          <Bookmark width={iconSize} height={iconSize} strokeWidth={1.7} />
        </button>

        {/* Share */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShareClick?.(id, e);
          }}
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
    </div>
  );
}
