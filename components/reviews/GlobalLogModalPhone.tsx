"use client";

import React from "react";
import { Heart } from "lucide-react";
import LogDatePicker from "@/components/ui/LogDatePicker";
import ComposerPendingAttachments from "@/components/composer/ComposerPendingAttachments";
import type { PendingAttachment } from "@/lib/postAttachments";

export type GlobalLogModalPhoneProps = {
  title?: string | null;
  posterUrl?: string | null;

  animeEpisodeNumber?: number | null;
  mangaChapterNumber?: number | null;

  // form + state
  content: string;
  setContent: (v: string) => void;

  containsSpoilers: boolean;
  setContainsSpoilers: (v: boolean) => void;

  showJournalCheckbox: boolean;
  logWatchToActivity: boolean;
  checkboxLabel: string;
  handleToggleJournal: (checked: boolean) => void;

  // watched/logged date (YYYY-MM-DD)
  loggedOnDate: string;
  setLoggedOnDate: (v: string) => void;
  maxLoggedOnDate: string;

  showLikeAndStars: boolean;

  likeChoice: boolean | null;
  toggleLike: () => void;
  heartColor: string;
  heartFill: string;

  saving: boolean;
  error: string;
  // ✅ NEW: attachments
  pendingAttachments: PendingAttachment[];
  setPendingAttachments: React.Dispatch<React.SetStateAction<PendingAttachment[]>>;

  // stars
  shownHalfStars: number;
  halfStars: number | null;
  setHoverHalfStars: (v: number | null) => void;
  setRatingHalfStars: (nextHalfStars: number) => void;
  computeStarFillPercent: (shownHalfStars: number, starIndex: number) => 0 | 50 | 100;
  StarVisual: (props: {
    filledPercent: 0 | 50 | 100;
    dim?: boolean;
    size?: number;
  }) => React.JSX.Element;

  // submit + close
  canSubmit: boolean;
  onClose: () => void;
  handleSubmit: (e: React.FormEvent) => void;
};

