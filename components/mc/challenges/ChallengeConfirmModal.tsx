"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  loading?: boolean;
  targetUsername: string;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

export default function ChallengeConfirmModal({
  open,
  loading = false,
  targetUsername,
  error = null,
  onConfirm,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      aria-modal="true"
      role="dialog"
    >
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0 bg-white/70 backdrop-blur-sm"
      />

      <div className="relative z-[101] w-full max-w-md rounded-2xl border-2 border-black bg-white p-5 text-black shadow-2xl">
        <div className="text-xs font-bold uppercase tracking-[0.22em] text-black">
          Challenge
        </div>

        <h2 className="mt-2 text-xl font-semibold">
          Challenge @{targetUsername}?
        </h2>

        <p className="mt-3 text-sm leading-6 text-black/70">
          This will send a battle challenge to @{targetUsername}. It will stay
          pending until they accept, reject, cancel, or it expires.
        </p>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-black bg-white/20 px-4 py-2 text-sm font-medium text-black transition hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-xl border border-black bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send challenge"}
          </button>
        </div>
      </div>
    </div>
  );
}