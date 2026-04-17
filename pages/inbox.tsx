import { useEffect, useMemo, useState } from "react";
import {
  fetchOwnerInbox,
  fetchOwnerThread,
  replyToThread,
  type InboxThread,
  type ThreadMessage,
} from "@/lib/directMessagesClient";

type ActiveThreadState = {
  id: string;
  senderUsername: string | null;
  senderAvatarUrl: string | null;
  senderUserId: string;
  messages: ThreadMessage[];
};

function formatTime(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString();
}

function getDisplayName(thread: InboxThread) {
  return thread.senderUsername?.trim() || "Unknown user";
}

export default function InboxPage() {
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [threadsError, setThreadsError] = useState<string | null>(null);

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [activeThread, setActiveThread] = useState<ActiveThreadState | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);

  const [replyBody, setReplyBody] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  async function loadInbox(selectThreadId?: string) {
    setThreadsLoading(true);
    setThreadsError(null);

    try {
      const result = await fetchOwnerInbox();

      if (!result.ok) {
        setThreadsError(result.error);
        setThreads([]);
        return;
      }

      setThreads(result.threads);

      const nextThreadId =
        selectThreadId ??
        activeThreadId ??
        result.threads[0]?.threadId ??
        null;

      setActiveThreadId(nextThreadId);
    } catch (err: any) {
      setThreadsError(err?.message ?? "Failed to load inbox");
      setThreads([]);
    } finally {
      setThreadsLoading(false);
    }
  }

  async function loadThread(threadId: string) {
    setThreadLoading(true);
    setThreadError(null);

    try {
      const result = await fetchOwnerThread(threadId);

      if (!result.ok) {
        setThreadError(result.error);
        setActiveThread(null);
        return;
      }

      setActiveThread({
        id: result.thread.id,
        senderUsername: result.thread.sender?.username ?? null,
        senderAvatarUrl: result.thread.sender?.avatarUrl ?? null,
        senderUserId: result.thread.senderUserId,
        messages: result.messages,
      });

      setThreads((prev) =>
        prev.map((thread) =>
          thread.threadId === threadId
            ? {
              ...thread,
              ownerLastReadAt: new Date().toISOString(),
            }
            : thread
        )
      );
    } catch (err: any) {
      setThreadError(err?.message ?? "Failed to load thread");
      setActiveThread(null);
    } finally {
      setThreadLoading(false);
    }
  }

  useEffect(() => {
    loadInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeThreadId) {
      setActiveThread(null);
      return;
    }

    loadThread(activeThreadId);
  }, [activeThreadId]);

  const selectedThreadSummary = useMemo(
    () => threads.find((thread) => thread.threadId === activeThreadId) ?? null,
    [threads, activeThreadId]
  );

  async function handleReplySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!activeThreadId) return;

    const trimmedBody = replyBody.trim();

    if (!trimmedBody) {
      setReplyError("Message body is required");
      return;
    }

    setReplyLoading(true);
    setReplyError(null);

    try {
      const result = await replyToThread(activeThreadId, trimmedBody);

      if (!result.ok) {
        setReplyError(result.error);
        return;
      }

      setReplyBody("");

      await loadThread(activeThreadId);
      await loadInbox(activeThreadId);
    } catch (err: any) {
      setReplyError(err?.message ?? "Failed to send reply");
    } finally {
      setReplyLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b0b0f",
        color: "#fff",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            fontSize: "32px",
            fontWeight: 700,
            marginBottom: "20px",
          }}
        >
          Inbox
        </h1>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "360px 1fr",
            gap: "20px",
            minHeight: "75vh",
          }}
        >
          <div
            style={{
              border: "1px solid #23232a",
              borderRadius: "16px",
              background: "#121218",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px",
                borderBottom: "1px solid #23232a",
                fontWeight: 700,
              }}
            >
              Conversations
            </div>

            {threadsLoading ? (
              <div style={{ padding: "16px", color: "#b3b3bd" }}>
                Loading inbox...
              </div>
            ) : threadsError ? (
              <div style={{ padding: "16px", color: "#ff8c8c" }}>
                {threadsError}
              </div>
            ) : threads.length === 0 ? (
              <div style={{ padding: "16px", color: "#b3b3bd" }}>
                No messages yet.
              </div>
            ) : (
              <div>
                {threads.map((thread) => {
                  const isActive = thread.threadId === activeThreadId;
                  const unread =
                    !thread.ownerLastReadAt ||
                    new Date(thread.lastMessageAt).getTime() >
                    new Date(thread.ownerLastReadAt).getTime();

                  return (
                    <button
                      key={thread.threadId}
                      type="button"
                      onClick={() => setActiveThreadId(thread.threadId)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        background: isActive ? "#1b1b24" : "transparent",
                        border: "none",
                        borderBottom: "1px solid #23232a",
                        padding: "14px 16px",
                        cursor: "pointer",
                        color: "#fff",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: unread ? 700 : 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {getDisplayName(thread)}
                        </div>

                        {unread ? (
                          <div
                            style={{
                              minWidth: "10px",
                              width: "10px",
                              height: "10px",
                              borderRadius: "999px",
                              background: "#ff4d4f",
                              flexShrink: 0,
                            }}
                          />
                        ) : null}
                      </div>

                      <div
                        style={{
                          marginTop: "6px",
                          fontSize: "12px",
                          color: "#9d9daa",
                        }}
                      >
                        {formatTime(thread.lastMessageAt)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div
            style={{
              border: "1px solid #23232a",
              borderRadius: "16px",
              background: "#121218",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px",
                borderBottom: "1px solid #23232a",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: "18px" }}>
                {activeThread
                  ? activeThread.senderUsername?.trim() || "Unknown user"
                  : "Select a conversation"}
              </div>

              {selectedThreadSummary ? (
                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "12px",
                    color: "#9d9daa",
                  }}
                >
                  Last message: {formatTime(selectedThreadSummary.lastMessageAt)}
                </div>
              ) : null}
            </div>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px",
              }}
            >
              {threadLoading ? (
                <div style={{ color: "#b3b3bd" }}>Loading conversation...</div>
              ) : threadError ? (
                <div style={{ color: "#ff8c8c" }}>{threadError}</div>
              ) : !activeThread ? (
                <div style={{ color: "#b3b3bd" }}>
                  Choose a conversation from the left.
                </div>
              ) : activeThread.messages.length === 0 ? (
                <div style={{ color: "#b3b3bd" }}>No messages yet.</div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  {activeThread.messages.map((message) => {
                    const isMine = message.authorUserId !== activeThread.senderUserId;

                    return (
                      <div
                        key={message.id}
                        style={{
                          display: "flex",
                          justifyContent: isMine ? "flex-end" : "flex-start",
                        }}
                      >
                        <div
                          style={{
                            maxWidth: "70%",
                            padding: "12px 14px",
                            borderRadius: "14px",
                            background: isMine ? "#2a2a38" : "#1b1b24",
                            border: "1px solid #2f2f3b",
                          }}
                        >
                          <div
                            style={{
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              lineHeight: 1.45,
                            }}
                          >
                            {message.body}
                          </div>

                          <div
                            style={{
                              marginTop: "8px",
                              fontSize: "11px",
                              color: "#9d9daa",
                            }}
                          >
                            {formatTime(message.createdAt)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <form
              onSubmit={handleReplySubmit}
              style={{
                borderTop: "1px solid #23232a",
                padding: "16px",
              }}
            >
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder={
                  activeThread ? "Write your reply..." : "Select a thread first"
                }
                disabled={!activeThread || replyLoading}
                rows={4}
                style={{
                  width: "100%",
                  resize: "vertical",
                  borderRadius: "12px",
                  border: "1px solid #2a2a35",
                  background: "#0f0f14",
                  color: "#fff",
                  padding: "12px",
                  outline: "none",
                  font: "inherit",
                }}
              />

              {replyError ? (
                <div
                  style={{
                    marginTop: "10px",
                    color: "#ff8c8c",
                    fontSize: "14px",
                  }}
                >
                  {replyError}
                </div>
              ) : null}

              <div
                style={{
                  marginTop: "12px",
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="submit"
                  disabled={!activeThread || replyLoading}
                  style={{
                    border: "none",
                    borderRadius: "10px",
                    background: !activeThread || replyLoading ? "#3a3a44" : "#fff",
                    color: !activeThread || replyLoading ? "#aaa" : "#000",
                    padding: "10px 16px",
                    fontWeight: 700,
                    cursor: !activeThread || replyLoading ? "default" : "pointer",
                  }}
                >
                  {replyLoading ? "Sending..." : "Send reply"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}