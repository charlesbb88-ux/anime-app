"use client";

import type { GeneratedTitle } from "@/lib/generateTitle";

type Props = {
  username: string;
  title: string;
  rank: string;
  titleDebug?: GeneratedTitle;
};

export default function CharacterPanel({
  username,
  title,
  rank,
  titleDebug,
}: Props) {
  return (
    <div className="h-full rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex h-full flex-col">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/45">
              Character
            </div>
            <h2 className="mt-2 text-2xl font-bold">{username}</h2>
            <p className="mt-1 text-sm text-white/55">{title}</p>

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

          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-white/70">
            {rank}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="flex w-full max-w-md flex-col items-center">
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

            <div className="mt-5 text-center">
              <div className="text-xl font-semibold">{username}</div>
              <div className="mt-1 text-base text-white/70">{title}</div>
              <div className="mt-2 text-sm text-white/45">{rank}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}