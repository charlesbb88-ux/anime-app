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

export type MyThreadMessage = {
  id: string;
  threadId: string;
  authorUserId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
};

export type MyThreadResult =
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
        owner: {
          userId: string;
          username: string | null;
          avatarUrl: string | null;
        } | null;
        sender: {
          userId: string;
          username: string | null;
          avatarUrl: string | null;
        } | null;
      } | null;
      messages: MyThreadMessage[];
    }
  | {
      ok: false;
      error: string;
    };

async function getAccessToken(): Promise<string> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new Error("You must be logged in to send a message");
  }

  return accessToken;
}

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

  const accessToken = await getAccessToken();

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

  return response.json();
}

export async function fetchMyThreadWithOwner(): Promise<MyThreadResult> {
  const accessToken = await getAccessToken();

  const response = await fetch("/api/direct-messages/my-thread", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.json();
}