"use client";

import { useEffect, useRef, useState } from "react";
import CharacterAvatar from "@/components/mc/CharacterAvatar";
import type { CharacterAvatarLayer } from "@/components/mc/avatarTypes";
import type { GeneratedTitle } from "@/lib/generateTitle";
import CharacterRigAvatarToggle from "@/components/mc/CharacterRigAvatarToggle";

type Props = {
  username: string;
  title: string;
  rank: string;
  titleDebug?: GeneratedTitle;
  avatarLayers?: CharacterAvatarLayer[];
  bodyId?: string | null;
  hairId?: string | null;
};

export default function CharacterPanel({
  username,
  title,
  rank,
  titleDebug,
  avatarLayers = [],
  bodyId,
  hairId,
}: Props) {
  const hasAvatar = avatarLayers.length > 0;
  const [showTitlePopup, setShowTitlePopup] = useState(false);
  const popupContentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showTitlePopup) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;

      if (popupContentRef.current && target && popupContentRef.current.contains(target)) {
        return;
      }

      setShowTitlePopup(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowTitlePopup(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showTitlePopup]);

  return (
    <div className="h-full rounded-md border border-black border-2 bg-white p-3">
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-4"></div>

        <div className="flex flex-1 items-start justify-center">
          <div className="flex w-full max-w-md flex-col items-center">
            {hasAvatar ? (
              <CharacterRigAvatarToggle bodyId={bodyId} hairId={hairId} />
            ) : (
              <div className="flex h-[420px] w-full items-center justify-center rounded-[2rem] border border-dashed border-black/15 bg-white/20">
                <div className="text-center">
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-black/15 bg-black/5 text-3xl">
                    ?
                  </div>
                  <div className="mt-4 text-lg font-semibold">
                    Character Portrait
                  </div>
                  <div className="mt-1 text-sm text-black/45">
                    Avatar / generated character goes here
                  </div>
                </div>
              </div>
            )}

            <div className="mt-2 text-center">
              <div className="text-3xl font-bold text-black">{username}</div>

              {titleDebug ? (
                <button
                  type="button"
                  onClick={() => setShowTitlePopup(true)}
                  className="mt-1 text-base text-black/90 underline font-semibold underline-offset-4 transition hover:text-black"
                >
                  {title}
                </button>
              ) : (
                <div className="mt-1 text-base text-black/70">{title}</div>
              )}

              <div className="mt-2 text-md font-bold text-black/80">{rank}</div>
            </div>
          </div>
        </div>
      </div>

      {showTitlePopup && titleDebug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-white/60" />

          <div
            ref={popupContentRef}
            className="relative z-10 w-full max-w-md rounded-2xl border border-black bg-[#eeeeF1] p-4 text-sm text-black shadow-2xl"
          >
            <div className="text-lg font-semibold">Why this title?</div>
            <div className="mt-3 rounded-xl border border-black/10 bg-white p-3 text-sm text-black">
              <div>
                <span className="text-black/80 font-semibold">Prefix Tag:</span>{" "}
                {titleDebug.prefixTag ?? "—"}{" "}
                {titleDebug.prefixLevel != null
                  ? `(Level ${titleDebug.prefixLevel})`
                  : ""}
              </div>

              <div className="mt-1">
                <span className="text-black/80 font-semibold">Class Tag:</span>{" "}
                {titleDebug.classTag ?? "—"}{" "}
                {titleDebug.classLevel != null
                  ? `(Level ${titleDebug.classLevel})`
                  : ""}
              </div>

              <div className="mt-1">
                <span className="text-black/80 font-semibold">Domain Tag:</span>{" "}
                {titleDebug.domainTag ?? "—"}{" "}
                {titleDebug.domainLevel != null
                  ? `(Level ${titleDebug.domainLevel})`
                  : ""}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}