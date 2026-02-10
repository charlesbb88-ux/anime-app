"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { GalleryHorizontalEnd, Search, X } from "lucide-react";
import {
  type CompletionsFilters,
  type ProgressFilter,
  type KindFilter,
  type SortFilter,
  PROGRESS_FILTER_OPTIONS,
  KIND_FILTER_OPTIONS,
  SORT_FILTER_OPTIONS,
} from "./completionsFilters";
import type { ProgressBucket } from "@/lib/completions";

type ViewMode = "carousel" | "list";

type Props = {
  filters: CompletionsFilters;
  onChange: (next: CompletionsFilters) => void;

  viewMode: ViewMode;
  onToggleViewMode: () => void;

  // Map keyed by bucket value ("all", "90-99", etc.)
  bucketCounts: Record<string, ProgressBucket>;
};

function safeInt(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function totalForBucket(b?: ProgressBucket) {
  if (!b) return 0;
  // Your RPC rows likely contain anime_count + manga_count
  return safeInt((b as any).anime_count) + safeInt((b as any).manga_count);
}

function selectBaseClasses() {
  return [
    "h-8",
    "box-border",
    "px-2",
    "pr-5",
    "py-1",
    "text-xs",
    "font-semibold",
    "leading-5",
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
    "pl-8",
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
    "w-[170px]",
  ].join(" ");
}

function mobileInputBaseClasses() {
  return [
    "h-8",
    "box-border",
    "w-full",
    "pl-8",
    "pr-9",
    "py-1",
    "text-[16px]",
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
      className="pointer-events-none absolute right-1 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700"
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
      <path d="M4 14.5a1 1 0 0 1 1-1h11a1 1 0 0 1 0 2H5a1 1 0 0 1-1-1Z" />
    </svg>
  );
}

export default function CompletionsFilterRow({
  filters,
  onChange,
  viewMode,
  onToggleViewMode,
  bucketCounts,
}: Props) {
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

  const selectCls = useMemo(() => selectBaseClasses(), []);
  const inputCls = useMemo(() => inputBaseClasses(), []);
  const mobileInputCls = useMemo(() => mobileInputBaseClasses(), []);

  const isList = viewMode === "list";

  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileSearchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (mobileSearchOpen) {
      requestAnimationFrame(() => {
        mobileSearchRef.current?.focus();
      });
    }
  }, [mobileSearchOpen]);

  function toggleMobileSearch() {
    setMobileSearchOpen((v) => !v);
  }

  function closeMobileSearch() {
    setMobileSearchOpen(false);
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center justify-center sm:justify-end">
        <div className="inline-flex overflow-hidden border border-black shadow-[0_1px_0_rgba(0,0,0,0.20)]">
          {/* Desktop Search */}
          <div className="relative hidden sm:block">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700" />
            <input
              type="search"
              value={filters.search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className={inputCls}
            />
          </div>

          <div className="hidden sm:block w-px bg-black" />

          {/* Mobile search button */}
          <button
            type="button"
            onClick={toggleMobileSearch}
            aria-label={mobileSearchOpen ? "Hide search" : "Show search"}
            className={[buttonBaseClasses(), "sm:hidden", mobileSearchOpen ? "bg-slate-50" : ""].join(" ")}
          >
            <Search className="h-4 w-4" />
          </button>

          <div className="sm:hidden w-px bg-black" />

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

          {/* Progress (with totals) */}
          <div className="relative">
            <select
              value={filters.progress}
              onChange={(e) => setProgress(e.target.value as ProgressFilter)}
              className={selectCls}
            >
              {PROGRESS_FILTER_OPTIONS.map((opt) => {
                const total = totalForBucket(bucketCounts?.[opt.value]);
                const label = `${opt.label}${Number.isFinite(total) ? ` (${total})` : ""}`;

                // Optional UX: prevent selecting empty buckets (except "all")
                const disabled = opt.value !== "all" && total === 0;

                return (
                  <option key={opt.value} value={opt.value} disabled={disabled}>
                    {label}
                  </option>
                );
              })}
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

      {/* Mobile expanded search row */}
      {mobileSearchOpen && (
        <div className="w-full sm:hidden">
          <div className="overflow-hidden border border-black shadow-[0_1px_0_rgba(0,0,0,0.20)]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700" />

              <input
                ref={mobileSearchRef}
                type="search"
                value={filters.search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder=""
                className={mobileInputCls}
              />

              {!filters.search && (
                <div
                  aria-hidden="true"
                  className={[
                    "pointer-events-none absolute inset-y-0 left-0 right-0",
                    "flex items-center",
                    "pl-8 pr-9",
                    "text-xs font-semibold leading-5",
                    "text-slate-500",
                  ].join(" ")}
                >
                  <span className="truncate">Search</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  if (filters.search) setSearch("");
                  else closeMobileSearch();
                }}
                aria-label={filters.search ? "Clear search" : "Close search"}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded hover:bg-slate-100"
              >
                <X className="h-4 w-4 text-slate-700" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
