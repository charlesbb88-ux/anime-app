"use client";

import React, { useState } from "react";
import CommentRow from "../components/CommentRow";
import { MessageCircle, Heart, Bookmark } from "lucide-react";

const AVATAR_SIZE = 46; // match CommentRow non-main avatar size

const POSTER_W = 72;
const POSTER_H = 108;
const POSTER_GAP = 12;

type ReviewLayout = "posterRightMirror";

type ReviewMock = {
  id: string;
  userId: string;
  createdAt: string;
  content: string;
  animeTitle: string;
  animeYear: string;
  posterUrl: string;
  rating: number; // 0–5
  layout: ReviewLayout;
  layoutLabel: string; // kept in data, but not rendered
  relativeTime: string;
  replyCount: number;
  likeCount: number;
  likedByMe: boolean;
  isOwner?: boolean;
  isMain?: boolean;
};

type FeedItem =
  | { kind: "comment"; index: number }
  | { kind: "review"; index: number };

export default function TestCommentPage() {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const now = Date.now();

  // ===========================
  // Normal mock comments (UNTOUCHED)
  // ===========================
  const mockComments = [
    {
      id: "c-seconds",
      userId: "user-secs",
      createdAt: new Date(now - 15 * 1000).toISOString(),
      label: "Seconds ago",
      content:
        "This comment simulates something that just happened seconds ago. Should show something like 5s / 15s depending on when you load.",
      replyCount: 1,
      likeCount: 0,
      likedByMe: false,
      isOwner: true,
      isMain: false,
    },
    {
      id: "c-minutes",
      userId: "user-mins",
      createdAt: new Date(now - 12 * 60 * 1000).toISOString(),
      label: "Minutes ago",
      content:
        "This one is from several minutes ago. You should see an m label (something like 12m).",
      replyCount: 2,
      likeCount: 3,
      likedByMe: false,
      isOwner: false,
      isMain: false,
    },
    {
      id: "c-hours",
      userId: "user-hrs",
      createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      label: "Hours ago",
      content:
        "Now we’re in the hours range. This one should show something like 3h.",
      replyCount: 0,
      likeCount: 5,
      likedByMe: true,
      isOwner: false,
      isMain: true,
    },
    {
      id: "c-days",
      userId: "user-days",
      createdAt: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString(),
      label: "Days ago",
      content:
        "This comment is several days old. It should show 4d (or similar).",
      replyCount: 1,
      likeCount: 1,
      likedByMe: false,
      isOwner: false,
      isMain: false,
    },
    {
      id: "c-weeks",
      userId: "user-weeks",
      createdAt: new Date(now - 3 * 7 * 24 * 60 * 60 * 1000).toISOString(),
      label: "Weeks ago",
      content:
        "This one is a few weeks old. You should see something like 3w.",
      replyCount: 4,
      likeCount: 8,
      likedByMe: false,
      isOwner: false,
      isMain: false,
    },
    {
      id: "c-months",
      userId: "user-months",
      createdAt: new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString(),
      label: "Months ago",
      content:
        "Around a couple of months old. This should switch to a calendar date like Oct 5.",
      replyCount: 0,
      likeCount: 2,
      likedByMe: false,
      isOwner: false,
      isMain: false,
    },
    {
      id: "c-years",
      userId: "user-years",
      createdAt: new Date(
        now - 2 * 365 * 24 * 60 * 60 * 1000
      ).toISOString(),
      label: "Years ago",
      content:
        "This is simulating an ancient comment. Here you should see a date with a year like Oct 5, 2022.",
      replyCount: 9,
      likeCount: 20,
      likedByMe: false,
      isOwner: false,
      isMain: false,
    },
  ];

  // ===========================
  // Reviews
  // ===========================
  const mockReviews = [
    {
      id: "r-poster-right-mirror-1",
      userId: "user-review-1",
      createdAt: new Date(now - 45 * 60 * 1000).toISOString(),
      relativeTime: "45m",
      layout: "posterRightMirror",
      layoutLabel:
        "Layout: Poster mirrored on the right (anime title mirrored to username) (kept)",
      animeTitle: "Frieren: Beyond Journey’s End",
      animeYear: "2023",
      posterUrl:
        "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-eJZEVRDsWZ0z.png",
      rating: 5,
      content:
        "Peak comfy fantasy. It somehow makes quiet moments hit harder than most big battle scenes in other shows.",
      replyCount: 5,
      likeCount: 32,
      likedByMe: true,
    },
    {
      id: "r-poster-right-mirror-2",
      userId: "user-review-2",
      createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      relativeTime: "2h",
      layout: "posterRightMirror",
      layoutLabel:
        "Layout: Poster mirrored on the right (anime title mirrored to username) (kept)",
      animeTitle: "Kaguya-sama: Love is War",
      animeYear: "2019",
      posterUrl:
        "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101921-QmPBRDsoZqpF.png",
      rating: 4.5,
      content:
        "Every episode is two geniuses trying to lose in the most entertaining way possible. Comedy is insanely tight.",
      replyCount: 4,
      likeCount: 41,
      likedByMe: false,
    },
    {
      id: "r-poster-right-mirror-3",
      userId: "user-review-3",
      createdAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
      relativeTime: "5h",
      layout: "posterRightMirror",
      layoutLabel:
        "Layout: Poster mirrored on the right (anime title mirrored to username) (kept)",
      animeTitle: "Jujutsu Kaisen",
      animeYear: "2020",
      posterUrl:
        "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-LsovB6yM3K6n.png",
      rating: 4,
      content:
        "Combat animation is insane. Story gets a little tangled, but the vibe is so strong you kind of don’t care.",
      replyCount: 2,
      likeCount: 19,
      likedByMe: false,
    },
  ] as ReviewMock[];

  function getDisplayName(userId: string) {
    return `User-${userId.slice(0, 4)}`;
  }

  function getInitial(userId: string) {
    return getDisplayName(userId).charAt(0).toUpperCase();
  }

  const feed: FeedItem[] = [
    { kind: "comment", index: 0 },
    { kind: "review", index: 0 },
    { kind: "comment", index: 1 },
    { kind: "review", index: 1 },
    { kind: "comment", index: 2 },
    { kind: "review", index: 2 },
    { kind: "comment", index: 3 },
    { kind: "comment", index: 4 },
    { kind: "comment", index: 5 },
    { kind: "comment", index: 6 },
  ];

  return (
    <main
      style={{
        maxWidth: 600,
        margin: "2rem auto",
        padding: "1rem",
        fontFamily: "system-ui, sans-serif",
        backgroundColor: "#f5f5f5",
      }}
    >
      <h1 style={{ marginBottom: "0.5rem", fontSize: "1.25rem" }}>
        🧪 Comment & Review Layout Test
      </h1>

      <section
        style={{
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "0 0 0 1px #e5e7eb",
          backgroundColor: "white",
        }}
      >
        {feed.map((item, idx) => {
          if (item.kind === "comment") {
            const c = mockComments[item.index];
            return (
              <CommentRow
                key={`comment-${c.id}-${idx}`}
                id={c.id}
                userId={c.userId}
                createdAt={c.createdAt}
                content={`[${c.label}] ${c.content}`}
                displayName={getDisplayName(c.userId)}
                initial={getInitial(c.userId)}
                isOwner={c.isOwner}
                isMain={c.isMain}
                replyCount={c.replyCount}
                likeCount={c.likeCount}
                likedByMe={c.likedByMe}
                href={undefined}
                onReplyClick={(id, e) => alert(`Reply clicked on ${id}`)}
                onToggleLike={(id, e) => alert(`Like toggled on ${id}`)}
                onBookmarkClick={(id, e) => alert(`Bookmark clicked on ${id}`)}
                onShareClick={(id, e) => alert(`Share clicked on ${id}`)}
                onEdit={(id, e) => alert(`Edit clicked on ${id}`)}
                onDelete={(id, e) => alert(`Delete clicked on ${id}`)}
                isMenuOpen={menuOpenId === c.id}
                onToggleMenu={(id, e) =>
                  setMenuOpenId((prev) => (prev === id ? null : id))
                }
              />
            );
          }

          const r = mockReviews[item.index];
          return (
            <ReviewRow
              key={`review-${r.id}-${idx}`}
              data={r}
              displayName={getDisplayName(r.userId)}
              initial={getInitial(r.userId)}
            />
          );
        })}
      </section>
    </main>
  );
}

