"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { MessageCircle, Heart, Bookmark } from "lucide-react";

const POSTER_W = 72;
const POSTER_H = 108;
const POSTER_GAP = 12;

export type ReviewPostRowProps = {
  postId: string;
  reviewId: string;

  userId: string;
  createdAt: string;

  content: string;
  rating: number | null;
  containsSpoilers?: boolean;

  displayName: string;
  username?: string;
  avatarUrl?: string | null;
  initial: string;

  originLabel?: string;
  originHref?: string;

  // ✅ episode info (THIS IS WHAT WE USE FOR THE EXTENSION)
  episodeLabel?: string;
  episodeHref?: string;

  posterUrl?: string | null;

  href?: string;
  onReplyClick?: (id: string, e: any) => void;
  onToggleLike?: (id: string, e: any) => void;
  onBookmarkClick?: (id: string, e: any) => void;
  onShareClick?: (id: string, e: any) => void;

  isOwner?: boolean;
  replyCount?: number;
  likeCount?: number;
  likedByMe?: boolean;

  onEdit?: (id: string, e: any) => void;
  onDelete?: (id: string, e: any) => void;

  isMenuOpen?: boolean;
  onToggleMenu?: (id: string, e: any) => void;

  onRowClick?: (id: string, e: any) => void;
  disableHoverHighlight?: boolean;

  isMain?: boolean;
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

function renderStars(rating: number): string {
  const fullStars = Math.floor(rating);
  const halfStar = rating - fullStars >= 0.5;

  let result = "★★★★★".slice(0, fullStars);
  if (halfStar && fullStars < 5) result += "½";

  return result.padEnd(5, "☆");
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

function PosterBox({
  url,
  title,
  episodeLabel,
  episodeHref,
}: {
  url?: string | null;
  title: string;
  episodeLabel?: string;
  episodeHref?: string;
}) {
  const [hasError, setHasError] = useState(false);

  const initial =
    title && title.trim().length > 0 ? title.trim().charAt(0).toUpperCase() : "?";

  const showImage = !!url && !hasError;

  const EXT_H = 22; // how far the extension sticks out

  const extensionNode = episodeLabel ? (
    episodeHref ? (
      <Link
        href={episodeHref}
        onClick={(e) => e.stopPropagation()}
        style={{ textDecoration: "none" }}
      >
        <div
          style={{
            height: EXT_H,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.72rem",
            fontWeight: 700,
            color: "#333",
            lineHeight: 1,
          }}
          title={episodeLabel}
        >
          {episodeLabel}
        </div>
      </Link>
    ) : (
      <div
        style={{
          height: EXT_H,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.72rem",
          fontWeight: 700,
          color: "#333",
          lineHeight: 1,
        }}
        title={episodeLabel}
      >
        {episodeLabel}
      </div>
    )
  ) : null;

  return (
    <div
      style={{
        width: POSTER_W,
        flexShrink: 0,
        borderRadius: 6,
        border: "1px solid #11111122",
        background: "#f5f5f5",

        // makes the “background” extend downward
        paddingBottom: episodeLabel ? EXT_H : 0,

        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Poster covers the top portion */}
      <div
        style={{
          width: "100%",
          height: POSTER_H,
          backgroundColor: "#e5e7eb",
          overflow: "hidden",
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
          borderBottomLeftRadius: episodeLabel ? 0 : 6,
          borderBottomRightRadius: episodeLabel ? 0 : 6,
        }}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url as string}
            alt={title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
            onError={() => setHasError(true)}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 600,
              color: "#9ca3af",
            }}
          >
            {initial}
          </div>
        )}
      </div>

      {/* Extension lives inside same wrapper */}
      {episodeLabel && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: EXT_H,
          }}
        >
          {extensionNode}
        </div>
      )}
    </div>
  );
}

