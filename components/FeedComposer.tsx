"use client";

import React, { useMemo, useRef, useState } from "react";
import type { LexicalEditor } from "lexical";
import Link from "next/link";
import ComposerRichEditor from "@/components/composer/ComposerRichEditor";
import ComposerActionRowLexical from "@/components/composer/ComposerActionRowLexical";
import ComposerPendingAttachments from "@/components/composer/ComposerPendingAttachments";
import { parseYouTubeId, type PendingAttachment } from "@/lib/postAttachments";

// ✅ Attachment limits (Twitter-ish)
const MAX_MEDIA = 4; // images/gifs
const MAX_YOUTUBE = 1;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
// Optional: total cap (media + youtube). This equals 5 by default.
// If you don't want a total cap beyond the per-type caps, remove this const and related checks.
const MAX_TOTAL_ATTACHMENTS = MAX_MEDIA + MAX_YOUTUBE;

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

  setPostContentJson?: (v: any) => void;

  pendingAttachments: PendingAttachment[];
  setPendingAttachments: (
    v:
      | PendingAttachment[]
      | ((prev: PendingAttachment[]) => PendingAttachment[])
  ) => void;
};

export default function FeedComposer({
  user,
  postContent,
  setPostContent,
  setPostContentJson,
  pendingAttachments,
  setPendingAttachments,
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ✅ Helper counters
  function countPendingMedia(pending: PendingAttachment[]) {
    return pending.filter((a: any) => a?.kind === "image").length;
  }

  function countPendingYouTube(pending: PendingAttachment[]) {
    return pending.filter((a: any) => a?.kind === "youtube").length;
  }

  // ✅ Enforce limits before anything "gets added"
  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const picked = Array.from(files);

    // 1) size filter
    const tooBig = picked.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) {
      window.alert(
        `That file is too big (${Math.round(tooBig.size / 1024 / 1024)}MB). Max is ${Math.round(
          MAX_FILE_BYTES / 1024 / 1024
        )}MB.`
      );
      return;
    }

    // 2) enforce max media count (and optional total cap)
    setPendingAttachments((prev: PendingAttachment[]) => {
      // Optional total cap
      if (prev.length >= MAX_TOTAL_ATTACHMENTS) {
        window.alert(`You can only add up to ${MAX_TOTAL_ATTACHMENTS} attachments total.`);
        return prev;
      }

      const currentMedia = countPendingMedia(prev);
      const remainingMediaSlots = Math.max(0, MAX_MEDIA - currentMedia);

      if (remainingMediaSlots <= 0) {
        window.alert(`You can only attach up to ${MAX_MEDIA} images/GIFs per post.`);
        return prev;
      }

      // Respect total cap too (if enabled)
      const remainingTotalSlots = Math.max(0, MAX_TOTAL_ATTACHMENTS - prev.length);
      if (remainingTotalSlots <= 0) {
        window.alert(`You can only add up to ${MAX_TOTAL_ATTACHMENTS} attachments total.`);
        return prev;
      }

      const allowedSlots = Math.min(remainingMediaSlots, remainingTotalSlots);

      const nextFiles = picked.slice(0, allowedSlots);
      const next = nextFiles.map((f) => ({
        kind: "image" as const,
        file: f,
      })) as PendingAttachment[];

      // If they selected more than allowed, tell them (optional)
      if (picked.length > allowedSlots) {
        // Prefer a clear message that respects both caps
        if (allowedSlots === remainingMediaSlots && allowedSlots !== remainingTotalSlots) {
          window.alert(
            `Only the first ${allowedSlots} file(s) were added (you hit the total cap of ${MAX_TOTAL_ATTACHMENTS}).`
          );
        } else if (allowedSlots === remainingTotalSlots && allowedSlots !== remainingMediaSlots) {
          window.alert(
            `Only the first ${allowedSlots} file(s) were added (you hit the total cap of ${MAX_TOTAL_ATTACHMENTS}).`
          );
        } else {
          window.alert(`Only the first ${allowedSlots} file(s) were added (max ${MAX_MEDIA}).`);
        }
      }

      return [...prev, ...next];
    });
  }

  function onPickImages() {
    fileInputRef.current?.click();
  }

  function removeAttachmentAt(idx: number) {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  // ✅ Enforce YouTube limit + validate + prevent duplicate
  function onAddYouTube() {
    setPendingAttachments((prev: PendingAttachment[]) => {
      // Optional total cap
      if (prev.length >= MAX_TOTAL_ATTACHMENTS) {
        window.alert(`You can only add up to ${MAX_TOTAL_ATTACHMENTS} attachments total.`);
        return prev;
      }

      const currentYT = countPendingYouTube(prev);
      if (currentYT >= MAX_YOUTUBE) {
        window.alert(`You can only add ${MAX_YOUTUBE} YouTube link per post.`);
        return prev;
      }

      const url = window.prompt("Paste YouTube link:");
      if (!url) return prev;

      const id = parseYouTubeId(url);
      if (!id) {
        window.alert("That doesn’t look like a valid YouTube link.");
        return prev;
      }

      const already = prev.some((a: any) => a?.kind === "youtube" && a?.youtubeId === id);
      if (already) {
        window.alert("That YouTube video is already attached.");
        return prev;
      }

      return [
        ...prev,
        {
          kind: "youtube" as const,
          url: url.trim(),
          youtubeId: id,
        } as PendingAttachment,
      ];
    });
  }

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

  // ✅ If your PendingAttachment ever includes status, we’ll respect it without requiring it
  const hasUploading =
    Array.isArray(pendingAttachments) &&
    pendingAttachments.some((a: any) => a?.status === "uploading");

  // ✅ Allow attachment-only posts (so you can post media without text)
  const disabled =
    posting ||
    hasUploading ||
    (!postContent.trim() && pendingAttachments.length === 0);

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

      // If they have attachments, keep it open (prevents weird UX)
      if (pendingAttachments.length > 0) return;

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
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.gif"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          addFiles(e.target.files);
          // allow re-picking the same file again later
          e.currentTarget.value = "";
        }}
      />

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
            setValueJson={setPostContentJson}
            placeholder={isCollapsed ? placeholder : ""}
            active={!isCollapsed}
            onFocus={handleFocus}
            onBlur={handleBlur}
            typoBase={typoBase}
            onEditorReady={(ed) => {
              editorRef.current = ed;
            }}
            toolbar={
              !isCollapsed ? (
                <div>
                  <ComposerActionRowLexical
                    disabled={posting || hasUploading}
                    onPickImages={onPickImages}
                    onAddYouTube={onAddYouTube}
                  />

                  <ComposerPendingAttachments
                    items={pendingAttachments}
                    onRemove={removeAttachmentAt}
                  />
                </div>
              ) : undefined
            }
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