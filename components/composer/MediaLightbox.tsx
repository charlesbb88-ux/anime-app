"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Item = {
  id?: string;
  url: string;
};

type Props = {
  open: boolean;
  items: Item[];
  startIndex: number;
  onClose: () => void;
};

export default function MediaLightbox({ open, items, startIndex, onClose }: Props) {
  const safeItems = useMemo(() => items?.filter(Boolean) ?? [], [items]);
  const [idx, setIdx] = useState<number>(Math.max(0, Math.min(startIndex, safeItems.length - 1)));

  // keep idx in sync when opening
  useEffect(() => {
    if (!open) return;
    setIdx(Math.max(0, Math.min(startIndex, safeItems.length - 1)));
  }, [open, startIndex, safeItems.length]);

  // lock scroll + keybinds
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setIdx((v) => (safeItems.length ? (v + 1) % safeItems.length : 0));
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIdx((v) => (safeItems.length ? (v - 1 + safeItems.length) % safeItems.length : 0));
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, safeItems.length]);

  // swipe support
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const didMove = useRef(false);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
    didMove.current = false;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (touchStartX.current == null || touchStartY.current == null) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - touchStartX.current);
    const dy = Math.abs(t.clientY - touchStartY.current);
    if (dx > 10 || dy > 10) didMove.current = true;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current == null || touchStartY.current == null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX.current;
    const dy = t.clientY - touchStartY.current;

    touchStartX.current = null;
    touchStartY.current = null;

    // horizontal swipe only (ignore vertical scroll gestures)
    if (Math.abs(dx) < 40) return;
    if (Math.abs(dx) < Math.abs(dy)) return;

    if (dx < 0) {
      setIdx((v) => (safeItems.length ? (v + 1) % safeItems.length : 0));
    } else {
      setIdx((v) => (safeItems.length ? (v - 1 + safeItems.length) % safeItems.length : 0));
    }
  }

  if (!open) return null;
  if (!safeItems.length) return null;

  const current = safeItems[idx];

  return (
    <div
      className="fixed inset-0 z-[9999]"
      aria-modal="true"
      role="dialog"
      onMouseDown={(e) => {
        // clicking the dim background closes
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        background: "rgba(0,0,0,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-2 text-white hover:bg-white/15"
      >
        ✕
      </button>

      {/* Index indicator */}
      {safeItems.length > 1 ? (
        <div className="absolute left-4 top-4 rounded-full bg-white/10 px-3 py-2 text-white text-sm">
          {idx + 1} / {safeItems.length}
        </div>
      ) : null}

      {/* Prev / Next */}
      {safeItems.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous"
            onClick={() => setIdx((v) => (v - 1 + safeItems.length) % safeItems.length)}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-white hover:bg-white/15"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => setIdx((v) => (v + 1) % safeItems.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-white hover:bg-white/15"
          >
            ›
          </button>
        </>
      ) : null}

      {/* Image */}
      <div
        className="w-full"
        style={{
          maxWidth: "1100px",
          maxHeight: "85vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt=""
          draggable={false}
          className="block w-auto max-w-full h-auto"
          style={{
            maxHeight: "85vh",
            objectFit: "contain",
          }}
        />
      </div>
    </div>
  );
}