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
  torsoId?: string | null;
  bottomsId?: string | null;
  feetId?: string | null;
  handsId?: string | null;
  showEditButton?: boolean;
};

export default function CharacterPanel({
  username,
  title,
  rank,
  titleDebug,
  avatarLayers = [],
  bodyId,
  hairId,
  torsoId,
  bottomsId,
  feetId,
  handsId,
  showEditButton = false,
}: Props) {
  const hasAvatar = avatarLayers.length > 0;
  const [showTitleTooltip, setShowTitleTooltip] = useState(false);
  const titleTooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;

      if (
        titleTooltipRef.current &&
        target &&
        titleTooltipRef.current.contains(target)
      ) {
        return;
      }

      setShowTitleTooltip(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowTitleTooltip(false);
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
  }, []);

  return (
    <div className="h-full rounded-md border border-black border-2 bg-white p-3">
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-4"></div>

        <div className="flex flex-1 items-start justify-center">
          <div className="flex w-full max-w-md flex-col items-center">
            {hasAvatar ? (
              <CharacterRigAvatarToggle
                bodyId={bodyId}
                hairId={hairId}
                torsoId={torsoId}
                bottomsId={bottomsId}
                feetId={feetId}
                handsId={handsId}
                showEditButton={showEditButton}
              />
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
                <div ref={titleTooltipRef} className="relative mt-1 inline-block">
                  <button
                    type="button"
                    onClick={() => setShowTitleTooltip((prev) => !prev)}
                    className="text-base font-semibold text-black/90 underline underline-offset-4 transition hover:text-black"
                  >
                    {title}
                  </button>

                  {showTitleTooltip ? (
                    <div className="absolute left-1/2 top-full z-30 mt-2 w-[320px] -translate-x-1/2 rounded-2xl border-2 border-black bg-white px-4 py-3 text-left text-sm text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      <div className="font-bold uppercase tracking-wide text-black">
                        Why this title?
                      </div>

                      <div className="mt-2 space-y-2 leading-relaxed text-black">
                        <div className="rounded-xl border border-black bg-black/[0.03] px-3 py-2">
                          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-black/70">
                            Title breakdown
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-3">
                              <span>Prefix Tag</span>
                              <span className="font-semibold text-right">
                                {titleDebug.prefixTag ?? "—"}
                                {titleDebug.prefixLevel != null
                                  ? ` (Level ${titleDebug.prefixLevel})`
                                  : ""}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                              <span>Class Tag</span>
                              <span className="font-semibold text-right">
                                {titleDebug.classTag ?? "—"}
                                {titleDebug.classLevel != null
                                  ? ` (Level ${titleDebug.classLevel})`
                                  : ""}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                              <span>Domain Tag</span>
                              <span className="font-semibold text-right">
                                {titleDebug.domainTag ?? "—"}
                                {titleDebug.domainLevel != null
                                  ? ` (Level ${titleDebug.domainLevel})`
                                  : ""}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-1 text-base text-black/70">{title}</div>
              )}

              <div className="mt-2 text-md font-bold text-black/80">{rank}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}