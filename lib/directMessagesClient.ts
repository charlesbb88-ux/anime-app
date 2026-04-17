import { supabase } from "@/lib/supabaseClient";

export type InboxThread = {
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

export type ThreadMessage = {
  id: string;
  threadId: string;
  authorUserId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
};

export type ThreadParticipant = {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
};

export type ThreadResponse = {
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
  };
  messages: ThreadMessage[];
} | {
  ok: false;
  error: string;
};

export type InboxResponse = {
  ok: true;
  threads: InboxThread[];
} | {
  ok: false;
  error: string;
};

export type ReplyResponse = {
  ok: true;
  messageId: string;
  threadId: string;
} | {
  ok: false;
  error: string;
};

async function getAccessToken(): Promise<string> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new Error("You must be logged in");
  }

  return accessToken;
}

export async function fetchOwnerInbox(): Promise<InboxResponse> {
  const accessToken = await getAccessToken();

  const response = await fetch("/api/direct-messages/inbox", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.json();
}

export async function fetchOwnerThread(threadId: string): Promise<ThreadResponse> {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `/api/direct-messages/thread?threadId=${encodeURIComponent(threadId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return response.json();
}

export async function replyToThread(
  threadId: string,
  body: string
): Promise<ReplyResponse> {
  const trimmedBody = body.trim();

  if (!trimmedBody) {
    return {
      ok: false,
      error: "Message body is required",
    };
  }

  const accessToken = await getAccessToken();

  const response = await fetch("/api/direct-messages/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      threadId,
      body: trimmedBody,
    }),
  });

  return response.json();
}