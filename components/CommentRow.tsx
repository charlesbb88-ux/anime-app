"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import ActionRow from "./ActionRow";
import RichPostRenderer from "@/components/composer/RichPostRenderer";
import PostAttachments from "@/components/composer/PostAttachments";

export type CommentRowProps = {
  id: string;
  userId: string;
  createdAt: string;
  content: string;

  // ✅ NEW: renderer inputs (prefer these if provided)
  contentText?: string | null;
  contentJson?: any | null;
  // ✅ NEW: attachments for this post
  attachments?: any[];

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

  // main origin pill (anime series) under username
  originLabel?: string;
  originHref?: string;

  // secondary pill for episode
  episodeLabel?: string;
  episodeHref?: string;
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

export default function CommentRow(props: CommentRowProps) {
  const router = useRouter();
  const [isHovered, setIsHovered] = React.useState(false);

  const {
    id,
    createdAt,
    content,
    attachments,
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
    originLabel,
    originHref,
    episodeLabel,
    episodeHref,
  } = props;

  const iconSize = isMain ? 22 : 20;
  const avatarSize = isMain ? 56 : 46;
  const nameFontSize = isMain ? "1.05rem" : "0.95rem";
  const contentFontSize = isMain ? "1.1rem" : "1rem";
  const contentFontWeight = 400;

  // Base pill style (no hover baked in)
  const baseOriginPillStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: ".8px 6px",
    borderRadius: 999,
    fontSize: "0.76rem",
    fontWeight: 500,
    background: "#fefeffff",
    border: "1.5px solid #abb3f0ff",
    color: "#6d7ae0",
    maxWidth: "100%",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    cursor: "default",
    transition:
      "background 0.12s ease, border-color 0.12s ease, color 0.12s ease",
  };

  const originPillStyle: React.CSSProperties = {
    ...baseOriginPillStyle,
    cursor: originHref ? "pointer" : "default",
  };

  const episodePillStyle: React.CSSProperties = {
    ...baseOriginPillStyle,
    cursor: episodeHref ? "pointer" : "default",
  };

  const isClickable = !!(href || onRowClick);

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
      {/* Avatar: clickable to profile if we have a username */}
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
            flexDirection: "column",
            gap: "0.1rem",
            marginBottom: "0.15rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            {/* display name / handle */}
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

          {/* Series + Episode pills under username */}
          {(originLabel || episodeLabel) && (
            <div
              style={{
                marginTop: "1px",
                marginLeft: "-4px",
                display: "flex",
                gap: "4px",
                flexWrap: "wrap",
              }}
            >
              {originLabel &&
                (originHref ? (
                  <Link
                    href={originHref}
                    onClick={(e) => e.stopPropagation()}
                    style={originPillStyle}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLAnchorElement;
                      el.style.background = "#e1e4ff";
                      el.style.borderColor = "#5a69d4";
                      el.style.color = "#5a69d4";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLAnchorElement;
                      el.style.background = "#fefeffff";
                      el.style.borderColor = "#abb3f0ff";
                      el.style.color = "#6d7ae0";
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {originLabel}
                    </span>
                  </Link>
                ) : (
                  <span
                    style={originPillStyle}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLSpanElement;
                      el.style.background = "#e1e4ff";
                      el.style.borderColor = "#5a69d4";
                      el.style.color = "#5a69d4";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLSpanElement;
                      el.style.background = "#fefeffff";
                      el.style.borderColor = "#abb3f0ff";
                      el.style.color = "#6d7ae0";
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {originLabel}
                    </span>
                  </span>
                ))}

              {episodeLabel &&
                (episodeHref ? (
                  <Link
                    href={episodeHref}
                    onClick={(e) => e.stopPropagation()}
                    style={episodePillStyle}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLAnchorElement;
                      el.style.background = "#e1e4ff";
                      el.style.borderColor = "#5a69d4";
                      el.style.color = "#5a69d4";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLAnchorElement;
                      el.style.background = "#fefeffff";
                      el.style.borderColor = "#abb3f0ff";
                      el.style.color = "#6d7ae0";
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {episodeLabel}
                    </span>
                  </Link>
                ) : (
                  <span
                    style={episodePillStyle}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLSpanElement;
                      el.style.background = "#e1e4ff";
                      el.style.borderColor = "#5a69d4";
                      el.style.color = "#5a69d4";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLSpanElement;
                      el.style.background = "#fefeffff";
                      el.style.borderColor = "#abb3f0ff";
                      el.style.color = "#6d7ae0";
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {episodeLabel}
                    </span>
                  </span>
                ))}
            </div>
          )}
        </div>

        <RichPostRenderer
          json={props.contentJson ?? null}
          fallbackText={props.contentText ?? content}
          fontSize={contentFontSize}
          fontWeight={contentFontWeight}
          lineHeight={1.5}
        />
        {(props.attachments?.length ?? 0) > 0 ? (
          <div style={{ marginTop: 10 }}>
            <PostAttachments items={props.attachments as any} />
          </div>
        ) : null}
      </div>
    </div>
  );

  const canHighlight = isClickable && !disableHoverHighlight;

  return (
    <div
      style={{
        position: "relative",
        border: "1px solid #000",
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
        <div className="absolute bottom-[0.4rem] right-[0.4rem] z-10 md:bottom-[0.7rem] bottom-[-0.3rem]">
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
                bottom: "1.6rem",
                right: 0,
                background: "#fff",
                border: "1px solid #000",
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
                    borderTop: "1px solid #000",
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

      <ActionRow
        variant={isMain ? "main" : "feed"}
        iconSize={iconSize}
        replyCount={replyCount}
        likeCount={likeCount}
        likedByMe={likedByMe}
        onReply={(e: React.MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          onReplyClick?.(id, e);
        }}
        onLike={(e: React.MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          onToggleLike?.(id, e);
        }}
        sharePath={`/posts/${id}`}
      />
    </div>
  );
}
