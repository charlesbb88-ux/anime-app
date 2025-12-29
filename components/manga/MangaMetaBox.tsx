"use client";

import React, { useMemo } from "react";

type Props = {
  // titles
  titleEnglish?: string | null;
  titleNative?: string | null;
  titlePreferred?: string | null;

  // core meta
  totalChapters?: number | null;
  totalVolumes?: number | null;
  format?: string | null;
  status?: string | null;

  // dates / season
  startDate?: string | null;
  endDate?: string | null;
  season?: string | null;
  seasonYear?: number | string | null;

  // score
  averageScore?: number | null;

  // source
  source?: string | null;

  className?: string;
};

export default function MangaMetaBox({
  titleEnglish = null,
  titleNative = null,
  titlePreferred = null,

  totalChapters = null,
  totalVolumes = null,
  format = null,
  status = null,

  startDate = null,
  endDate = null,
  season = null,
  seasonYear = null,

  averageScore = null,
  source = null,

  className = "",
}: Props) {
  const hasAny = useMemo(() => {
    return Boolean(
      titleEnglish ||
        titleNative ||
        titlePreferred ||
        totalChapters != null ||
        totalVolumes != null ||
        format ||
        status ||
        startDate ||
        endDate ||
        season ||
        seasonYear ||
        typeof averageScore === "number" ||
        source
    );
  }, [
    titleEnglish,
    titleNative,
    titlePreferred,
    totalChapters,
    totalVolumes,
    format,
    status,
    startDate,
    endDate,
    season,
    seasonYear,
    averageScore,
    source,
  ]);

  if (!hasAny) return null;

  const chapters =
    typeof totalChapters === "number" ? String(totalChapters) : "Unknown";
  const volumes =
    typeof totalVolumes === "number" ? String(totalVolumes) : "Unknown";

  const fmt = format?.trim() ? format : "—";
  const stat = status?.trim() ? status : "—";

  const published =
    startDate || endDate ? `${startDate ?? "?"} – ${endDate ?? "?"}` : null;

  const seasonLine =
    season || seasonYear
      ? `${season ?? "?"}${seasonYear ? ` ${seasonYear}` : ""}`
      : null;

  const scoreLine =
    typeof averageScore === "number" ? `${averageScore}/100` : null;

  const src = source?.trim() ? source : null;

  return (
    <div
      className={[
        "w-full max-w-[340px] overflow-hidden rounded-md border border-gray-800 bg-[#000000] text-gray-200 shadow-sm",
        className,
      ].join(" ")}
    >
      {/* TITLES */}
      {(titleEnglish || titleNative || titlePreferred) && (
        <>
          <SectionTitle>Titles</SectionTitle>

          <div className="px-4 py-2">
            {titleEnglish && <MetaRow label="English" value={titleEnglish} />}
            {titlePreferred && <MetaRow label="Preferred" value={titlePreferred} />}
            {titleNative && <MetaRow label="Native" value={titleNative} />}
          </div>

          <Divider />
        </>
      )}

      {/* DETAILS */}
      <SectionTitle>Details</SectionTitle>

      <div className="px-4 py-2">
        <MetaRow label="Chapters" value={chapters} />
        <MetaRow label="Volumes" value={volumes} />
        <MetaRow label="Format" value={fmt} />
        <MetaRow label="Status" value={stat} />

        {published && <MetaRow label="Published" value={published} />}
        {seasonLine && <MetaRow label="Season" value={seasonLine} />}
        {scoreLine && <MetaRow label="Score" value={scoreLine} />}
        {src && <MetaRow label="Source" value={src} />}
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
