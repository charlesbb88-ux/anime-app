import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Data =
  | {
      ok: true;
      messageId: string;
      threadId: string;
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

function cleanString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== "POST") {
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

    const threadId = cleanString(req.body?.threadId);
    const body = cleanString(req.body?.body);

    if (!threadId) {
      return res.status(400).json({
        ok: false,
        error: "threadId is required",
      });
    }

    if (!body) {
      return res.status(400).json({
        ok: false,
        error: "Message body is required",
      });
    }

    if (body.length > 2000) {
      return res.status(400).json({
        ok: false,
        error: "Message is too long",
      });
    }

    const { data: threadRow, error: threadError } = await supabaseAdmin
      .from("direct_message_threads")
      .select("id")
      .eq("id", threadId)
      .eq("owner_user_id", ownerUserId)
      .maybeSingle();

    if (threadError) {
      return res.status(500).json({
        ok: false,
        error: threadError.message,
      });
    }

    if (!threadRow) {
      return res.status(404).json({
        ok: false,
        error: "Thread not found",
      });
    }

    const { data: messageRow, error: messageError } = await supabaseAdmin
      .from("direct_messages")
      .insert({
        thread_id: threadId,
        author_user_id: ownerUserId,
        body,
      })
      .select("id")
      .single();

    if (messageError) {
      return res.status(500).json({
        ok: false,
        error: messageError.message,
      });
    }

    const nowIso = new Date().toISOString();

    const { error: updateThreadError } = await supabaseAdmin
      .from("direct_message_threads")
      .update({
        updated_at: nowIso,
        last_message_at: nowIso,
        owner_last_read_at: nowIso,
      })
      .eq("id", threadId);

    if (updateThreadError) {
      return res.status(500).json({
        ok: false,
        error: updateThreadError.message,
      });
    }

    return res.status(200).json({
      ok: true,
      messageId: messageRow.id,
      threadId,
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: err?.message ?? "Unknown server error",
    });
  }
}