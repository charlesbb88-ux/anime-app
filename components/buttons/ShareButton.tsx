"use client";

import React, { useEffect, useRef, useState } from "react";

function ShareArrowIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2v13" />
      <path d="m16 6-4-4-4 4" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    </svg>
  );
}

async function copyTextToClipboard(text: string) {
  // Modern API (works on https + localhost)
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    await navigator.clipboard.writeText(text);
    return;
  }

  // Fallback (older browsers / weird contexts)
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "true");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  ta.style.top = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

export default function ShareButton({
  iconSize,
  path,
}: {
  iconSize: number;
  path: string; // e.g. "/posts/<id>"
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();

    const url = `${window.location.origin}${path}`;

    try {
      await copyTextToClipboard(url);
      setCopied(true);

      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      // If something blocks clipboard, you can optionally fallback to prompt:
      // window.prompt("Copy this link:", url);
      console.error("Copy failed:", err);
    }
  }

  const iconButtonBase: React.CSSProperties = {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: "6px",
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.12s ease, transform 0.12s ease, color 0.12s ease",
    color: "#555",
    position: "relative",
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      style={iconButtonBase}
      aria-label="Copy link"
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.color = "#1d9bf0";
        e.currentTarget.style.background = "#1d9bf01a";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.color = "#555";
        e.currentTarget.style.background = "transparent";
      }}
    >
      <ShareArrowIcon size={iconSize} />

      {/* Tiny toast */}
      {copied && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#111",
            color: "#fff",
            fontSize: "0.75rem",
            padding: "6px 8px",
            borderRadius: 8,
            whiteSpace: "nowrap",
            boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
            pointerEvents: "none",
          }}
        >
          Link Copied
        </div>
      )}
    </button>
  );
}
