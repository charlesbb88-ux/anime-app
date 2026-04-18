import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ThreadMessage = {
  id: string;
  threadId: string;
  authorUserId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
};

type ThreadParticipant = {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
};

type Data =
  | {
      ok: true;
      thread: {
        id: string;
        ownerUserId: string;
        senderUserId: string;
        createdAt: string;
        updatedAt: string;
        lastMessageAt: string;
        ownerLastReadAt: string | null;
        senderLastReadAt: string | null;
        owner: ThreadParticipant | null;
        sender: ThreadParticipant | null;
      } | null;
      messages: ThreadMessage[];
    }
  | {
      ok: false;
      error: string;
    };

function getBearerToken(req: NextApiRequest): string | null {
  const authHeader = req.headers.authorization;

  if (!authHeader || typeof authHeader !== "string") return null;

  const prefix = "Bearer ";
  if (!authHeader.startsWith(prefix)) return null;

  const token = authHeader.slice(prefix.length).trim();
  return token || null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  try {
    const ownerUserId = process.env.SITE_OWNER_USER_ID?.trim();

    if (!ownerUserId) {
      return res.status(500).json({
        ok: false,
        error: "SITE_OWNER_USER_ID is not set",
      });
    }

    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json({
        ok: false,
        error: "Missing authorization token",
      });
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({
        ok: false,
        error: "Invalid user session",
      });
    }

    const senderUserId = user.id;

    if (senderUserId === ownerUserId) {
      return res.status(400).json({
        ok: false,
        error: "Owner cannot use my-thread route",
      });
    }

    const { data: threadRow, error: threadError } = await supabaseAdmin
      .from("direct_message_threads")
      .select(`
        id,
        owner_user_id,
        sender_user_id,
        created_at,
        updated_at,
        last_message_at,
        owner_last_read_at,
        sender_last_read_at,
        owner:profiles!direct_message_threads_owner_user_id_fkey (
          id,
          username,
          avatar_url
        ),
        sender:profiles!direct_message_threads_sender_user_id_fkey (
          id,
          username,
          avatar_url
        )
      `)
      .eq("owner_user_id", ownerUserId)
      .eq("sender_user_id", senderUserId)
      .maybeSingle();

    if (threadError) {
      return res.status(500).json({
        ok: false,
        error: threadError.message,
      });
    }

    if (!threadRow) {
      return res.status(200).json({
        ok: true,
        thread: null,
        messages: [],
      });
    }

    const { data: messageRows, error: messagesError } = await supabaseAdmin
      .from("direct_messages")
      .select("id, thread_id, author_user_id, body, created_at, edited_at, deleted_at")
      .eq("thread_id", threadRow.id)
      .order("created_at", { ascending: true });

    if (messagesError) {
      return res.status(500).json({
        ok: false,
        error: messagesError.message,
      });
    }

    const nowIso = new Date().toISOString();

    const { error: updateReadError } = await supabaseAdmin
      .from("direct_message_threads")
      .update({
        sender_last_read_at: nowIso,
      })
      .eq("id", threadRow.id);

    if (updateReadError) {
      return res.status(500).json({
        ok: false,
        error: updateReadError.message,
      });
    }

    const owner = Array.isArray((threadRow as any).owner)
      ? (threadRow as any).owner[0]
      : (threadRow as any).owner;

    const sender = Array.isArray((threadRow as any).sender)
      ? (threadRow as any).sender[0]
      : (threadRow as any).sender;

    return res.status(200).json({
      ok: true,
      thread: {
        id: threadRow.id,
        ownerUserId: threadRow.owner_user_id,
        senderUserId: threadRow.sender_user_id,
        createdAt: threadRow.created_at,
        updatedAt: threadRow.updated_at,
        lastMessageAt: threadRow.last_message_at,
        ownerLastReadAt: threadRow.owner_last_read_at ?? null,
        senderLastReadAt: nowIso,
        owner: owner
          ? {
              userId: owner.id,
              username: owner.username ?? null,
              avatarUrl: owner.avatar_url ?? null,
            }
          : null,
        sender: sender
          ? {
              userId: sender.id,
              username: sender.username ?? null,
              avatarUrl: sender.avatar_url ?? null,
            }
          : null,
      },
      messages: (messageRows ?? []).map((message) => ({
        id: message.id,
        threadId: message.thread_id,
        authorUserId: message.author_user_id,
        body: message.body,
        createdAt: message.created_at,
        editedAt: message.edited_at ?? null,
        deletedAt: message.deleted_at ?? null,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: err?.message ?? "Unknown server error",
    });
  }
}