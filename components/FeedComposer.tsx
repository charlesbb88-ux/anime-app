"use client";

import React, { useMemo, useRef, useState } from "react";
import type { LexicalEditor } from "lexical";
import Link from "next/link";
import ComposerRichEditor from "@/components/composer/ComposerRichEditor";
import ComposerActionRowLexical from "@/components/composer/ComposerActionRowLexical";

type Props = {
  user: any | null;

  postContent: string;
  setPostContent: (v: string) => void;
  posting: boolean;
  onPost: () => void;

  mode?: "post" | "reply";

  animeId?: string;
  animeEpisodeId?: string;
  mangaId?: string;
  mangaChapterId?: string;

  currentUserAvatarUrl: string | null;
  currentUserUsername: string | null;

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

  const [active, setActive] = useState(false);

  // ✅ Recommended safety refs (prevents collapse when interacting with toolbar)
  const composerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<LexicalEditor | null>(null);

  function focusLexical() {
    const ed = editorRef.current;
    if (!ed) return;
    try {
      ed.focus();
    } catch {}
  }

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
  const disabled = posting || !postContent.trim();

  function expandAndFocus() {
    setActive(true);
    requestAnimationFrame(() => focusLexical());
  }

  function handleFocus() {
    setActive(true);
  }

  // ✅ Only collapse if focus truly left the whole composer area (incl. toolbar)
  function handleBlur() {
    // Defer one tick so clicks on toolbar can run without collapsing.
    window.setTimeout(() => {
      if (postContent.trim()) return;

      const activeEl = document.activeElement as HTMLElement | null;
      const stillInsideComposer = !!activeEl && !!composerRef.current?.contains(activeEl);

      const rootEl = editorRef.current?.getRootElement() as HTMLElement | null;
      const stillInsideEditor = !!activeEl && !!rootEl?.contains(activeEl);

      if (!stillInsideComposer && !stillInsideEditor) {
        setActive(false);
      }
    }, 0);
  }

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
      ref={composerRef}
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
          <Link href={`/${currentUserUsername}`} style={{ display: "inline-block", textDecoration: "none" }}>
            {composerAvatarNode}
          </Link>
        ) : (
          composerAvatarNode
        )}

        {/* ✅ clickable area that always expands + focuses */}
        <div
          style={{ flex: 1 }}
          onMouseDown={(e) => {
            // only do this when collapsed; otherwise let Lexical handle selection normally
            if (!isCollapsed) return;
            // prevent the click from “blurring” other things first
            e.preventDefault();
            expandAndFocus();
          }}
        >
          <ComposerRichEditor
            valueText={postContent}
            setValueText={setPostContent}
            placeholder={isCollapsed ? placeholder : ""}
            active={!isCollapsed}
            onFocus={handleFocus}
            onBlur={handleBlur}
            typoBase={typoBase}
            onEditorReady={(ed) => {
              editorRef.current = ed;
            }}
            toolbar={!isCollapsed ? <ComposerActionRowLexical disabled={posting} /> : undefined}
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
      ) : null}
    </div>
  );
}