"use client";

import React from "react";
import {
  type CompletionsFilters,
  type ProgressFilter,
  PROGRESS_FILTER_OPTIONS,
} from "./completionsFilters";

type Props = {
  filters: CompletionsFilters;
  onChange: (next: CompletionsFilters) => void;
};

export default function CompletionsFilterRow({ filters, onChange }: Props) {
  function setProgress(v: ProgressFilter) {
    onChange({ ...filters, progress: v });
  }

  return (
    <div className="flex items-center justify-end gap-2 pb-2">
      <select
        value={filters.progress}
        onChange={(e) => setProgress(e.target.value as ProgressFilter)}
        className="rounded-md border border-black bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-[0_1px_0_rgba(0,0,0,0.20)] hover:bg-slate-50"
      >
        {PROGRESS_FILTER_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Later you’ll add Year/Month/Date filters right here */}
    </div>
  );
}
