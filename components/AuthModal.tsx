"use client";

import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  async function handleLoginSubmit() {
    setMessage("");

    const trimmed = email.trim();
    if (!trimmed) {
      setMessage("Please enter your email.");
      return;
    }

    setIsSending(true);

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: "http://localhost:3000",
      },
    });

    setIsSending(false);

    if (error) {
      console.error("Supabase auth error:", error);
      setMessage(error.message || "Something went wrong.");
    } else {
      setMessage("Check your inbox for the login link.");
    }
  }

  function handleOverlayClick() {
    onClose();
  }

  function handleInnerClick(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation(); // don't close when clicking inside the box
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999,
      }}
      onClick={handleOverlayClick}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "#ffffff",
          borderRadius: 12,
          padding: "1.5rem 1.7rem",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.25)",
        }}
        onClick={handleInnerClick}
      >
        <h2
          style={{
            margin: 0,
            marginBottom: "0.5rem",
            fontSize: "1.25rem",
          }}
        >
          Log in
        </h2>
        <p
          style={{
            margin: 0,
            marginBottom: "1rem",
            fontSize: "0.9rem",
            color: "#555",
          }}
        >
          Enter your email and we’ll send you a login link.
        </p>

        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%",
            padding: "0.55rem 0.7rem",
            borderRadius: 6,
            border: "1px solid #ccc",
            fontSize: "0.95rem",
            marginBottom: "0.75rem",
          }}
        />

        {message && (
          <p
            style={{
              margin: 0,
              marginBottom: "0.75rem",
              fontSize: "0.85rem",
              color: message.startsWith("Check your inbox")
                ? "#0a7a3d"
                : "#b00000",
            }}
          >
            {message}
          </p>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.5rem",
            marginTop: "0.25rem",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "0.4rem 0.9rem",
              borderRadius: 999,
              border: "1px solid #ccc",
              background: "#fff",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleLoginSubmit}
            disabled={isSending}
            style={{
              padding: "0.4rem 0.9rem",
              borderRadius: 999,
              border: "none",
              background: isSending ? "#666" : "#000",
              color: "#fff",
              cursor: isSending ? "default" : "pointer",
              fontSize: "0.9rem",
            }}
          >
            {isSending ? "Sending..." : "Send login link"}
          </button>
        </div>
      </div>
    </div>
  );
}