// ===========================
// ReviewRow (clone of CommentRow + wrap around poster)
// - does NOT render layoutLabel anywhere ✅
// ===========================

type ReviewRowProps = {
  data: ReviewMock;
  displayName: string;
  initial: string;
};

function ReviewRow({ data, displayName, initial }: ReviewRowProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  const isMain = !!data.isMain;
  const iconSize = isMain ? 22 : 20;
  const avatarSize = isMain ? 56 : 46;
  const nameFontSize = isMain ? "1.05rem" : "0.95rem";
  const contentFontSize = isMain ? "1.1rem" : "1rem";
  const contentFontWeight = 400;

  const stars = renderStars(data.rating);

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

  return (
    <div
      style={{
        position: "relative",
        border: "1px solid #11111111",
        borderRadius: 0,
        background: isHovered ? "#f7f9fb" : "#ffffff",
        cursor: "default",
        transition: "background 0.12s ease",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
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
          <span>{initial}</span>
        </div>

        {/* Content column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Poster floats right so header + text wrap */}
          <div
            style={{
              float: "right",
              marginLeft: POSTER_GAP,
              marginTop: 2,
            }}
          >
            <PosterBox url={data.posterUrl} title={data.animeTitle} />
          </div>

          {/* Header line: username/time left + anime meta right */}
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
            {/* Left */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontSize: nameFontSize,
                  fontWeight: 500,
                  color: "#333",
                }}
              >
                {displayName}
              </span>

              <span style={{ color: "#aaa", fontSize: "0.8rem" }}>·</span>

              <small style={{ color: "#777", fontSize: "0.8rem" }}>
                {data.relativeTime}
              </small>
            </div>

            {/* Right: anime title smaller + stars under it */}
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
                {data.animeTitle}
              </span>

              <span style={{ fontSize: "0.76rem", color: "#777", lineHeight: 1.1 }}>
                {stars}
              </span>
            </div>
          </div>

          {/* Text */}
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
            {data.content}
          </p>

          {/* Clear float so action bar sits below */}
          <div style={{ clear: "both" }} />
        </div>
      </div>

      {/* Action bar (identical indentation to CommentRow) */}
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
            alert(`Reply clicked on review ${data.id}`);
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
          <span style={countStyle}>{data.replyCount}</span>
        </button>

        {/* Like */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            alert(`Like toggled on review ${data.id}`);
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
            fill={data.likedByMe ? "currentColor" : "none"}
          />
          <span style={countStyle}>{data.likeCount}</span>
        </button>

        {/* Bookmark */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            alert(`Bookmark clicked on review ${data.id}`);
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
            alert(`Share clicked on review ${data.id}`);
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

function PosterBox({ url, title }: { url?: string | null; title: string }) {
  const [hasError, setHasError] = useState(false);

  const initial =
    title && title.trim().length > 0
      ? title.trim().charAt(0).toUpperCase()
      : "?";

  const showImage = !!url && !hasError;

  return (
    <div
      style={{
        width: POSTER_W,
        borderRadius: 6,
        overflow: "hidden",
        backgroundColor: "#e5e7eb",
        flexShrink: 0,
      }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url as string}
          alt={title}
          style={{
            width: "100%",
            height: POSTER_H,
            objectFit: "cover",
            display: "block",
          }}
          onError={() => setHasError(true)}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: POSTER_H,
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
  );
}

function renderStars(rating: number): string {
  const fullStars = Math.floor(rating);
  const halfStar = rating - fullStars >= 0.5;
  let result = "★★★★★".slice(0, fullStars);
  if (halfStar && fullStars < 5) result += "½";
  return result.padEnd(5, "☆");
}
