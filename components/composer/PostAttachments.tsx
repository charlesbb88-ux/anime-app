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
    width?: number | null;
    height?: number | null;
};

// ---------------------------------------------
// Tiny global "only one video plays" coordinator
// ---------------------------------------------
const NOW_PLAYING_EVENT = "post_video_now_playing";
const AUTOSELECT_EVENT = "post_video_autoselect";

type Candidate = {
    token: string;
    distance: number;
    isVisible: boolean;
    updatedAt: number;
};

const candidates = new Map<string, Candidate>();
let rafId: number | null = null;
let lastPicked: string | null = null;

function schedulePick() {
    if (typeof window === "undefined") return;
    if (rafId != null) return;

    rafId = window.requestAnimationFrame(() => {
        rafId = null;

        let best: Candidate | null = null;
        for (const c of candidates.values()) {
            if (!c.isVisible) continue;
            if (!best || c.distance < best.distance) best = c;
        }

        if (!best) return;

        if (best.token !== lastPicked) {
            const prev = lastPicked ? candidates.get(lastPicked) : null;
            const prevDist = prev?.isVisible ? prev.distance : Number.POSITIVE_INFINITY;

            if (best.distance < prevDist - 60) {
                lastPicked = best.token;
                window.dispatchEvent(new CustomEvent(AUTOSELECT_EVENT, { detail: { token: best.token } }));
                announceNowPlaying(best.token);
            }
        }
    });
}

function reportCandidate(token: string, patch: Partial<Candidate>) {
    const prev = candidates.get(token);
    candidates.set(token, {
        token,
        distance: patch.distance ?? prev?.distance ?? Number.POSITIVE_INFINITY,
        isVisible: patch.isVisible ?? prev?.isVisible ?? false,
        updatedAt: Date.now(),
    });
    schedulePick();
}

function removeCandidate(token: string) {
    candidates.delete(token);
    if (lastPicked === token) {
        lastPicked = null;
        schedulePick();
    }
}

function announceNowPlaying(token: string) {
    window.dispatchEvent(new CustomEvent(NOW_PLAYING_EVENT, { detail: { token } }));
}

// ---------------------------------------------
// Aspect ratio helpers
// ---------------------------------------------
function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

