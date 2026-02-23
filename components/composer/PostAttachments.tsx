// components/composer/PostAttachments.tsx
"use client";

import React from "react";

type Attachment = {
  id?: string;
  kind: "image" | "youtube";
  url: string;
  meta?: any;
  sort_order?: number;
};

export default function PostAttachments({ items }: { items: Attachment[] }) {
  if (!items || items.length === 0) return null;

  const sorted = [...items].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  return (
    <div className="mt-2 space-y-2">
      {sorted.map((a, idx) => {
        if (a.kind === "youtube") {
          // Accept either:
          // - url = full youtube url
          // - url = just the youtubeId
          const raw = (a.url || "").trim();
          const youtubeId =
            raw.length === 11 && !raw.includes("/") ? raw : extractYouTubeId(raw);

          if (!youtubeId) return null;

          return (
            <div
              key={a.id ?? `yt-${idx}`}
              className="overflow-hidden rounded-lg border border-black bg-white"
            >
              <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                <iframe
                  className="absolute inset-0 h-full w-full"
                  src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
                  title="YouTube video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          );
        }

        // image/gif
        return (
          <div
            key={a.id ?? `img-${idx}`}
            className="overflow-hidden rounded-lg border border-black bg-white"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.url}
              alt=""
              className="block w-full h-auto"
              loading="lazy"
            />
          </div>
        );
      })}
    </div>
  );
}

function extractYouTubeId(input: string): string | null {
  try {
    const u = new URL(input);
    // youtu.be/<id>
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "").slice(0, 11);
      return id.length === 11 ? id : null;
    }
    // youtube.com/watch?v=<id>
    const v = u.searchParams.get("v");
    if (v && v.length === 11) return v;
    // youtube.com/embed/<id>
    const parts = u.pathname.split("/").filter(Boolean);
    const embedIdx = parts.indexOf("embed");
    if (embedIdx >= 0 && parts[embedIdx + 1]?.length === 11) return parts[embedIdx + 1];
    return null;
  } catch {
    return null;
  }
}