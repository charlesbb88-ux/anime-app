// components/composer/PostAttachments.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import MediaLightbox from "@/components/composer/MediaLightbox";

type Attachment = {
  id?: string;
  kind: "image" | "gif" | "youtube" | "video";
  url: string;
  meta?: any;
  sort_order?: number;
};

// ---------------------------------------------
// Tiny global "only one video plays" coordinator
// (no libraries; safe in Next client)
// ---------------------------------------------
const NOW_PLAYING_EVENT = "post_video_now_playing";

function announceNowPlaying(token: string) {
  window.dispatchEvent(new CustomEvent(NOW_PLAYING_EVENT, { detail: { token } }));
}

function subscribeNowPlaying(fn: (token: string) => void) {
  const handler = (e: Event) => {
    const ce = e as CustomEvent;
    const token = ce?.detail?.token;
    if (typeof token === "string") fn(token);
  };
  window.addEventListener(NOW_PLAYING_EVENT, handler as any);
  return () => window.removeEventListener(NOW_PLAYING_EVENT, handler as any);
}

export default function PostAttachments({ items }: { items: Attachment[] }) {
  const sorted = useMemo(() => {
    if (!items || items.length === 0) return [];
    return [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [items]);

  if (sorted.length === 0) return null;

  const images = sorted.filter((a) => a.kind === "image" || a.kind === "gif");
  const videos = sorted.filter((a) => a.kind === "video");
  const yts = sorted.filter((a) => a.kind === "youtube");

  // lightbox state (images/gifs only)
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxStart, setLightboxStart] = useState(0);

  const lightboxItems = useMemo(
    () => images.map((x) => ({ id: x.id, url: x.url })),
    [images]
  );

  function openLightboxAt(index: number) {
    setLightboxStart(index);
    setLightboxOpen(true);
  }

  return (
    <div className="mt-2 space-y-2">
      {images.length > 0 ? <ImageGrid images={images} onOpen={openLightboxAt} /> : null}

      {videos.map((a, idx) => (
        <TwitterVideoCard key={a.id ?? `vid-${idx}`} url={a.url} token={a.id ?? `vid-${idx}-${a.url}`} />
      ))}

      {yts.map((a, idx) => (
        <YouTubeCard key={a.id ?? `yt-${idx}`} url={a.url} />
      ))}

      <MediaLightbox
        open={lightboxOpen}
        items={lightboxItems}
        startIndex={lightboxStart}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}

// --------------------
// Images / GIF grid
// --------------------
function ImageGrid({
  images,
  onOpen,
}: {
  images: Attachment[];
  onOpen: (idx: number) => void;
}) {
  const n = Math.min(images.length, 4);
  const extra = images.length - 4;

  // ✅ If only 1 image: DO NOT crop and DO NOT shrink into a centered box.
  if (images.length === 1) {
    const a = images[0];

    return (
      <button
        type="button"
        onClick={() => onOpen(0)}
        className="block w-full overflow-hidden rounded-lg border border-black bg-white text-left p-0 leading-none"
        style={{ cursor: "zoom-in" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={a.url}
          alt=""
          loading="lazy"
          className="block w-full h-auto"
          style={{ maxHeight: "70vh", objectFit: "contain" }}
        />
      </button>
    );
  }

  const layout = n === 2 ? "two" : n === 3 ? "three" : "four";

  return (
    <div className="overflow-hidden rounded-lg border border-black bg-white">
      <div className="grid grid-cols-2 gap-[2px]">
        {layout === "two" ? (
          <>
            <ImgTileCrop a={images[0]} onClick={() => onOpen(0)} />
            <ImgTileCrop a={images[1]} onClick={() => onOpen(1)} />
          </>
        ) : layout === "three" ? (
          <>
            <ImgTileCrop a={images[0]} onClick={() => onOpen(0)} />
            <ImgTileCrop a={images[1]} onClick={() => onOpen(1)} />
            <div className="col-span-2">
              <ImgTileCrop a={images[2]} onClick={() => onOpen(2)} />
            </div>
          </>
        ) : (
          <>
            <ImgTileCrop a={images[0]} onClick={() => onOpen(0)} />
            <ImgTileCrop a={images[1]} onClick={() => onOpen(1)} />
            <ImgTileCrop a={images[2]} onClick={() => onOpen(2)} />
            <ImgTileCrop
              a={images[3]}
              onClick={() => onOpen(3)}
              overlayCount={extra > 0 ? extra : 0}
            />
          </>
        )}
      </div>
    </div>
  );
}

function ImgTileCrop({
  a,
  overlayCount = 0,
  onClick,
}: {
  a: Attachment;
  overlayCount?: number;
  onClick: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-full bg-white text-left block p-0 leading-none border-0"
      style={{ cursor: "zoom-in" }}
    >
      <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={a.url}
          alt=""
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className={[
            "absolute inset-0 h-full w-full object-cover",
            loaded ? "opacity-100" : "opacity-0",
            "transition-opacity duration-150",
          ].join(" ")}
        />
        {!loaded ? <div className="absolute inset-0 bg-neutral-100" /> : null}

        {overlayCount > 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55">
            <div className="text-white text-xl font-semibold">{`+${overlayCount}`}</div>
          </div>
        ) : null}
      </div>
    </button>
  );
}

// --------------------
// Twitter-ish video card
// - autoplay muted when visible
// - only one plays at a time (global)
// - controls hidden until unmuted
// - tap to unmute + show controls
// --------------------
function TwitterVideoCard({ url, token }: { url: string; token: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isVisible, setIsVisible] = useState(false);
  const [hasUserUnmuted, setHasUserUnmuted] = useState(false); // once they unmute, we keep controls visible
  const [showControls, setShowControls] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Observe visibility
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const v = entries[0]?.isIntersecting ?? false;
        setIsVisible(v);
      },
      {
        threshold: [0, 0.6, 1],
      }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Subscribe: pause if someone else starts
  useEffect(() => {
    if (typeof window === "undefined") return;

    return subscribeNowPlaying((activeToken) => {
      const el = videoRef.current;
      if (!el) return;
      if (activeToken !== token) {
        el.pause();
      }
    });
  }, [token]);

  // Keep local playing state in sync
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);

    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, []);

  // Autoplay behavior when visible (muted only, unless user already unmuted)
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (!isVisible) {
      el.pause();
      return;
    }

    // If user unmuted, we still autoplay when visible, but keep their unmuted preference.
    // If not unmuted, autoplay must be muted to succeed.
    if (!hasUserUnmuted) {
      el.muted = true;
      el.volume = 0;
      setShowControls(false);
    }

    // Only one plays: claim "now playing" before play attempt
    announceNowPlaying(token);

    const p = el.play();
    if (p && typeof (p as any).catch === "function") {
      (p as any).catch(() => {
        // Autoplay might fail on some devices even muted; ignore.
      });
    }
  }, [isVisible, hasUserUnmuted, token]);

  function togglePlayPause() {
    const el = videoRef.current;
    if (!el) return;

    if (el.paused) {
      announceNowPlaying(token);
      const p = el.play();
      if (p && typeof (p as any).catch === "function") (p as any).catch(() => {});
    } else {
      el.pause();
    }
  }

  function onTapVideo() {
    const el = videoRef.current;
    if (!el) return;

    // First tap: unmute + show controls (Twitter vibe)
    if (!hasUserUnmuted) {
      setHasUserUnmuted(true);
      setShowControls(true);

      el.muted = false;
      el.volume = 1;

      announceNowPlaying(token);
      const p = el.play();
      if (p && typeof (p as any).catch === "function") (p as any).catch(() => {});
      return;
    }

    // After unmuted: tap toggles play/pause
    togglePlayPause();
  }

  return (
    <div className="overflow-hidden rounded-lg border border-black bg-white">
      <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full"
          src={url}
          playsInline
          muted
          loop
          preload="metadata"
          controls={showControls}
          // Twitter-y crop
          style={{ objectFit: "cover" }}
          // If user uses native controls, still enforce single-playing
          onPlay={() => announceNowPlaying(token)}
        />

        {/* Click layer (we don't want to rely on native controls until unmuted) */}
        <button
          type="button"
          onClick={onTapVideo}
          className="absolute inset-0 block w-full h-full"
          style={{
            cursor: hasUserUnmuted ? "pointer" : "pointer",
            background: "transparent",
            border: 0,
            padding: 0,
          }}
          aria-label={hasUserUnmuted ? "Play/Pause video" : "Unmute video"}
        />

        {/* Overlay: muted badge (only before user unmute) */}
        {!hasUserUnmuted ? (
          <div className="absolute left-3 bottom-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-2">
            <MuteIcon />
            <div className="text-white text-xs font-semibold">Tap to unmute</div>
          </div>
        ) : null}

        {/* Optional: play indicator when paused after unmute */}
        {hasUserUnmuted && !isPlaying ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-full bg-black/55 p-4">
              <PlayIcon />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MuteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M11 5L6 9H3v6h3l5 4V5z"
        stroke="white"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M16 9l5 6M21 9l-5 6"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 7l10 5-10 5V7z"
        fill="white"
      />
    </svg>
  );
}

// --------------------
// YouTube
// --------------------
function YouTubeCard({ url }: { url: string }) {
  const raw = (url || "").trim();
  const youtubeId = raw.length === 11 && !raw.includes("/") ? raw : extractYouTubeId(raw);
  if (!youtubeId) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-black bg-white">
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

function extractYouTubeId(input: string): string | null {
  try {
    const u = new URL(input);

    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "").slice(0, 11);
      return id.length === 11 ? id : null;
    }

    const v = u.searchParams.get("v");
    if (v && v.length === 11) return v;

    const parts = u.pathname.split("/").filter(Boolean);
    const embedIdx = parts.indexOf("embed");
    if (embedIdx >= 0 && parts[embedIdx + 1]?.length === 11) return parts[embedIdx + 1];

    const shortsIdx = parts.indexOf("shorts");
    if (shortsIdx >= 0 && parts[shortsIdx + 1]?.length === 11) return parts[shortsIdx + 1];

    return null;
  } catch {
    return null;
  }
}