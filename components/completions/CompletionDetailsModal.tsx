"use client";

import React, { useEffect } from "react";
import ProgressRing from "./ProgressRing";

type CompletionKind = "anime" | "manga";

export type CompletionDetails = {
  id: string;
  title: string;
  kind: CompletionKind;
  image_url?: string | null;

  progress_current?: number | null;
  progress_total?: number | null;
};

type Props = {
  open: boolean;
  item: CompletionDetails | null;
  onClose: () => void;
};

export default function CompletionDetailsModal({ open, item, onClose }: Props) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !item) return null;

  const current = item.progress_current ?? 0;
  const total = item.progress_total ?? 0;
  const unit = item.kind === "manga" ? "chapters" : "episodes";

  return (
    <div className="fixed inset-0 z-[1000000]">
      {/* backdrop: receives the outside click */}
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* center wrapper MUST NOT block clicks */}
      <div className="absolute inset-0 grid place-items-center p-4 pointer-events-none">
        {/* modal panel IS clickable */}
        <div
          className={[
            "pointer-events-auto",
            "relative w-full max-w-[720px]",
            "rounded-2xl border border-black",
            "bg-white shadow-[0_20px_60px_rgba(0,0,0,0.35)]",
            "overflow-hidden",
          ].join(" ")}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/10">
            <div className="text-sm font-semibold text-slate-900">Progress</div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-black bg-white px-2 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-50 active:translate-y-[1px]"
            >
              Close
            </button>
          </div>

          <div className="p-4">
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              {/* poster */}
              <div className="w-full">
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-black bg-slate-200">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="absolute inset-0 h-full w-full object-cover"
                      draggable={false}
                    />
                  ) : null}
                </div>
              </div>

              {/* right side */}
              <div className="flex flex-col justify-center gap-4">
                <div>
                  <div className="text-lg font-bold text-slate-900 leading-tight">
                    {item.title}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    {current} / {total} {unit}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <ProgressRing current={current} total={total} size={140} stroke={12} />
                </div>

                {/* we’ll add more details later */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
