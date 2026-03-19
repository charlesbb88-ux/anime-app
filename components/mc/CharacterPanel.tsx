"use client";

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
};

export default function CharacterPanel({
  username,
  title,
  rank,
  titleDebug,
  avatarLayers = [],
}: Props) {
  const hasAvatar = avatarLayers.length > 0;

  return (
    <div className="h-full rounded-md border border-white/10 bg-black p-3">
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-4">
        </div>

        <div className="flex flex-1 items-start justify-center">
          <div className="flex w-full max-w-md flex-col items-center">
            {hasAvatar ? (
              <CharacterRigAvatarToggle />
            ) : (
              <div className="flex h-[420px] w-full items-center justify-center rounded-[2rem] border border-dashed border-white/15 bg-black/20">
                <div className="text-center">
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-white/15 bg-white/5 text-3xl">
                    ?
                  </div>
                  <div className="mt-4 text-lg font-semibold">
                    Character Portrait
                  </div>
                  <div className="mt-1 text-sm text-white/45">
                    Avatar / generated character goes here
                  </div>
                </div>
              </div>
            )}

            <div className="mt-2 text-center">
              <div className="text-xl font-semibold">{username}</div>
              <div className="mt-1 text-base text-white/70">{title}</div>
              <div className="mt-2 text-sm text-white/45">{rank}</div>
            </div>
            {titleDebug && (
              <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/70">
                <div>
                  <span className="text-white/40">Class Tag:</span>{" "}
                  {titleDebug.classTag ?? "—"} ({titleDebug.classBand ?? "—"})
                </div>
                <div className="mt-1">
                  <span className="text-white/40">Prefix Tag:</span>{" "}
                  {titleDebug.prefixTag ?? "—"} ({titleDebug.prefixBand ?? "—"})
                </div>
                <div className="mt-1">
                  <span className="text-white/40">Domain Tag:</span>{" "}
                  {titleDebug.domainTag ?? "—"} ({titleDebug.domainBand ?? "—"})
                </div>
                <div className="mt-2 border-t border-white/10 pt-2">
                  <span className="text-white/40">Short Title:</span>{" "}
                  {titleDebug.shortTitle}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}