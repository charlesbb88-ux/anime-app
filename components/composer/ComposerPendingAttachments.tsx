"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { PendingAttachment } from "@/lib/postAttachments";

type Props = {
  items: PendingAttachment[];
  onRemove: (index: number) => void;
};

function Thumb({ file }: { file: File }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!src) return null;

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt=""
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
      }}
    />
  );
}

export default function ComposerPendingAttachments({ items, onRemove }: Props) {
  if (!items || items.length === 0) return null;

  return (
    <div style={{ padding: "0 0.8rem 0.6rem 0.8rem" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 10,
          marginTop: 8,
        }}
      >
        {items.map((a, idx) => {
          if (a.kind === "image") {
            return (
              <div
                key={`img-${idx}`}
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "16 / 10",
                  borderRadius: 12,
                  overflow: "hidden",
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "#f3f4f6",
                }}
              >
                <Thumb file={a.file} />

                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onRemove(idx)}
                  title="Remove"
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    border: "1px solid rgba(0,0,0,0.2)",
                    background: "rgba(255,255,255,0.9)",
                    cursor: "pointer",
                    fontSize: 16,
                    lineHeight: "28px",
                    padding: 0,
                  }}
                >
                  ×
                </button>
              </div>
            );
          }

          // youtube
          const thumb = a.youtubeId
            ? `https://img.youtube.com/vi/${a.youtubeId}/hqdefault.jpg`
            : null;

          return (
            <div
              key={`yt-${idx}`}
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "16 / 10",
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid rgba(0,0,0,0.12)",
                background: "#000",
              }}
            >
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumb}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    opacity: 0.92,
                  }}
                />
              ) : null}

              {/* play badge */}
              <div
                style={{
                  position: "absolute",
                  left: 10,
                  bottom: 10,
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.92)",
                  border: "1px solid rgba(0,0,0,0.12)",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                YouTube
              </div>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onRemove(idx)}
                title="Remove"
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  border: "1px solid rgba(0,0,0,0.2)",
                  background: "rgba(255,255,255,0.9)",
                  cursor: "pointer",
                  fontSize: 16,
                  lineHeight: "28px",
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}