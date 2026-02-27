"use client";

import React, { useMemo, useRef, useState } from "react";
import type { LexicalEditor } from "lexical";
import Link from "next/link";
import ComposerRichEditor from "@/components/composer/ComposerRichEditor";
import ComposerActionRowLexical, {
  ComposerActionRowLexicalExternal,
} from "@/components/composer/ComposerActionRowLexical";
import ComposerPendingAttachments from "@/components/composer/ComposerPendingAttachments";
import { parseYouTubeId, type PendingAttachment } from "@/lib/postAttachments";

// ✅ Attachment limits (Twitter-ish)
const MAX_MEDIA = 4; // images/gifs
const MAX_VIDEO = 1; // twitter-ish: 1 video
const MAX_YOUTUBE = 1;

// Keep this conservative unless you explicitly want bigger uploads.
// If you do want bigger, bump it to 25MB or 50MB.
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB

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
    v: PendingAttachment[] | ((prev: PendingAttachment[]) => PendingAttachment[])
  ) => void;
};

function isVideoFile(f: File) {
  const t = (f.type || "").toLowerCase();
  if (t.startsWith("video/")) return true;

  // fallback: extension check (rare, but helps if MIME missing)
  const name = (f.name || "").toLowerCase();
  return name.endsWith(".mp4") || name.endsWith(".webm");
}

function isImageLikeFile(f: File) {
  const t = (f.type || "").toLowerCase();
  if (t.startsWith("image/")) return true;

  const name = (f.name || "").toLowerCase();
  return name.endsWith(".gif");
}

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

  const [isDragging, setIsDragging] = useState(false);

  const dragCounter = useRef(0);

  // ✅ Recommended safety refs (prevents collapse when interacting with toolbar)
  const composerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<LexicalEditor | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [lexicalEditor, setLexicalEditor] = useState<LexicalEditor | null>(null);

  // ✅ Helper counters
  function countPendingImages(pending: PendingAttachment[]) {
    return pending.filter((a: any) => a?.kind === "image").length;
  }
  function countPendingVideos(pending: PendingAttachment[]) {
    return pending.filter((a: any) => a?.kind === "video").length;
  }
  function countPendingYouTube(pending: PendingAttachment[]) {
    return pending.filter((a: any) => a?.kind === "youtube").length;
  }

  // ✅ Add media files (images/gifs/videos) with Twitter-ish constraints
  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const picked = Array.from(files);

    // 1) reject unknown types early (helps avoid weird files)
    const bad = picked.find((f) => !isImageLikeFile(f) && !isVideoFile(f));
    if (bad) {
      window.alert("Only images/GIFs and MP4/WEBM videos are supported.");
      return;
    }

    // 2) size filter
    const tooBig = picked.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) {
      window.alert(
        `That file is too big (${Math.round(tooBig.size / 1024 / 1024)}MB). Max is ${Math.round(
          MAX_FILE_BYTES / 1024 / 1024
        )}MB.`
      );
      return;
    }

    // 3) Twitter-ish rule: no mixing video with image grid
    const pickedHasVideo = picked.some(isVideoFile);
    const pickedHasImage = picked.some(isImageLikeFile);

    setPendingAttachments((prev: PendingAttachment[]) => {
      const hasVideoAlready = countPendingVideos(prev) > 0;
      const hasImagesAlready = countPendingImages(prev) > 0;

      // If you already have images, you cannot add a video
      if (hasImagesAlready && pickedHasVideo) {
        window.alert("You can’t add a video to a post that already has images/GIFs.");
        return prev;
      }

      // If you already have a video, you cannot add images
      if (hasVideoAlready && pickedHasImage) {
        window.alert("You can’t add images/GIFs to a post that already has a video.");
        return prev;
      }

      // If the user picked BOTH images and video in one selection, reject
      if (pickedHasVideo && pickedHasImage) {
        window.alert("Pick either images/GIFs OR one video (not both).");
        return prev;
      }

      // If picking a video
      if (pickedHasVideo) {
        const currentVideos = countPendingVideos(prev);
        if (currentVideos >= MAX_VIDEO) {
          window.alert(`You can only attach ${MAX_VIDEO} video per post.`);
          return prev;
        }

        const file = picked.find(isVideoFile);
        if (!file) return prev;

        // only 1 video, so ignore additional picks
        if (picked.length > 1) {
          window.alert("Only the first video was added (1 video max).");
        }
        const next: PendingAttachment = {
          kind: "video" as const,
          file,
          status: "queued" as const,
          error: null,
        };
        return [...prev, next];
      }

      // Otherwise picking images/gifs
      const currentMedia = countPendingImages(prev);
      const remainingMediaSlots = Math.max(0, MAX_MEDIA - currentMedia);

      if (remainingMediaSlots <= 0) {
        window.alert(`You can only attach up to ${MAX_MEDIA} images/GIFs per post.`);
        return prev;
      }

      const nextFiles = picked.slice(0, remainingMediaSlots);
      const next = nextFiles.map(
        (f) =>
          ({
            kind: "image" as const,
            file: f,
            status: "queued" as const,
            error: null,
          }) as PendingAttachment
      );

      if (picked.length > remainingMediaSlots) {
        window.alert(`Only the first ${remainingMediaSlots} file(s) were added (max ${MAX_MEDIA}).`);
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
          status: "queued" as const,
          error: null,
        } as PendingAttachment,
      ];
    });
  }

  function focusLexical() {
    const ed = editorRef.current;
    if (!ed) return;
    try {
      ed.focus();
    } catch { }
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
  const disabled = posting || hasUploading || (!postContent.trim() && pendingAttachments.length === 0);

  function expandAndFocus() {
    setActive(true);
    requestAnimationFrame(() => focusLexical());
  }

  function handleFocus() {
    setActive(true);
  }

  // ✅ Only collapse if focus truly left the whole composer area (incl. toolbar)
  function handleBlur() {
    window.setTimeout(() => {
      if (postContent.trim()) return;

      // If they have attachments, keep it open
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
      onDragEnter={(e) => {
        e.preventDefault();
        dragCounter.current += 1;
        setIsDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        dragCounter.current -= 1;

        if (dragCounter.current === 0) {
          setIsDragging(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();

        dragCounter.current = 0;
        setIsDragging(false);

        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) return;

        addFiles(files);
      }}
      style={{
        border: "1px solid #000",
        borderRadius: 0,
        background: "#ffffff",
        marginBottom: 0,
        outline: isDragging ? "2px dashed #3b82f6" : "none",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        // ✅ images/gifs + mp4/webm
        accept="image/*,.gif,video/mp4,video/webm"
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
            if (!isCollapsed) return;
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
              setLexicalEditor(ed);
            }}
          />
          {!isCollapsed ? (
            <div style={{ padding: "0 0.8rem 0.6rem 0.8rem" }}>
              <ComposerPendingAttachments items={pendingAttachments} onRemove={removeAttachmentAt} />
            </div>
          ) : null}
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
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.6rem",
          }}
        >
          {/* LEFT: toolbar buttons */}
          <ComposerActionRowLexicalExternal
            editor={lexicalEditor}
            disabled={posting || hasUploading}
            onPickImages={onPickImages}
            onAddYouTube={onAddYouTube}
          />

          {/* RIGHT: Post button */}
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
              flexShrink: 0,
            }}
          >
            {posting ? actioningLabel : actionLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}