import { supabase } from "@/lib/supabaseClient";

type SendDirectMessageResult =
  | {
      ok: true;
      threadId: string;
      messageId: string;
    }
  | {
      ok: false;
      error: string;
    };

export async function sendDirectMessageToOwner(
  body: string
): Promise<SendDirectMessageResult> {
  const trimmedBody = body.trim();

  if (!trimmedBody) {
    return {
      ok: false,
      error: "Message body is required",
    };
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    return {
      ok: false,
      error: sessionError.message,
    };
  }

  const accessToken = session?.access_token;

  if (!accessToken) {
    return {
      ok: false,
      error: "You must be logged in to send a message",
    };
  }

  const response = await fetch("/api/direct-messages/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      body: trimmedBody,
    }),
  });

  const data = (await response.json()) as SendDirectMessageResult;

  return data;
}