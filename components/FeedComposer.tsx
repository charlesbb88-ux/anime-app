"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import ComposerActionRow from "@/components/composer/ComposerActionRow";

type Props = {
  // auth
  user: any | null;

  // composer state
  postContent: string;
  setPostContent: (v: string) => void;
  posting: boolean;
  onPost: () => void;

  // button label mode
  mode?: "post" | "reply";

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

  mode,

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

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [active, setActive] = useState(false);

  function getInitialFromUser(userObj: any) {
    const email: string = userObj?.email || "";
    const c = email.trim()[0];
    return c ? c.toUpperCase() : "U";
  }

  const currentUserInitial = getInitialFromUser(user);

  const inferredMode: "post" | "reply" = useMemo(() => {
    if (mode) return mode;
    if (typeof window === "undefined") return "post";
    const path = window.location.pathname || "";
    if (path.startsWith("/posts") || path.startsWith("/comments")) return "reply";
    return "post";
  }, [mode]);

  const isReply = inferredMode === "reply";
  const actionLabel = isReply ? "Reply" : "Post";
  const actioningLabel = isReply ? "Replying…" : "Posting…";

  const contextPlaceholder = animeEpisodeId
    ? "Talk about this episode…"
    : animeId
      ? "Talk about this anime…"
      : mangaChapterId
        ? "Talk about this chapter…"
        : mangaId
          ? "Talk about this manga…"
          : "What's happening?";

  const placeholder = isReply ? "Post your reply" : contextPlaceholder;

  const isCollapsed = !active && !postContent.trim();

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    const maxHeight = 20 * 24;
    const newHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${newHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setPostContent(e.target.value);
    if (textareaRef.current) autoGrow(textareaRef.current);
  }

  function handleFocus() {
    setActive(true);
    if (textareaRef.current) autoGrow(textareaRef.current);
  }

  function handleBlur() {
    if (!postContent.trim()) {
      setActive(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = "26px";
        textareaRef.current.style.overflowY = "hidden";
      }
    }
  }

  const disabled = posting || !postContent.trim();

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
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentUserAvatarUrl}
          alt="Your avatar"
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        currentUserInitial
      )}
    </div>
  );

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
          alignItems: active ? "flex-start" : "center",
          gap: "0.7rem",
          padding: active ? "0.6rem 0.8rem 0.3rem 0.8rem" : "0.45rem 0.8rem",
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
            ref={textareaRef}
            value={postContent}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={isCollapsed ? placeholder : ""}
            rows={1}
            style={{
              width: "100%",
              border: "none",
              outline: "none",
              resize: "none",
              background: "transparent",
              padding: isCollapsed ? "0" : "0.6rem 0",
              height: isCollapsed ? "26px" : "auto",
              minHeight: isCollapsed ? "26px" : "36px",
              fontSize: "1.05rem",
              fontFamily: "inherit",
              lineHeight: isCollapsed ? "30px" : 1.5,
              overflowY: "hidden",
            }}
          />
        </div>

        {isCollapsed && (
          <button
            onClick={onPost}
            disabled={disabled}
            style={{
              padding: "0.4rem 0.95rem",
              borderRadius: "999px",
              border: "none",
              background: disabled ? "#a0a0a0" : "#000",
              color: "#fff",
              cursor: disabled ? "default" : "pointer",
              fontSize: typoSmall,
              fontWeight: 500,
            }}
          >
            {posting ? actioningLabel : actionLabel}
          </button>
        )}
      </div>

      {!isCollapsed ? (
        <>
          {/* ✅ Twitter-style action row (only when expanded) */}
          <ComposerActionRow
            value={postContent}
            setValue={setPostContent}
            textareaRef={textareaRef}
            disabled={posting}
            showCode
          />

          {/* bottom-right submit */}
          <div
            style={{
              padding: "0 0.8rem 0.5rem 0.8rem",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              onClick={onPost}
              disabled={disabled}
              style={{
                padding: "0.4rem 0.95rem",
                borderRadius: "999px",
                border: "none",
                background: disabled ? "#a0a0a0" : "#000",
                color: "#fff",
                cursor: disabled ? "default" : "pointer",
                fontSize: typoSmall,
                fontWeight: 500,
              }}
            >
              {posting ? actioningLabel : actionLabel}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}