export default function ReviewPostRow(props: ReviewPostRowProps) {
  const router = useRouter();
  const [isHovered, setIsHovered] = React.useState(false);

  const {
    postId,
    createdAt,
    content,
    rating,

    displayName,
    username,
    avatarUrl,
    initial,

    originLabel,
    originHref,

    episodeLabel,
    episodeHref,

    posterUrl,

    href,
    onReplyClick,
    onToggleLike,
    onBookmarkClick,
    onShareClick,

    isOwner = false,
    replyCount = 0,
    likeCount = 0,
    likedByMe = false,

    onEdit,
    onDelete,

    isMenuOpen,
    onToggleMenu,

    onRowClick,
    disableHoverHighlight = false,

    isMain = false,
  } = props;

  const iconSize = isMain ? 22 : 20;
  const avatarSize = isMain ? 56 : 46;
  const nameFontSize = isMain ? "1.05rem" : "0.95rem";
  const contentFontSize = isMain ? "1.1rem" : "1rem";

  const animeTitle = originLabel ?? "";
  const stars = rating != null ? renderStars(rating) : "";

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
  const canHighlight = isClickable && !disableHoverHighlight;

  function handleRowClick(e: React.MouseEvent<HTMLDivElement>) {
    if (onRowClick) {
      onRowClick(postId, e);
      return;
    }
    if (href) {
      router.push(href);
    }
  }

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
        // eslint-disable-next-line @next/next/no-img-element
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
      {/* bottom-right edit / delete menu */}
      {isOwner && onToggleMenu && (
        <div
          style={{
            position: "absolute",
            bottom: "1rem",
            right: ".9rem",
            zIndex: 10,
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu(postId, e);
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
                bottom: "1.6rem",
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
                    onEdit(postId, e);
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
                    onDelete(postId, e);
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

      {/* BODY */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.7rem",
          padding: "0.8rem 0.8rem 0.4rem 0.8rem",
        }}
      >
        {/* Avatar */}
        {username ? (
          <Link
            href={`/${username}`}
            onClick={(e) => e.stopPropagation()}
            style={{ display: "inline-block", textDecoration: "none" }}
          >
            {avatarNode}
          </Link>
        ) : (
          avatarNode
        )}

        {/* Content column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Poster floats right */}
          <div style={{ float: "right", marginLeft: POSTER_GAP, marginTop: 2 }}>
            {originHref ? (
              <Link
                href={originHref}
                onClick={(e) => e.stopPropagation()}
                style={{ display: "inline-block" }}
              >
                <PosterBox
                  url={posterUrl}
                  title={animeTitle || "?"}
                  episodeLabel={episodeLabel}
                  episodeHref={episodeHref}
                />
              </Link>
            ) : (
              <PosterBox
                url={posterUrl}
                title={animeTitle || "?"}
                episodeLabel={episodeLabel}
                episodeHref={episodeHref}
              />
            )}
          </div>

          {/* Header row */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: "0.35rem",
              minWidth: 0,
              marginBottom: "0.15rem",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                minWidth: 0,
              }}
            >
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

              <span style={{ color: "#aaa", fontSize: "0.8rem" }}>·</span>

              <small style={{ color: "#777", fontSize: "0.8rem" }}>
                {formatRelativeTime(createdAt)}
              </small>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                minWidth: 0,
                maxWidth: "55%",
              }}
            >
              <span
                style={{
                  fontWeight: 500,
                  color: "#333",
                  fontSize: "0.86rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  width: "100%",
                  textAlign: "right",
                }}
              >
                {animeTitle}
              </span>

              <span
                style={{
                  fontSize: "0.76rem",
                  color: "#777",
                  lineHeight: 1.1,
                }}
              >
                {stars}
              </span>
            </div>
          </div>

          {/* Text */}
          <p
            style={{
              margin: 0,
              fontSize: contentFontSize,
              fontWeight: 400,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {content}
          </p>

          <div style={{ clear: "both" }} />
        </div>
      </div>

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
        <button
          onClick={(e) => {
            e.stopPropagation();
            onReplyClick?.(postId, e);
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
          <MessageCircle width={iconSize} height={iconSize} strokeWidth={1.7} />
          <span style={countStyle}>{replyCount}</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleLike?.(postId, e);
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

        <button
          onClick={(e) => {
            e.stopPropagation();
            onBookmarkClick?.(postId, e);
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

        <button
          onClick={(e) => {
            e.stopPropagation();
            onShareClick?.(postId, e);
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
