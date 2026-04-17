import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type InboxThreadRow = {
  threadId: string;
  senderUserId: string;
  senderUsername: string | null;
  senderAvatarUrl: string | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  ownerLastReadAt: string | null;
  senderLastReadAt: string | null;
};

type Data =
  | {
      ok: true;
      threads: InboxThreadRow[];
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

    if (user.id !== ownerUserId) {
      return res.status(403).json({
        ok: false,
        error: "Forbidden",
      });
    }

    const { data, error } = await supabaseAdmin
      .from("direct_message_threads")
      .select(`
        id,
        sender_user_id,
        created_at,
        updated_at,
        last_message_at,
        owner_last_read_at,
        sender_last_read_at,
        sender:profiles!direct_message_threads_sender_user_id_fkey (
          id,
          username,
          avatar_url
        )
      `)
      .eq("owner_user_id", ownerUserId)
      .order("last_message_at", { ascending: false });

    if (error) {
      return res.status(500).json({
        ok: false,
        error: error.message,
      });
    }

    const threads: InboxThreadRow[] = (data ?? []).map((row: any) => {
      const sender = Array.isArray(row.sender) ? row.sender[0] : row.sender;

      return {
        threadId: row.id,
        senderUserId: row.sender_user_id,
        senderUsername: sender?.username ?? null,
        senderAvatarUrl: sender?.avatar_url ?? null,
        lastMessageAt: row.last_message_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        ownerLastReadAt: row.owner_last_read_at ?? null,
        senderLastReadAt: row.sender_last_read_at ?? null,
      };
    });

    return res.status(200).json({
      ok: true,
      threads,
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: err?.message ?? "Unknown server error",
    });
  }
}