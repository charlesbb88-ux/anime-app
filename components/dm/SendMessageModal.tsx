import { useEffect, useMemo, useState } from "react";
import {
  fetchMyThreadWithOwner,
  sendDirectMessageToOwner,
  type MyThreadMessage,
} from "@/lib/directMessages";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  open: boolean;
  onClose: () => void;
};

function formatTime(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString();
}

export default function SendMessageModal({ open, onClose }: Props) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [messages, setMessages] = useState<MyThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  async function loadThread() {
    setThreadLoading(true);
    setThreadError(null);

    try {
      const result = await fetchMyThreadWithOwner();

      if (!result.ok) {
        setThreadError(result.error);
        setMessages([]);
        return;
      }

      setMessages(result.messages);
    } catch (err: any) {
      setThreadError(err?.message ?? "Failed to load conversation");
      setMessages([]);
    } finally {
      setThreadLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;

    async function loadCurrentUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setCurrentUserId(user?.id ?? null);
    }

    loadCurrentUser();
    loadThread();
  }, [open]);

  const hasMessages = useMemo(() => messages.length > 0, [messages]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = body.trim();

    if (!trimmed) {
      setError("Message cannot be empty");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await sendDirectMessageToOwner(trimmed);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setBody("");
      await loadThread();
    } catch (err: any) {
      setError(err?.message ?? "Failed to send message");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "700px",
          maxWidth: "100%",
          height: "80vh",
          background: "#121218",
          border: "1px solid #23232a",
          borderRadius: "16px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #23232a",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0 }}>Message</h2>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#2a2a35",
              color: "#fff",
              border: "none",
              padding: "8px 12px",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {threadLoading ? (
            <div style={{ color: "#b3b3bd" }}>Loading conversation...</div>
          ) : threadError ? (
            <div style={{ color: "#ff8c8c" }}>{threadError}</div>
          ) : !hasMessages ? (
            <div style={{ color: "#b3b3bd" }}>
              No messages yet. Send the first one below.
            </div>
          ) : (
            messages.map((message) => {
              const isMine = message.authorUserId === currentUserId;

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
                      maxWidth: "75%",
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
                        color: "#fff",
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
            })
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            borderTop: "1px solid #23232a",
            padding: "16px",
          }}
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Write your message..."
            style={{
              width: "100%",
              borderRadius: "10px",
              padding: "12px",
              background: "#0f0f14",
              color: "#fff",
              border: "1px solid #2a2a35",
              resize: "vertical",
            }}
          />

          {error ? (
            <div style={{ color: "#ff8c8c", marginTop: "8px" }}>{error}</div>
          ) : null}

          <div
            style={{
              marginTop: "12px",
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
            }}
          >
            <button
              type="submit"
              disabled={loading}
              style={{
                background: "#fff",
                color: "#000",
                border: "none",
                padding: "8px 12px",
                borderRadius: "8px",
                fontWeight: 700,
                cursor: loading ? "default" : "pointer",
              }}
            >
              {loading ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}