"use client";

import React from "react";
import {
  type CompletionsFilters,
  type ProgressFilter,
  type KindFilter,
  type SortFilter,
  PROGRESS_FILTER_OPTIONS,
  KIND_FILTER_OPTIONS,
  SORT_FILTER_OPTIONS,
} from "./completionsFilters";

type Props = {
  filters: CompletionsFilters;
  onChange: (next: CompletionsFilters) => void;
};

function selectBaseClasses() {
  // “Letterboxd-ish” behavior:
  // - square corners
  // - attached segments (no gaps)
  // - no weird thick outline when toggling open/closed
  // - consistent border and hover
  //
  // Fix for clipped descenders (g/y/p/j/q):
  // - avoid leading-none (too tight for some fonts/browsers)
  // - add a little vertical padding
  // - keep consistent overall height
  return [
    "h-8", // consistent height
    "box-border",
    "px-3",
    "pr-7", // room for chevron
    "py-1", // prevents descenders getting clipped
    "text-xs",
    "font-semibold",
    "leading-4", // <- key: gives glyphs room (no clipping)
    "text-slate-900",
    "bg-white",
    "border-0", // wrapper owns the border
    "appearance-none",
    "outline-none",
    "focus:outline-none",
    "focus:ring-0",
    "focus-visible:ring-0",
    "hover:bg-slate-50",
    "cursor-pointer",
  ].join(" ");
}

function Chevron() {
  // inline chevron (so we can hide native arrow and keep it clean)
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function CompletionsFilterRow({ filters, onChange }: Props) {
  function setProgress(v: ProgressFilter) {
    onChange({ ...filters, progress: v });
  }

  function setKind(v: KindFilter) {
    onChange({ ...filters, kind: v });
  }

  function setSort(v: SortFilter) {
    onChange({ ...filters, sort: v });
  }

  const selectCls = selectBaseClasses();

  return (
    <div className="flex items-center justify-end">
      {/* Attached, square dropdown group (Letterboxd-ish) */}
      <div className="inline-flex overflow-hidden border border-black shadow-[0_1px_0_rgba(0,0,0,0.20)]">
        {/* Kind */}
        <div className="relative">
          <select
            value={filters.kind}
            onChange={(e) => setKind(e.target.value as KindFilter)}
            className={selectCls}
          >
            {KIND_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Chevron />
        </div>

        {/* divider */}
        <div className="w-px bg-black" />

        {/* Progress */}
        <div className="relative">
          <select
            value={filters.progress}
            onChange={(e) => setProgress(e.target.value as ProgressFilter)}
            className={selectCls}
          >
            {PROGRESS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Chevron />
        </div>

        {/* divider */}
        <div className="w-px bg-black" />

        {/* Sort */}
        <div className="relative">
          <select
            value={filters.sort}
            onChange={(e) => setSort(e.target.value as SortFilter)}
            className={selectCls}
          >
            {SORT_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Chevron />
        </div>
      </div>
    </div>
  );
}
