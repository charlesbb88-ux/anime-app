"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PendingAttachment } from "@/lib/postAttachments";
import {
  ATTACHMENT_LIMITS,
  publicPostMediaUrl,
} from "@/lib/postAttachments";

// -----------------------------
// INTERNAL HELPERS (copied safely)
// -----------------------------

function safeRandomId() {
  const c = globalThis.crypto as Crypto | undefined;

  if (c?.randomUUID) return c.randomUUID();

  const bytes = new Uint8Array(16);

  if (c?.getRandomValues) {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++)
      bytes[i] = Math.floor(Math.random() * 256);
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = [...bytes]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16
  )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function classifyFile(file: File): {
  kind: "image" | "gif" | "video";
  ext: string;
} {
  const mime = (file.type || "").toLowerCase();
  const nameExt = (file.name.split(".").pop() || "bin").toLowerCase();
  const safeNameExt = nameExt.replace(/[^a-z0-9]/g, "") || "bin";

  const inferExt = (m: string) => {
    if (m === "image/jpeg") return "jpg";
    if (m === "image/png") return "png";
    if (m === "image/webp") return "webp";
    if (m === "image/gif") return "gif";
    if (m === "video/mp4") return "mp4";
    if (m === "video/webm") return "webm";
    if (m === "video/quicktime") return "mov";
    return safeNameExt;
  };

  const ext = inferExt(mime);

  if (mime === "image/gif" || ext === "gif")
    return { kind: "gif", ext: "gif" };

  if (mime.startsWith("video/"))
    return { kind: "video", ext: ext === "bin" ? "mp4" : ext };

  return { kind: "image", ext };
}

function validateAttachments(attachments: PendingAttachment[]) {
  if (!attachments?.length) return;

  if (attachments.length > ATTACHMENT_LIMITS.maxAttachments) {
    throw new Error(
      `Too many attachments (max ${ATTACHMENT_LIMITS.maxAttachments}).`
    );
  }

  for (const a of attachments) {
    if (a.kind === "youtube") continue;

    const file = a.file;
    const mime = (file.type || "").toLowerCase();
    const { kind } = classifyFile(file);

    if (kind === "video") {
      if (!ATTACHMENT_LIMITS.allowedVideoMimes.has(mime)) {
        throw new Error(
          "Only MP4, WebM, and MOV (iPhone) videos are allowed."
        );
      }
      if (file.size > ATTACHMENT_LIMITS.maxVideoBytes) {
        throw new Error("Video is too large.");
      }
      continue;
    }

    if (!ATTACHMENT_LIMITS.allowedImageMimes.has(mime)) {
      throw new Error("Only JPG, PNG, WEBP, and GIF are allowed.");
    }

    if (kind === "gif") {
      if (file.size > ATTACHMENT_LIMITS.maxGifBytes)
        throw new Error("GIF is too large.");
    } else {
      if (file.size > ATTACHMENT_LIMITS.maxImageBytes)
        throw new Error("Image is too large.");
    }
  }
}

async function readImageDimensions(file: File) {
  const url = URL.createObjectURL(file);

  try {
    const img = new Image();
    img.decoding = "async";

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () =>
        reject(new Error("Failed to read image dimensions."));
      img.src = url;
    });

    return {
      width: Number.isFinite(img.naturalWidth)
        ? img.naturalWidth
        : null,
      height: Number.isFinite(img.naturalHeight)
        ? img.naturalHeight
        : null,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function readVideoMetadata(file: File) {
  const url = URL.createObjectURL(file);

  try {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        v.onloadedmetadata = null;
        v.onerror = null;
      };

      v.onloadedmetadata = () => {
        cleanup();
        resolve();
      };

      v.onerror = () => {
        cleanup();
        reject(new Error("Failed to read video metadata."));
      };

      v.src = url;
    });

    return {
      width: Number.isFinite(v.videoWidth)
        ? v.videoWidth
        : null,
      height: Number.isFinite(v.videoHeight)
        ? v.videoHeight
        : null,
      durationSeconds:
        Number.isFinite(v.duration) && v.duration > 0
          ? v.duration
          : null,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// -----------------------------
// MAIN FUNCTION
// -----------------------------

export async function insertCommentAttachments(params: {
  supabase: SupabaseClient;
  commentId: string;
  userId: string;
  attachments: PendingAttachment[];
  onStatus?: (index: number, patch: { status?: any; error?: string | null }) => void;
}) {
  const { supabase, commentId, userId, attachments, onStatus } = params;

  if (!attachments?.length) return;

  validateAttachments(attachments);

  const rows: any[] = [];

  for (let i = 0; i < attachments.length; i++) {
    const a = attachments[i];

    onStatus?.(i, { status: "uploading", error: null });

    try {
if (a.kind === "youtube") {
  rows.push({
    comment_id: commentId,
    kind: "youtube",
    url: a.url,
    meta: { youtubeId: a.youtubeId },
    sort_order: i,
  });

  // ✅ optional UI polish
  onStatus?.(i, { status: "done", error: null });

  continue;
}

      const file = a.file;
      const mime = (file.type || "").toLowerCase();
      const { kind, ext } = classifyFile(file);

      let width: number | null = null;
      let height: number | null = null;
      let durationSeconds: number | null = null;

      try {
        if (kind === "video") {
          const meta = await readVideoMetadata(file);
          width = meta.width;
          height = meta.height;
          durationSeconds = meta.durationSeconds;
        } else {
          const meta = await readImageDimensions(file);
          width = meta.width;
          height = meta.height;
        }
      } catch (e) {
        console.warn("Attachment metadata read failed:", e);
      }

      const path = `${userId}/comments/${commentId}/${safeRandomId()}.${ext}`;

      const up = await supabase.storage
        .from("post_media")
        .upload(path, file, {
          contentType: file.type || undefined,
          upsert: false,
        });

      if (up.error) throw up.error;

      const publicUrl = publicPostMediaUrl(path);

      const baseMeta: any = { storage_path: path };

      if (mime === "video/quicktime") {
        baseMeta.container = "mov";
        baseMeta.may_not_play_everywhere = true;
      }

      if (kind === "video" && durationSeconds != null) {
        baseMeta.duration_seconds = durationSeconds;
      }

      rows.push({
        comment_id: commentId,
        kind,
        url: publicUrl,
        meta: baseMeta,
        sort_order: i,
        mime: file.type || null,
        width,
        height,
        size_bytes: file.size ?? null,
      });

      // ✅ optional UI polish
onStatus?.(i, { status: "done", error: null });

    } catch (e: any) {
      onStatus?.(i, {
        status: "error",
        error: e?.message || "Upload failed",
      });
      throw e;
    }
  }

  const { error } = await supabase
    .from("comment_attachments")
    .insert(rows);

  if (error) throw error;
}