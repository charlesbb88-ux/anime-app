"use client";

import React from "react";
import { GalleryHorizontalEnd, Search } from "lucide-react";
import {
  type CompletionsFilters,
  type ProgressFilter,
  type KindFilter,
  type SortFilter,
  PROGRESS_FILTER_OPTIONS,
  KIND_FILTER_OPTIONS,
  SORT_FILTER_OPTIONS,
} from "./completionsFilters";

type ViewMode = "carousel" | "list";

type Props = {
  filters: CompletionsFilters;
  onChange: (next: CompletionsFilters) => void;

  viewMode: ViewMode;
  onToggleViewMode: () => void;
};

function selectBaseClasses() {
  return [
    "h-8",
    "box-border",
    "px-3",
    "pr-7",
    "py-1",
    "text-xs",
    "font-semibold",
    "leading-5", // safer for descenders
    "text-slate-900",
    "bg-white",
    "border-0",
    "appearance-none",
    "outline-none",
    "focus:outline-none",
    "focus:ring-0",
    "focus-visible:ring-0",
    "hover:bg-slate-50",
    "cursor-pointer",
    "whitespace-nowrap",
  ].join(" ");
}

function inputBaseClasses() {
  return [
    "h-8",
    "box-border",
    "pl-8", // room for search icon
    "pr-3",
    "py-1",
    "text-xs",
    "font-semibold",
    "leading-5",
    "text-slate-900",
    "bg-white",
    "border-0",
    "outline-none",
    "focus:outline-none",
    "focus:ring-0",
    "focus-visible:ring-0",
    "hover:bg-slate-50",
    "placeholder:text-slate-500",
    "w-[170px]", // tweak if you want wider/narrower
  ].join(" ");
}

function buttonBaseClasses() {
  return [
    "h-8",
    "box-border",
    "px-3",
    "py-1",
    "text-xs",
    "font-semibold",
    "leading-5",
    "text-slate-900",
    "bg-white",
    "border-0",
    "outline-none",
    "focus:outline-none",
    "focus:ring-0",
    "focus-visible:ring-0",
    "hover:bg-slate-50",
    "cursor-pointer",
    "whitespace-nowrap",
    "inline-flex",
    "items-center",
    "justify-center",
  ].join(" ");
}

function Chevron() {
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

function IconList() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
      <path d="M4 5.5a1 1 0 0 1 1-1h11a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Z" />
      <path d="M4 10a1 1 0 0 1 1-1h11a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Z" />
      <path d="M4 14.5a1 1 0 0 1 1-1h11a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Z" />
    </svg>
  );
}

export default function CompletionsFilterRow({ filters, onChange, viewMode, onToggleViewMode }: Props) {
  function setSearch(v: string) {
    onChange({ ...filters, search: v });
  }

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
  const inputCls = inputBaseClasses();

  const isList = viewMode === "list";

  return (
    <div className="flex items-center justify-end">
      <div className="inline-flex overflow-hidden border border-black shadow-[0_1px_0_rgba(0,0,0,0.20)]">
        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700" />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className={inputCls}
          />
        </div>

        <div className="w-px bg-black" />

        {/* Kind */}
        <div className="relative">
          <select value={filters.kind} onChange={(e) => setKind(e.target.value as KindFilter)} className={selectCls}>
            {KIND_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Chevron />
        </div>

        <div className="w-px bg-black" />

        {/* Progress */}
        <div className="relative">
          <select value={filters.progress} onChange={(e) => setProgress(e.target.value as ProgressFilter)} className={selectCls}>
            {PROGRESS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Chevron />
        </div>

        <div className="w-px bg-black" />

        {/* Sort */}
        <div className="relative">
          <select value={filters.sort} onChange={(e) => setSort(e.target.value as SortFilter)} className={selectCls}>
            {SORT_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Chevron />
        </div>

        <div className="w-px bg-black" />

        {/* View toggle */}
        <button type="button" onClick={onToggleViewMode} className={buttonBaseClasses()}>
          {isList ? <GalleryHorizontalEnd className="h-4 w-4" /> : <IconList />}
        </button>
      </div>
    </div>
  );
}
