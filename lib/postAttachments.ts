// lib/postAttachments.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type PendingAttachment =
  | { kind: "image"; file: File }
  | { kind: "youtube"; youtubeId: string; url: string };

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

export async function insertAttachments(params: {
  supabase: SupabaseClient;
  postId: string;
  userId: string;
  attachments: PendingAttachment[];
}) {
  const { supabase, postId, userId, attachments } = params;

  if (!attachments?.length) return;

  const rows: any[] = [];

  for (let i = 0; i < attachments.length; i++) {
    const a = attachments[i];

    if (a.kind === "youtube") {
      rows.push({
        post_id: postId,
        kind: "youtube",
        url: a.url,
        meta: {
          youtubeId: a.youtubeId,
        },
        sort_order: i,
      });
      continue;
    }

    const file = a.file;
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const safeExt = ext.replace(/[^a-z0-9]/g, "");
    const path = `${userId}/${postId}/${crypto.randomUUID()}.${safeExt}`;

    const up = await supabase.storage
      .from("post_media")
      .upload(path, file, {
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
      kind: "image",
      url: publicUrl,
      meta: {
        storage_path: path,
      },
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