function getAspectPct(a: { width?: number | null; height?: number | null }, fallbackPct = 56.25) {
    const w = a.width ?? null;
    const h = a.height ?? null;
    if (!w || !h || w <= 0 || h <= 0) return fallbackPct;
    return clamp((h / w) * 100, 25, 180);
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

    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxStart, setLightboxStart] = useState(0);
    const lightboxItems = useMemo(() => images.map((x) => ({ id: x.id, url: x.url })), [images]);

    function openLightboxAt(index: number) {
        setLightboxStart(index);
        setLightboxOpen(true);
    }

    function stop(e: React.SyntheticEvent) {
        e.preventDefault();
        e.stopPropagation();
    }
    return (
        <div
            className="mt-2 space-y-2"
            onClick={stop}
            onMouseDown={stop}
            onTouchStart={stop}
            onPointerDown={stop}
        >
            {images.length > 0 ? <ImageGrid images={images} onOpen={openLightboxAt} /> : null}

            {videos.map((a, idx) => (
                <TwitterVideoCard
                    key={a.id ?? `vid-${idx}`}
                    url={a.url}
                    token={a.id ?? `vid-${idx}-${a.url}`}
                    width={a.width ?? null}
                    height={a.height ?? null}
                />
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
function ImageGrid({ images, onOpen }: { images: Attachment[]; onOpen: (idx: number) => void }) {
    const n = Math.min(images.length, 4);
    const extra = images.length - 4;

    if (images.length === 1) {
        const a = images[0];
        const paddingTop = `${getAspectPct(a, 56.25)}%`;

        return (
            <button
                type="button"
                onClick={() => onOpen(0)}
                className="block w-full overflow-hidden rounded-lg border border-black bg-white text-left p-0 leading-none"
                style={{ cursor: "zoom-in" }}
            >
                <div className="relative w-full bg-white" style={{ paddingTop }}>
                    <div className="absolute inset-0 bg-neutral-100" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={a.url}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 block w-full h-full"
                        style={{ objectFit: "contain", maxHeight: "70vh" }}
                    />
                </div>
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
                {!loaded ? <div className="absolute inset-0 bg-neutral-100" /> : null}
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
// --------------------
function TwitterVideoCard({
    url,
    token,
    width,
    height,
}: {
    url: string;
    token: string;
    width?: number | null;
    height?: number | null;
}) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const hasPlayedOnceRef = useRef(false);

    const [hasUserUnmuted, setHasUserUnmuted] = useState(false);
    const [showControls, setShowControls] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    const paddingTop = `${getAspectPct({ width, height }, 56.25)}%`;

    // Observe visibility + report distance to viewport center
    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;

        const obs = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                const visible = entry?.isIntersecting ?? false;

                const rect = entry.boundingClientRect;
                const viewportCenterY = window.innerHeight / 2;
                const elemCenterY = rect.top + rect.height / 2;
                const distance = Math.abs(elemCenterY - viewportCenterY);

                reportCandidate(token, { isVisible: visible, distance });

                if (visible && !hasPlayedOnceRef.current) {
                    // ✅ KEY FIX: On iOS Safari, play immediately and synchronously
                    // the very first time the video becomes visible, before the async
                    // director has a chance to fire. This eliminates the black flash
                    // that appears during the rAF + event dispatch roundtrip.
                    // The director will still take over coordination after this point.
                    hasPlayedOnceRef.current = true;
                    el.muted = true;
                    el.volume = 0;
                    const p = el.play();
                    if (p && typeof (p as any).catch === "function") (p as any).catch(() => { });
                    announceNowPlaying(token);
                }

                if (!visible) {
                    el.pause();
                }
            },
            { threshold: [0, 0.35, 0.6, 1] }
        );

        obs.observe(el);

        const updateDistance = () => {
            const r = el.getBoundingClientRect();
            const viewportCenterY = window.innerHeight / 2;
            const elemCenterY = r.top + r.height / 2;
            reportCandidate(token, { distance: Math.abs(elemCenterY - viewportCenterY) });
        };

        window.addEventListener("scroll", updateDistance, { passive: true });
        window.addEventListener("resize", updateDistance);

        return () => {
            obs.disconnect();
            window.removeEventListener("scroll", updateDistance);
            window.removeEventListener("resize", updateDistance);
            removeCandidate(token);
        };
    }, [token]);

    useEffect(() => {
        function handleVisibility() {
            if (document.hidden) videoRef.current?.pause();
        }
        document.addEventListener("visibilitychange", handleVisibility);
        return () => document.removeEventListener("visibilitychange", handleVisibility);
    }, []);

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

    // Obey the global director: only the chosen token plays
    useEffect(() => {
        if (typeof window === "undefined") return;
        const el = videoRef.current;
        if (!el) return;

        const handler = (e: Event) => {
            const ce = e as CustomEvent;
            const activeToken = ce?.detail?.token as string | undefined;
            if (!activeToken) return;

            if (activeToken === token) {
                if (!hasUserUnmuted) {
                    el.muted = true;
                    el.volume = 0;
                    setShowControls(false);
                }
                const p = el.play();
                if (p && typeof (p as any).catch === "function") (p as any).catch(() => { });
            } else {
                el.pause();
            }
        };

        window.addEventListener(AUTOSELECT_EVENT, handler as any);
        return () => window.removeEventListener(AUTOSELECT_EVENT, handler as any);
    }, [token, hasUserUnmuted]);

    function togglePlayPause() {
        const el = videoRef.current;
        if (!el) return;
        if (el.paused) {
            announceNowPlaying(token);
            const p = el.play();
            if (p && typeof (p as any).catch === "function") (p as any).catch(() => { });
        } else {
            el.pause();
        }
    }

    function onTapVideo() {
        const el = videoRef.current;
        if (!el) return;

        if (!hasUserUnmuted) {
            setHasUserUnmuted(true);
            setShowControls(true);
            el.muted = false;
            el.volume = 1;
            announceNowPlaying(token);
            const p = el.play();
            if (p && typeof (p as any).catch === "function") (p as any).catch(() => { });
            return;
        }

        togglePlayPause();
    }

    return (
        <div className="overflow-hidden rounded-lg border border-black bg-white">
            <div className="relative w-full bg-black" style={{ paddingTop }}>
                {/* Always rendered unconditionally behind the video. The video
                    paints over it naturally once it has a frame. Never hide this
                    conditionally — that's what caused the black screen. */}
                <div className="absolute inset-0 bg-neutral-900" />

                <video
                    ref={videoRef}
                    className="absolute inset-0 h-full w-full"
                    src={url}
                    playsInline
                    muted
                    loop
                    preload="auto"
                    controls={showControls}
                    style={{ objectFit: "cover" }}
                    onPlay={() => announceNowPlaying(token)}
                />

                {!hasUserUnmuted ? (
                    <button
                        type="button"
                        onClick={onTapVideo}
                        className="absolute inset-0 z-10 block w-full h-full"
                        style={{ cursor: "pointer", background: "transparent", border: 0, padding: 0 }}
                        aria-label="Unmute video"
                    />
                ) : null}

                {!hasUserUnmuted ? (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onTapVideo();
                        }}
                        className="absolute left-3 bottom-3 z-20 flex items-center gap-2 rounded-full bg-black/60 px-3 py-2"
                        style={{ cursor: "pointer" }}
                        aria-label="Tap to unmute"
                    >
                        <MuteIcon />
                        <div className="text-white text-xs font-semibold">Tap to unmute</div>
                    </button>
                ) : null}
            </div>
        </div>
    );
}

function MuteIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M11 5L6 9H3v6h3l5 4V5z" stroke="white" strokeWidth="2" strokeLinejoin="round" />
            <path d="M16 9l5 6M21 9l-5 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
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