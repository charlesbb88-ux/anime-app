"use client";

import React from "react";
import Link from "next/link";

type Props = {
  // auth
  user: any | null;

  // composer state
  postContent: string;
  setPostContent: (v: string) => void;
  posting: boolean;
  onPost: () => void;

  // context (for placeholder)
  animeId?: string;
  animeEpisodeId?: string;
  mangaId?: string;
  mangaChapterId?: string;

  // current user profile display
  currentUserAvatarUrl: string | null;
  currentUserUsername: string | null;

  // typography (matches your existing)
  typoBase: string;
  typoSmall: string;
};

export default function FeedComposer({
  user,
  postContent,
  setPostContent,
  posting,
  onPost,

  animeId,
  animeEpisodeId,
  mangaId,
  mangaChapterId,

  currentUserAvatarUrl,
  currentUserUsername,

  typoBase,
  typoSmall,
}: Props) {
  if (!user) return null;

  function getInitialFromUser(userObj: any) {
    const email: string = userObj?.email || "";
    const c = email.trim()[0];
    return c ? c.toUpperCase() : "U";
  }

  const currentUserInitial = getInitialFromUser(user);

  const composerAvatarNode = (
    <div
      style={{
        width: 46,
        height: 46,
        borderRadius: "999px",
        background: "#e5e5e5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: typoBase,
        fontWeight: 600,
        color: "#333",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {currentUserAvatarUrl ? (
        <img
          src={currentUserAvatarUrl}
          alt="Your avatar"
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            objectFit: "cover",
          }}
        />
      ) : (
        currentUserInitial
      )}
    </div>
  );

  const placeholder = animeEpisodeId
    ? "Talk about this episode…"
    : animeId
      ? "Talk about this anime…"
      : mangaChapterId
        ? "Talk about this chapter…"
        : mangaId
          ? "Talk about this manga…"
          : "What's happening?";

  return (
    <div
      style={{
        border: "1px solid #000",
        borderRadius: 0,
        background: "#ffffff",
        marginBottom: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.7rem",
          padding: "0.6rem 0.8rem 0.3rem 0.8rem",
        }}
      >
        {currentUserUsername ? (
          <Link
            href={`/${currentUserUsername}`}
            style={{ display: "inline-block", textDecoration: "none" }}
          >
            {composerAvatarNode}
          </Link>
        ) : (
          composerAvatarNode
        )}

        <div style={{ flex: 1 }}>
          <textarea
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
            placeholder={placeholder}
            style={{
              width: "100%",
              border: "none",
              outline: "none",
              resize: "none",
              minHeight: "2.8rem",
              fontSize: "1.05rem",
              fontFamily: "inherit",
              padding: 0,
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          padding: "0 0.8rem 0.5rem 0.8rem",
        }}
      >
        <button
          onClick={onPost}
          disabled={posting || !postContent.trim()}
          style={{
            padding: "0.4rem 1.2rem",
            borderRadius: "999px",
            border: "none",
            background: posting || !postContent.trim() ? "#999" : "#000",
            color: "#fff",
            cursor: posting || !postContent.trim() ? "default" : "pointer",
            fontSize: typoSmall,
            fontWeight: 500,
          }}
        >
          {posting ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}