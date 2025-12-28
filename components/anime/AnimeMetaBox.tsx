"use client";

import React, { useMemo } from "react";

type Props = {
  // titles
  titleEnglish?: string | null;
  titleNative?: string | null;

  // core meta
  totalEpisodes?: number | null;
  format?: string | null;
  status?: string | null;

  // dates / season
  startDate?: string | null;
  endDate?: string | null;
  season?: string | null;
  seasonYear?: number | string | null;

  // score
  averageScore?: number | null;

  className?: string;
};

export default function AnimeMetaBox({
  titleEnglish = null,
  titleNative = null,

  totalEpisodes = null,
  format = null,
  status = null,

  startDate = null,
  endDate = null,
  season = null,
  seasonYear = null,

  averageScore = null,

  className = "",
}: Props) {
  const hasAny = useMemo(() => {
    return Boolean(
      titleEnglish ||
        titleNative ||
        totalEpisodes != null ||
        format ||
        status ||
        startDate ||
        endDate ||
        season ||
        seasonYear ||
        typeof averageScore === "number"
    );
  }, [
    titleEnglish,
    titleNative,
    totalEpisodes,
    format,
    status,
    startDate,
    endDate,
    season,
    seasonYear,
    averageScore,
  ]);

  if (!hasAny) return null;

  const eps =
    typeof totalEpisodes === "number" ? String(totalEpisodes) : "Unknown";

  const fmt = format?.trim() ? format : "—";
  const stat = status?.trim() ? status : "—";

  const aired =
    startDate || endDate ? `${startDate ?? "?"} – ${endDate ?? "?"}` : null;

  const seasonLine =
    season || seasonYear
      ? `${season ?? "?"}${seasonYear ? ` ${seasonYear}` : ""}`
      : null;

  const scoreLine =
    typeof averageScore === "number" ? `${averageScore}/100` : null;

  return (
    <div
      className={[
        "w-full max-w-[340px] overflow-hidden rounded-md border border-gray-800 bg-[#000000] text-gray-200 shadow-sm",
        className,
      ].join(" ")}
    >
      {/* TITLES */}
      {(titleEnglish || titleNative) && (
        <>
          <SectionTitle>Titles</SectionTitle>

          <div className="px-4 py-2">
            {titleEnglish && (
              <MetaRow label="English" value={titleEnglish} />
            )}
            {titleNative && <MetaRow label="Native" value={titleNative} />}
          </div>

          <Divider />
        </>
      )}

      {/* DETAILS */}
      <SectionTitle>Details</SectionTitle>

      <div className="px-4 py-2">
        <MetaRow label="Episodes" value={eps} />
        <MetaRow label="Format" value={fmt} />
        <MetaRow label="Status" value={stat} />

        {aired && <MetaRow label="Aired" value={aired} />}
        {seasonLine && <MetaRow label="Season" value={seasonLine} />}
        {scoreLine && <MetaRow label="Score" value={scoreLine} />}
      </div>
    </div>
  );
}

/* -------------------- Subcomponents -------------------- */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-300">
      {children}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="text-[12px] font-medium text-gray-400">{label}</span>
      <span className="text-right text-[12px] font-semibold text-gray-100">
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-gray-700/60" />;
}
