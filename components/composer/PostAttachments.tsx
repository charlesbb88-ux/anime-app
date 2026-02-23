// components/composer/PostAttachments.tsx
"use client";

import React, { useMemo, useState } from "react";
import MediaLightbox from "@/components/composer/MediaLightbox";

type Attachment = {
    id?: string;
    kind: "image" | "youtube";
    url: string;
    meta?: any;
    sort_order?: number;
};

export default function PostAttachments({ items }: { items: Attachment[] }) {
    const sorted = useMemo(() => {
        if (!items || items.length === 0) return [];
        return [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }, [items]);

    if (sorted.length === 0) return null;

    // Separate kinds so we can do Twitter-style image grids
    const images = sorted.filter((a) => a.kind === "image");
    const yts = sorted.filter((a) => a.kind === "youtube");

    // lightbox state
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
            {images.length > 0 ? (
                <ImageGrid images={images} onOpen={openLightboxAt} />
            ) : null}

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
    // Full width, natural height, with a max-height cap.
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
                    style={{
                        maxHeight: "70vh",
                        objectFit: "contain",
                    }}
                />
            </button>
        );
    }

    const layout = n === 2 ? "two" : n === 3 ? "three" : "four";

    // ✅ Multi-image grid stays “cool” (cropped tiles) exactly like before
    return (
        <div className="overflow-hidden rounded-lg border border-black bg-white">
            <div className={["grid gap-[2px]", "grid-cols-2"].join(" ")}>
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
            {/* fixed ratio + object-cover ONLY for multi-image grids */}
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

function YouTubeCard({ url }: { url: string }) {
    // Accept either:
    // - url = full youtube url
    // - url = just the youtubeId
    const raw = (url || "").trim();
    const youtubeId =
        raw.length === 11 && !raw.includes("/") ? raw : extractYouTubeId(raw);

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
        if (embedIdx >= 0 && parts[embedIdx + 1]?.length === 11) {
            return parts[embedIdx + 1];
        }

        // youtube.com/shorts/<id>
        const shortsIdx = parts.indexOf("shorts");
        if (shortsIdx >= 0 && parts[shortsIdx + 1]?.length === 11) {
            return parts[shortsIdx + 1];
        }

        return null;
    } catch {
        return null;
    }
}