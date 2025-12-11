"use client";

import { useState } from "react";
import CommentRow from "../components/CommentRow";

export default function TestCommentPage() {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const now = Date.now();

  const mockComments = [
    // seconds ago
    {
      id: "c-seconds",
      userId: "user-secs",
      createdAt: new Date(now - 15 * 1000).toISOString(), // ~15s ago
      label: "Seconds ago",
      content:
        "This comment simulates something that just happened seconds ago. Should show something like 5s / 15s depending on when you load.",
      replyCount: 1,
      likeCount: 0,
      likedByMe: false,
      isOwner: true,
      isMain: false,
    },
    // minutes ago
    {
      id: "c-minutes",
      userId: "user-mins",
      createdAt: new Date(now - 12 * 60 * 1000).toISOString(), // ~12m ago
      label: "Minutes ago",
      content:
        "This one is from several minutes ago. You should see an m label (something like 12m).",
      replyCount: 2,
      likeCount: 3,
      likedByMe: false,
      isOwner: false,
      isMain: false,
    },
    // hours ago
    {
      id: "c-hours",
      userId: "user-hrs",
      createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(), // ~3h ago
      label: "Hours ago",
      content:
        "Now we’re in the hours range. This one should show something like 3h.",
      replyCount: 0,
      likeCount: 5,
      likedByMe: true,
      isOwner: false,
      isMain: true,
    },
    // days ago
    {
      id: "c-days",
      userId: "user-days",
      createdAt: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString(), // ~4d ago
      label: "Days ago",
      content:
        "This comment is several days old. It should show 4d (or similar).",
      replyCount: 1,
      likeCount: 1,
      likedByMe: false,
      isOwner: false,
      isMain: false,
    },
    // weeks ago
    {
      id: "c-weeks",
      userId: "user-weeks",
      createdAt: new Date(now - 3 * 7 * 24 * 60 * 60 * 1000).toISOString(), // ~3w ago
      label: "Weeks ago",
      content:
        "This one is a few weeks old. You should see something like 3w.",
      replyCount: 4,
      likeCount: 8,
      likedByMe: false,
      isOwner: false,
      isMain: false,
    },
    // months ago (~2 months)
    {
      id: "c-months",
      userId: "user-months",
      createdAt: new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString(), // ~60 days ago
      label: "Months ago",
      content:
        "Around a couple of months old. This should switch to a calendar date like Oct 5.",
      replyCount: 0,
      likeCount: 2,
      likedByMe: false,
      isOwner: false,
      isMain: false,
    },
    // years ago (~2 years)
    {
      id: "c-years",
      userId: "user-years",
      createdAt: new Date(now - 2 * 365 * 24 * 60 * 60 * 1000).toISOString(), // ~2 years ago
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

  function getDisplayName(userId: string) {
    return `User-${userId.slice(0, 4)}`;
  }

  function getInitial(userId: string) {
    return getDisplayName(userId).charAt(0).toUpperCase();
  }

  return (
    <main
      style={{
        maxWidth: 600,
        margin: "2rem auto",
        padding: "1rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1>🧪 CommentRow Time Formats</h1>
      <p style={{ marginBottom: "1rem", fontSize: "0.9rem", color: "#555" }}>
        This page shows comments with createdAt values ranging from seconds ago
        to years ago, so you can see all relative-time formats and the action
        buttons together.
      </p>

      <section
        style={{
          borderTop: "1px solid #11111111",
          borderBottom: "1px solid #11111111",
        }}
      >
        {mockComments.map((c) => (
          <CommentRow
            key={c.id}
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
        ))}
      </section>
    </main>
  );
}
