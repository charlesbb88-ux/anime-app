import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Data =
  | {
      ok: true;
      threadId: string;
      messageId: string;
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

function cleanBody(value: unknown): string {
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

    const senderUserId = user.id;
    const body = cleanBody(req.body?.body);

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

    if (senderUserId === ownerUserId) {
      return res.status(400).json({
        ok: false,
        error: "Owner cannot use this route to message themselves",
      });
    }

    const { data: existingThread, error: existingThreadError } =
      await supabaseAdmin
        .from("direct_message_threads")
        .select("id")
        .eq("owner_user_id", ownerUserId)
        .eq("sender_user_id", senderUserId)
        .maybeSingle();

    if (existingThreadError) {
      return res.status(500).json({
        ok: false,
        error: existingThreadError.message,
      });
    }

    let threadId = existingThread?.id ?? null;

    if (!threadId) {
      const { data: newThread, error: createThreadError } = await supabaseAdmin
        .from("direct_message_threads")
        .insert({
          owner_user_id: ownerUserId,
          sender_user_id: senderUserId,
        })
        .select("id")
        .single();

      if (createThreadError) {
        return res.status(500).json({
          ok: false,
          error: createThreadError.message,
        });
      }

      threadId = newThread.id;
    }

    const { data: newMessage, error: createMessageError } = await supabaseAdmin
      .from("direct_messages")
      .insert({
        thread_id: threadId,
        author_user_id: senderUserId,
        body,
      })
      .select("id")
      .single();

    if (createMessageError) {
      return res.status(500).json({
        ok: false,
        error: createMessageError.message,
      });
    }

    const nowIso = new Date().toISOString();

    const { error: updateThreadError } = await supabaseAdmin
      .from("direct_message_threads")
      .update({
        updated_at: nowIso,
        last_message_at: nowIso,
        sender_last_read_at: nowIso,
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
      threadId,
      messageId: newMessage.id,
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: err?.message ?? "Unknown server error",
    });
  }
}