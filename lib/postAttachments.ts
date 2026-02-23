// lib/postAttachments.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type PendingAttachment =
  | { kind: "image"; file: File } // NOTE: images + gifs + videos will come through as file attachments
  | { kind: "youtube"; youtubeId: string; url: string }
  | { kind: "video"; file: File }; // ✅ NEW (explicit kind if you want to add via UI separately)

// -----------------------------
// Limits / validation (safe defaults)
// -----------------------------
export const ATTACHMENT_LIMITS = {
  maxAttachments: 4,

  // Images/GIFs
  maxImageBytes: 8 * 1024 * 1024, // 8MB
  maxGifBytes: 15 * 1024 * 1024, // 15MB

  // Videos
  maxVideoBytes: 50 * 1024 * 1024, // 50MB (tweak later if you want)

  // Allowed mime
  allowedImageMimes: new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ]),
  allowedVideoMimes: new Set(["video/mp4", "video/webm"]),
};

export function parseYouTubeId(input: string): string | null {
  try {
    const s = input.trim();

    if (/^[a-zA-Z0-9_-]{6,}$/.test(s) && !s.includes("http")) return s;

    const u = new URL(s);

    if (u.hostname.includes("youtu.be")) {
      return u.pathname.replace("/", "") || null;
    }

    const v = u.searchParams.get("v");
    if (v) return v;

    const parts = u.pathname.split("/").filter(Boolean);
    const embedIdx = parts.indexOf("embed");
    if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];

    const shortsIdx = parts.indexOf("shorts");
    if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];

    return null;
  } catch {
    return null;
  }
}

export function publicPostMediaUrl(storagePath: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/post_media/${storagePath}`;
}

function inferExtFromMime(mime: string | null | undefined, fallback: string) {
  const m = (mime || "").toLowerCase();
  if (m === "image/jpeg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m === "image/gif") return "gif";
  if (m === "video/mp4") return "mp4";
  if (m === "video/webm") return "webm";
  return fallback;
}

function classifyFile(file: File): { kind: "image" | "gif" | "video"; ext: string } {
  const mime = (file.type || "").toLowerCase();

  const nameExt = (file.name.split(".").pop() || "bin").toLowerCase();
  const safeNameExt = nameExt.replace(/[^a-z0-9]/g, "") || "bin";
  const ext = inferExtFromMime(mime, safeNameExt);

  if (mime === "image/gif" || ext === "gif") return { kind: "gif", ext: "gif" };
  if (mime.startsWith("video/")) return { kind: "video", ext: ext === "bin" ? "mp4" : ext };
  return { kind: "image", ext };
}

function validateAttachments(attachments: PendingAttachment[]) {
  if (!attachments?.length) return;

  if (attachments.length > ATTACHMENT_LIMITS.maxAttachments) {
    throw new Error(`Too many attachments (max ${ATTACHMENT_LIMITS.maxAttachments}).`);
  }

  for (const a of attachments) {
    if (a.kind === "youtube") continue;

    const file = a.file;
    const mime = (file.type || "").toLowerCase();
    const { kind } = classifyFile(file);

    if (kind === "video") {
      if (!ATTACHMENT_LIMITS.allowedVideoMimes.has(mime)) {
        throw new Error("Only MP4 and WebM videos are allowed.");
      }
      if (file.size > ATTACHMENT_LIMITS.maxVideoBytes) {
        throw new Error("Video is too large.");
      }
      continue;
    }

    // image/gif
    if (!ATTACHMENT_LIMITS.allowedImageMimes.has(mime)) {
      throw new Error("Only JPG, PNG, WEBP, and GIF are allowed.");
    }
    if (kind === "gif") {
      if (file.size > ATTACHMENT_LIMITS.maxGifBytes) throw new Error("GIF is too large.");
    } else {
      if (file.size > ATTACHMENT_LIMITS.maxImageBytes) throw new Error("Image is too large.");
    }
  }
}

export async function insertAttachments(params: {
  supabase: SupabaseClient;
  postId: string;
  userId: string;
  attachments: PendingAttachment[];
}) {
  const { supabase, postId, userId, attachments } = params;

  if (!attachments?.length) return;

  // ✅ enforce safety limits on the client before any uploads
  validateAttachments(attachments);

  const rows: any[] = [];

  for (let i = 0; i < attachments.length; i++) {
    const a = attachments[i];

    if (a.kind === "youtube") {
      rows.push({
        post_id: postId,
        kind: "youtube",
        url: a.url,
        meta: { youtubeId: a.youtubeId },
        sort_order: i,
      });
      continue;
    }

    const file = a.file;

    // decide if this file should be stored as image vs gif vs video
    const { kind, ext } = classifyFile(file);

    // storage path
    const path = `${userId}/${postId}/${crypto.randomUUID()}.${ext}`;

    const up = await supabase.storage.from("post_media").upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });

    if (up.error) {
      console.error("Upload error:", up.error);
      throw up.error;
    }

    const publicUrl = publicPostMediaUrl(path);

    rows.push({
      post_id: postId,
      kind, // ✅ "image" | "gif" | "video"
      url: publicUrl,
      meta: { storage_path: path },
      sort_order: i,
      mime: file.type || null,
      width: null,
      height: null,
      size_bytes: file.size ?? null,
    });
  }

  const { error } = await supabase.from("post_attachments").insert(rows);

  if (error) {
    console.error("Insert attachment error:", error);
    throw error;
  }
}