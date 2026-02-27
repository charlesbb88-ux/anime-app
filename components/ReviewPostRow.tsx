"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Heart } from "lucide-react";
import ActionRow from "./ActionRow";
import RichPostRenderer from "@/components/composer/RichPostRenderer";
import PostAttachments from "@/components/composer/PostAttachments";

const POSTER_W = 72;
const POSTER_H = 108;
const POSTER_GAP = 12;

export type ReviewPostRowProps = {
  postId: string;
  reviewId: string;

  userId: string;
  createdAt: string;

  content: string;

  // ✅ NEW: renderer inputs (prefer these if provided)
  contentText?: string | null;
  contentJson?: any | null;

  // ✅ NEW: attachments for this post
  attachments?: any[];

  rating: number | null; // reviews.rating: 0..100 (or null)
  containsSpoilers?: boolean;

  // ✅ author-like snapshot from reviews.author_liked
  authorLiked?: boolean;

  displayName: string;
  username?: string;
  avatarUrl?: string | null;
  initial: string;

  originLabel?: string;
  originHref?: string;

  // ✅ episode info (extension label)
  episodeLabel?: string;
  episodeHref?: string;

  // ✅ manga chapter parity
  chapterLabel?: string;
  chapterHref?: string;

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

/* -------------------- Stars (NO placeholder/backing row) -------------------- */

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

// reviews.rating is 0..100 -> halfStars 0..10 (0.5 steps)
function rating100ToHalfStars(rating100: number): number {
  const r = Math.max(0, Math.min(100, rating100));
  return clampInt((r / 100) * 10, 0, 10);
}

// halfStars is 0..10
// starIndex is 1..5
// returns 0, 50, or 100
function computeStarFillPercent(shownHalfStars: number, starIndex: number) {
  const starHalfStart = (starIndex - 1) * 2; // 0,2,4,6,8
  const remaining = shownHalfStars - starHalfStart;

  if (remaining >= 2) return 100 as const;
  if (remaining === 1) return 50 as const;
  return 0 as const;
}

function ReviewStarsRow({
  halfStars,
  size = 14,
}: {
  halfStars: number;
  size?: number;
}) {
  const hs = clampInt(halfStars, 0, 10);

  const nodes: React.ReactNode[] = [];
  for (let i = 1; i <= 5; i++) {
    const fill = computeStarFillPercent(hs, i);
    if (fill === 0) continue;

    nodes.push(
      <span
        key={i}
        className="relative inline-block align-middle"
        style={{ width: size, height: size }}
      >
        <span
          className="absolute left-0 top-0 leading-none text-emerald-500"
          style={{
            fontSize: size,
            lineHeight: `${size}px`,
            display: "block",
          }}
          aria-hidden="true"
        >
          <span
            style={{
              display: "block",
              width: fill === 100 ? "100%" : "50%",
              overflow: "hidden",
            }}
          >
            ★
          </span>
        </span>
      </span>
    );
  }

  if (nodes.length === 0) return null;

  return (
    <span
      className="inline-flex items-center gap-[2px]"
      aria-label={`${hs / 2} stars`}
    >
      {nodes}
    </span>
  );
}

/* -------------------- Poster box -------------------- */

function PosterBox({
  url,
  title,
  episodeLabel,
  episodeHref,
  chapterLabel,
  chapterHref,
}: {
  url?: string | null;
  title: string;
  episodeLabel?: string;
  episodeHref?: string;
  chapterLabel?: string;
  chapterHref?: string;
}) {
  const [hasError, setHasError] = useState(false);

  const initial =
    title && title.trim().length > 0 ? title.trim().charAt(0).toUpperCase() : "?";

  const showImage = !!url && !hasError;

  const EXT_H = 22;

  const extLabel = episodeLabel ?? chapterLabel;
  const extHref = episodeHref ?? chapterHref;

  const extensionNode = extLabel ? (
    extHref ? (
      <Link
        href={extHref}
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
          title={extLabel}
        >
          {extLabel}
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
        title={extLabel}
      >
        {extLabel}
      </div>
    )
  ) : null;

  return (
    <div
      style={{
        width: POSTER_W,
        flexShrink: 0,
        borderRadius: 6,
        border: "1px solid #000",
        background: "#f5f5f5",
        paddingBottom: extLabel ? EXT_H : 0,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "100%",
          height: POSTER_H,
          backgroundColor: "#e5e7eb",
          overflow: "hidden",
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
          borderBottomLeftRadius: extLabel ? 0 : 6,
          borderBottomRightRadius: extLabel ? 0 : 6,
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

      {extLabel && (
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
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth <= 767);
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const [isHovered, setIsHovered] = React.useState(false);

  const {
    postId,
    createdAt,
    content,
    attachments,
    rating,
    containsSpoilers = false,

    authorLiked = false,

    displayName,
    username,
    avatarUrl,
    initial,

    originLabel,
    originHref,

    episodeLabel,
    episodeHref,

    chapterLabel,
    chapterHref,

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

  const title = originLabel ?? "";
  const halfStarsForReview = rating != null ? rating100ToHalfStars(rating) : null;

  const isClickable = !!(href || onRowClick);
  const canHighlight = isClickable && !disableHoverHighlight;

  function handleRowClick(e: React.MouseEvent<HTMLDivElement>) {
    if (onRowClick) {
      onRowClick(postId, e);
      return;
    }
    if (href) router.push(href);
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
            aria-label="Open menu"
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

      {/* BODY */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: isMobile ? "0.2rem" : "0.7rem",
          padding: isMobile
            ? "0.3rem 0.3rem 0.1rem 0.3rem"
            : "0.8rem 0.8rem 0.4rem 0.8rem",
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
          <div
            style={{
              float: "right",
              marginLeft: isMobile ? 3 : POSTER_GAP,
              marginTop: isMobile ? 0 : 2,
            }}
          >
            {originHref ? (
              <Link
                href={originHref}
                onClick={(e) => e.stopPropagation()}
                style={{ display: "inline-block" }}
              >
                <PosterBox
                  url={posterUrl}
                  title={title || "?"}
                  episodeLabel={episodeLabel}
                  episodeHref={episodeHref}
                  chapterLabel={chapterLabel}
                  chapterHref={chapterHref}
                />
              </Link>
            ) : (
              <PosterBox
                url={posterUrl}
                title={title || "?"}
                episodeLabel={episodeLabel}
                episodeHref={episodeHref}
                chapterLabel={chapterLabel}
                chapterHref={chapterHref}
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

              {containsSpoilers ? (
                <>
                  <span style={{ color: "#aaa", fontSize: "0.8rem" }}>·</span>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      color: "#b45309",
                      background: "#fffbeb",
                      border: "1px solid #fcd34d",
                      padding: "1px 6px",
                      borderRadius: 999,
                      lineHeight: 1.4,
                    }}
                  >
                    Spoilers
                  </span>
                </>
              ) : null}
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
                {title}
              </span>

              {/* Stars + author-like snapshot */}
              <div
                style={{
                  marginTop: 2,
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {authorLiked ? (
                  <Heart
                    width={14}
                    height={14}
                    strokeWidth={1.7}
                    fill="currentColor"
                    style={{ color: "#f91880" }}
                    aria-label="Author liked"
                  />
                ) : null}

                {halfStarsForReview != null ? (
                  <ReviewStarsRow halfStars={halfStarsForReview} size={14} />
                ) : null}
              </div>
            </div>
          </div>

          {/* Text */}
          <RichPostRenderer
            json={props.contentJson ?? null}
            fallbackText={props.contentText ?? content}
            fontSize={contentFontSize}
            fontWeight={400}
            lineHeight={1.5}
          />
          {(props.attachments?.length ?? 0) > 0 ? (
            <div style={{ marginTop: 10 }}>
              <PostAttachments items={props.attachments as any} />
            </div>
          ) : null}

          <div style={{ clear: "both" }} />
        </div>
      </div>

      <ActionRow
        variant={isMain ? "main" : "feed"}
        iconSize={iconSize}
        replyCount={replyCount}
        likeCount={likeCount}
        likedByMe={likedByMe}
        onReply={(e: React.MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          onReplyClick?.(postId, e);
        }}
        onLike={(e: React.MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          onToggleLike?.(postId, e);
        }}
        sharePath={`/posts/${postId}`}
      />
    </div>
  );
}