export default function GlobalLogModalPhone(props: GlobalLogModalPhoneProps) {
  const {
    title,
    posterUrl,
    animeEpisodeNumber,
    mangaChapterNumber,

    content,
    setContent,

    containsSpoilers,
    setContainsSpoilers,

    showJournalCheckbox,
    logWatchToActivity,
    checkboxLabel,
    handleToggleJournal,

    loggedOnDate,
    setLoggedOnDate,
    maxLoggedOnDate,

    showLikeAndStars,

    likeChoice,
    toggleLike,
    heartColor,
    heartFill,

    saving,
    error,
    pendingAttachments,
    setPendingAttachments,

    shownHalfStars,
    setHoverHalfStars,
    setRatingHalfStars,
    computeStarFillPercent,
    StarVisual,

    canSubmit,
    onClose,
    handleSubmit,
  } = props;

  const loggingLabel = animeEpisodeNumber
    ? `Logging Episode ${animeEpisodeNumber}`
    : mangaChapterNumber
      ? `Logging Chapter ${mangaChapterNumber}`
      : "Log Entry";

  // ✅ NEW: media picker (images/videos)
  const fileInputId = "global-log-review-media-phone";

  function onPickFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const next: PendingAttachment[] = Array.from(files).map((f) => {
      const isVideo = f.type.startsWith("video/");
      const isImage = f.type.startsWith("image/");

      // treat gif as "image"
      const kind: any = isVideo ? "video" : isImage ? "image" : "image";

      return {
        kind,
        file: f,
        status: "queued",
        error: null,
      } as any;
    });

    setPendingAttachments((prev) => {
      const existingVideos = prev.filter((a: any) => a.kind === "video").length;
      const incomingVideos = next.filter((a: any) => a.kind === "video").length;

      if (existingVideos + incomingVideos > 1) {
        window.alert("Only 1 video allowed.");
        return prev;
      }

      const existingMedia = prev.filter((a: any) => a.kind === "image").length;
      const incomingMedia = next.filter((a: any) => a.kind === "image").length;

      if (existingMedia + incomingMedia > 4) {
        window.alert("Only 4 images/GIFs allowed.");
        return prev;
      }

      return [...prev, ...next];
    });
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-zinc-950" aria-modal="true" role="dialog">
      {/* Top bar (sticky) */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/95 backdrop-blur">
        <div className="px-4 py-3">
          {/* Poster + Title ONLY (top section) */}
          <div className="flex items-center gap-3">
            <div className="h-[72px] w-[52px] flex-none overflow-hidden rounded-[2px] bg-zinc-900">
              {posterUrl ? (
                <img
                  src={posterUrl}
                  alt={title ?? "Poster"}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                {loggingLabel}
              </div>

              {/* ✅ no truncate — allow wrapping */}
              <div className="whitespace-normal break-words text-[16px] font-semibold leading-snug text-white">
                {title ?? "Log"}
              </div>
            </div>
          </div>
        </div>

        {/* Divider line */}
        <div className="h-px w-full bg-white/10" />

        {/* Everything else BELOW divider */}
        <div className="px-4 py-3">
          {/* Journal checkbox + date picker */}
          {showJournalCheckbox ? (
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  checked={logWatchToActivity}
                  onChange={(e) => handleToggleJournal(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="truncate">{checkboxLabel}</span>
              </label>

              {logWatchToActivity ? (
                <div className="pl-6">
                  <div className="mb-2 text-[11px] font-medium text-zinc-400">Watched on</div>

                  <LogDatePicker
                    value={loggedOnDate}
                    onChange={setLoggedOnDate}
                    disabled={saving}
                    maxDateStr={maxLoggedOnDate}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-xs text-zinc-500">Select a valid target to enable logging.</div>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <form onSubmit={handleSubmit} className="h-[calc(100dvh-160px)] overflow-y-auto px-4 py-4">
        {/* Review box */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-zinc-200">Review</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            placeholder="Write your thoughts..."
            disabled={saving}
            className={[
              // ✅ iOS Safari zoom fix: ensure font-size >= 16px on textarea
              "min-h-[240px] w-full resize-none rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-3 text-[16px] text-white outline-none focus:border-zinc-500",
              saving ? "opacity-60" : "",
            ].join(" ")}
          />
        </div>

        {/* ✅ Attachments (media) */}
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <input
              id={fileInputId}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              disabled={saving}
              onChange={(e) => {
                onPickFiles(e.target.files);
                e.currentTarget.value = "";
              }}
            />

            <button
              type="button"
              disabled={saving}
              onClick={() => {
                const el = document.getElementById(fileInputId) as HTMLInputElement | null;
                el?.click();
              }}
              className={[
                "rounded-md border border-zinc-800 px-3 py-2 text-sm text-zinc-200",
                saving ? "opacity-60 cursor-not-allowed" : "hover:bg-zinc-900",
              ].join(" ")}
            >
              Add media
            </button>

            <div className="text-xs text-zinc-500">Up to 4 images/GIFs, or 1 video</div>
          </div>

          {pendingAttachments.length > 0 ? (
            <div className="mt-3">
              <ComposerPendingAttachments
                items={pendingAttachments}
                onRemove={(index) => {
                  setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
                }}
              />
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex items-center gap-2 text-sm text-zinc-200">
          <input
            type="checkbox"
            checked={containsSpoilers}
            onChange={(e) => setContainsSpoilers(e.target.checked)}
            disabled={saving}
            className="h-4 w-4"
          />
          Contains spoilers
        </div>

        {/* Like + stars BELOW "Contains spoilers" */}
        {showLikeAndStars ? (
          <div className="mt-4">
            <div className="flex w-full items-center justify-between gap-3">
              {/* Like (shift label more left) */}
              <button
                type="button"
                onClick={toggleLike}
                disabled={saving}
                aria-pressed={likeChoice === true}
                className={[
                  "inline-flex items-center justify-start gap-2 rounded-md px-2 py-2",
                  saving
                    ? "cursor-not-allowed opacity-60"
                    : "hover:bg-white/5 active:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/10",
                ].join(" ")}
                title={
                  likeChoice === null
                    ? "Like"
                    : likeChoice
                      ? "Will like on save"
                      : "Will remove like on save"
                }
              >
                <Heart className={["h-8 w-8", heartColor, heartFill].join(" ")} />
                <span className="text-sm font-medium text-zinc-200">
                  {likeChoice === null ? "Like" : likeChoice ? "Liked" : "Unliked"}
                </span>
              </button>

              {/* Stars (push to the right) */}
              <div
                className="ml-auto flex items-center justify-end gap-[10px]"
                onMouseLeave={() => setHoverHalfStars(null)}
              >
                {Array.from({ length: 5 }).map((_, i) => {
                  const starIndex = i + 1;
                  const filled = computeStarFillPercent(shownHalfStars, starIndex);

                  return (
                    <div key={starIndex} className="relative flex items-center">
                      <StarVisual filledPercent={filled} dim={saving} size={30} />

                      <button
                        type="button"
                        disabled={saving}
                        className="absolute inset-y-0 left-0 w-1/2"
                        onMouseEnter={() => setHoverHalfStars(starIndex * 2 - 1)}
                        onFocus={() => setHoverHalfStars(starIndex * 2 - 1)}
                        onClick={() => setRatingHalfStars(starIndex * 2 - 1)}
                        aria-label={`Rate ${starIndex - 0.5} stars`}
                        title={`Rate ${starIndex - 0.5} stars`}
                      />

                      <button
                        type="button"
                        disabled={saving}
                        className="absolute inset-y-0 right-0 w-1/2"
                        onMouseEnter={() => setHoverHalfStars(starIndex * 2)}
                        onFocus={() => setHoverHalfStars(starIndex * 2)}
                        onClick={() => setRatingHalfStars(starIndex * 2)}
                        aria-label={`Rate ${starIndex} stars`}
                        title={`Rate ${starIndex} stars`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="h-10" />
      </form>

      {/* Bottom bar (sticky) */}
      <div className="sticky bottom-0 z-20 border-t border-white/10 bg-zinc-950/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!canSubmit}
            onClick={(e) => handleSubmit(e as any)}
            className={[
              "flex-1 rounded-md px-3 py-2 text-sm font-semibold text-white",
              canSubmit ? "bg-emerald-600 hover:bg-emerald-500" : "bg-zinc-700 opacity-60",
            ].join(" ")}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
