"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { PendingAttachment } from "@/lib/postAttachments";

type Props = {
  items: PendingAttachment[];
  onRemove: (index: number) => void;
};

function ObjectUrlMedia({ file }: { file: File }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!src) return null;

  const isVideo = (file.type || "").startsWith("video/");

  if (isVideo) {
    return (
      <video
        src={src}
        muted
        loop
        playsInline
        preload="metadata"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
      />
    );
  }

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

function RemoveBtn({
  onClick,
  disabled = false,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={disabled ? "Uploading…" : "Remove"}
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        width: 28,
        height: 28,
        borderRadius: 999,
        border: "1px solid rgba(0,0,0,0.2)",
        background: "rgba(255,255,255,0.92)",
        cursor: disabled ? "default" : "pointer",
        fontSize: 16,
        lineHeight: "28px",
        padding: 0,
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      ×
    </button>
  );
}

function Spinner() {
  return (
    <div
      style={{
        width: 16,
        height: 16,
        borderRadius: 999,
        border: "2px solid rgba(255,255,255,0.55)",
        borderTopColor: "rgba(255,255,255,1)",
        animation: "spin 0.8s linear infinite",
      }}
    />
  );
}

function StatusOverlay({
  status,
  errorText,
}: {
  status?: any;
  errorText?: string | null;
}) {
  if (status !== "uploading" && status !== "error") return null;

  const isErr = status === "error";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "flex-start",
        padding: 10,
        background: isErr ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.35)",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          borderRadius: 999,
          background: isErr ? "rgba(239,68,68,0.95)" : "rgba(0,0,0,0.75)",
          border: "1px solid rgba(255,255,255,0.15)",
          color: "#fff",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {isErr ? null : <Spinner />}
        <span>{isErr ? "Failed" : "Uploading…"}</span>
      </div>

      {isErr && errorText ? (
        <div
          style={{
            position: "absolute",
            left: 10,
            right: 10,
            top: 10,
            padding: "8px 10px",
            borderRadius: 10,
            background: "rgba(0,0,0,0.65)",
            color: "rgba(255,255,255,0.92)",
            fontSize: 12,
            lineHeight: 1.25,
          }}
        >
          {errorText}
        </div>
      ) : null}

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

export default function ComposerPendingAttachments({ items, onRemove }: Props) {
  if (!items || items.length === 0) return null;

  const uploadingCount = useMemo(
    () => items.filter((a: any) => a?.status === "uploading").length,
    [items]
  );

  return (
    <div style={{ padding: "0 0.8rem 0.6rem 0.8rem" }}>
      {uploadingCount > 0 ? (
        <div
          style={{
            marginTop: 8,
            marginBottom: 2,
            fontSize: 12,
            color: "#444",
            fontWeight: 600,
          }}
        >
          Uploading {uploadingCount}/{items.length}…
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 10,
          marginTop: 8,
        }}
      >
        {items.map((a: any, idx) => {
          const status = a?.status as ("queued" | "uploading" | "error" | undefined);
          const errText = (a?.error as string | null | undefined) ?? null;
          const disableRemove = status === "uploading";

          // -----------------------
          // IMAGE (includes gif)
          // -----------------------
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
                <ObjectUrlMedia file={a.file} />
                <StatusOverlay status={status} errorText={errText} />
                <RemoveBtn disabled={disableRemove} onClick={() => onRemove(idx)} />
              </div>
            );
          }

          // -----------------------
          // VIDEO
          // -----------------------
          if (a.kind === "video") {
            return (
              <div
                key={`vid-${idx}`}
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
                <ObjectUrlMedia file={a.file} />

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
                    fontWeight: 700,
                  }}
                >
                  Video
                </div>

                <StatusOverlay status={status} errorText={errText} />
                <RemoveBtn disabled={disableRemove} onClick={() => onRemove(idx)} />
              </div>
            );
          }

          // -----------------------
          // YOUTUBE
          // -----------------------
          if (a.kind === "youtube") {
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
                    fontWeight: 700,
                  }}
                >
                  YouTube
                </div>

                <StatusOverlay status={status} errorText={errText} />
                <RemoveBtn disabled={disableRemove} onClick={() => onRemove(idx)} />
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}