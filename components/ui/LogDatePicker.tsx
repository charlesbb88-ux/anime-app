"use client";

import * as React from "react";
import { DayPicker, type CalendarDay, type Modifiers } from "react-day-picker";
import {
  format,
  addMonths,
  startOfDay,
  startOfMonth,
  isAfter,
  isSameMonth,
  setMonth as setMonthIndex,
  setYear as setYearIndex,
} from "date-fns";

type Props = {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (next: string) => void;
  disabled?: boolean;
  maxDateStr: string; // "YYYY-MM-DD"
};

function ymdToDate(ymd: string): Date | null {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function clampMonthToMax(nextMonth: Date, maxDate: Date) {
  const maxMonth = startOfMonth(maxDate);
  const nm = startOfMonth(nextMonth);
  return isAfter(nm, maxMonth) ? maxMonth : nm;
}

// (kept as requested; fixedWeeks is what we actually use)
function forceSixWeeks(_month: Date) {
  return true;
}

const monthLabels = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const minYear = 1900;

export default function LogDatePicker({
  value,
  onChange,
  disabled,
  maxDateStr,
}: Props) {
  const selected = ymdToDate(value);
  const maxDate = ymdToDate(maxDateStr) ?? new Date();

  const [open, setOpen] = React.useState(false);
  const [monthMenuOpen, setMonthMenuOpen] = React.useState(false);

  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const monthMenuRef = React.useRef<HTMLDivElement | null>(null);

  // controlled month (so our header controls navigation)
  const [month, setMonth] = React.useState<Date>(() =>
    startOfMonth(selected ?? maxDate)
  );

  React.useEffect(() => {
    if (selected) setMonth(startOfMonth(selected));
  }, [value]);

  React.useEffect(() => {
    if (!open) return;

    function onDocDown(e: MouseEvent | TouchEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      setOpen(false);
      setMonthMenuOpen(false);
    }

    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("touchstart", onDocDown, { passive: true });

    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("touchstart", onDocDown);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open || !monthMenuOpen) return;

    function onDocDown(e: MouseEvent | TouchEvent) {
      const menuEl = monthMenuRef.current;
      if (!menuEl) return;
      if (menuEl.contains(e.target as Node)) return;
      setMonthMenuOpen(false);
    }

    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("touchstart", onDocDown, { passive: true });

    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("touchstart", onDocDown);
    };
  }, [open, monthMenuOpen]);

  const fieldLabel = selected ? format(selected, "dd MMM yyyy") : "Select date";

  const maxMonth = startOfMonth(maxDate);
  const prevMonth = addMonths(month, -1);
  const nextMonth = addMonths(month, 1);
  const nextDisabled = isAfter(startOfMonth(nextMonth), maxMonth);

  const monthIndex = month.getMonth();
  const yearNum = month.getFullYear();

  const maxYear = maxDate.getFullYear();
  const yearOptions: number[] = [];
  for (let y = minYear; y <= maxYear; y++) yearOptions.push(y);

  const applyMonthYear = React.useCallback(
    (nextMonthIdx: number, nextYear: number) => {
      let nm = startOfMonth(month);
      nm = setYearIndex(nm, nextYear);
      nm = setMonthIndex(nm, nextMonthIdx);
      nm = startOfMonth(nm);
      setMonth(clampMonthToMax(nm, maxDate));
    },
    [month, maxDate]
  );

  const DayButtonLB = React.useCallback(
    function DayButtonLB(
      props: {
        day: CalendarDay;
        modifiers: Modifiers;
      } & React.ButtonHTMLAttributes<HTMLButtonElement>
    ) {
      const { day, modifiers, className, ...buttonProps } = props;

      const date = day.date;
      const today = startOfDay(new Date());
      const isFuture = isAfter(startOfDay(date), today);

      const inMonth = isSameMonth(date, month);

      const selectedDay = !!modifiers.selected;
      const isDisabled = !!modifiers.disabled;
      const isOutside = !!modifiers.outside;

      let bg = "bg-white";
      if (selectedDay) bg = "bg-[#4caf50]";
      else if (inMonth && !isOutside) bg = "bg-[#d7e6f5]";
      else bg = "bg-white";

      let text = "text-[#2f3a46]";
      if (selectedDay) text = "text-white";
      else if (isDisabled || isFuture) text = "text-[#9fb2c7]";

      if (!selectedDay && !inMonth) {
        text = isDisabled || isFuture ? "text-[#b8c7d8]" : "text-[#9fb2c7]";
      }

      // transparent border prevents AA “bleeding” on iOS that makes tiles look fused
      const tileBorder = "border border-black/0";

      const base =
        "h-[34px] w-[34px] rounded-[4px] flex items-center justify-center";

      return (
        <button
          type="button"
          {...buttonProps}
          className={[
            base,
            bg,
            text,
            tileBorder,
            selectedDay ? "" : "hover:brightness-[0.97]",
            isDisabled ? "cursor-default" : "cursor-pointer",
            className ?? "",
          ].join(" ")}
        >
          {format(date, "d")}
        </button>
      );
    },
    [month]
  );

  void forceSixWeeks(month);

  return (
    <div
      ref={rootRef}
      className={[
        "relative",
        disabled ? "opacity-60 pointer-events-none" : "",
      ].join(" ")}
    >
      {/* Field */}
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setMonthMenuOpen(false);
        }}
        className={[
          "rounded-md border border-white/10 bg-zinc-950/40",
          "px-3 py-2 text-[18px] text-white",
          "shadow-inner",
        ].join(" ")}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {fieldLabel}
      </button>

      {open ? (
        <div
          className={[
            "absolute left-1/2 top-[calc(100%+10px)] z-[9999] -translate-x-1/2",
            "w-[min(calc(100vw-24px),312px)]",
            "rounded-lg border border-black/20",
            "bg-[#f3f7fb] shadow-[0_10px_25px_rgba(0,0,0,0.25)]",
            "p-3",
            "lb-rdp-scope",
          ].join(" ")}
          role="dialog"
          aria-label="Choose date"
        >
          {/* Header */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => {
                setMonth(startOfMonth(prevMonth));
                setMonthMenuOpen(false);
              }}
              className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-black/5"
            >
              <span className="text-[20px] leading-none text-zinc-800">←</span>
            </button>

            <div className="relative flex flex-1 justify-center px-2">
              <div ref={monthMenuRef} className="relative">
                {/* ✅ actual dropdown trigger */}
                <button
                  type="button"
                  onClick={() => setMonthMenuOpen((v) => !v)}
                  className={[
                    "w-[190px] max-w-[190px] flex items-center justify-center gap-2",
                    "rounded-md border border-zinc-300 bg-white px-3 py-1.5 shadow-sm",
                    "hover:bg-zinc-50",
                  ].join(" ")}
                  aria-haspopup="menu"
                  aria-expanded={monthMenuOpen}
                >
                  <span className="text-[15px] font-medium text-zinc-800 truncate">
                    {format(month, "MMMM, yyyy")}
                  </span>
                  <span className="text-zinc-500">▾</span>
                </button>

                {monthMenuOpen ? (
                  <div
                    className={[
                      "absolute left-1/2 top-[calc(100%+8px)] -translate-x-1/2",
                      "z-[10000] w-[220px]",
                      "rounded-md border border-black/10 bg-white shadow-lg",
                      "p-2",
                    ].join(" ")}
                    role="menu"
                    aria-label="Select month"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[12px] font-medium text-zinc-600">
                        Month
                        <select
                          className={[
                            "mt-1 w-full rounded-md border border-zinc-200 bg-white",
                            "px-2 py-1.5 text-[14px] text-zinc-800",
                            "focus:outline-none focus:ring-2 focus:ring-black/10",
                          ].join(" ")}
                          value={monthIndex}
                          onChange={(e) => {
                            const mi = Number(e.target.value);
                            applyMonthYear(mi, yearNum);
                          }}
                        >
                          {monthLabels.map((m, idx) => (
                            <option key={m} value={idx}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-[12px] font-medium text-zinc-600">
                        Year
                        <select
                          className={[
                            "mt-1 w-full rounded-md border border-zinc-200 bg-white",
                            "px-2 py-1.5 text-[14px] text-zinc-800",
                            "focus:outline-none focus:ring-2 focus:ring-black/10",
                          ].join(" ")}
                          value={yearNum}
                          onChange={(e) => {
                            const y = Number(e.target.value);
                            applyMonthYear(monthIndex, y);
                          }}
                        >
                          {yearOptions.map((y) => (
                            <option key={y} value={y}>
                              {y}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <button
                        type="button"
                        className="text-[13px] text-zinc-600 hover:text-zinc-900"
                        onClick={() => {
                          applyMonthYear(
                            maxDate.getMonth(),
                            maxDate.getFullYear()
                          );
                        }}
                      >
                        Jump to max
                      </button>

                      <button
                        type="button"
                        className={[
                          "rounded-md bg-zinc-900 px-3 py-1.5 text-[13px] text-white",
                          "hover:bg-zinc-800",
                        ].join(" ")}
                        onClick={() => setMonthMenuOpen(false)}
                      >
                        Done
                      </button>
                    </div>

                    <div className="mt-2 text-[12px] text-zinc-500">
                      Max: {format(maxDate, "dd MMM yyyy")}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              aria-label="Next month"
              disabled={nextDisabled}
              onClick={() => {
                setMonth((m) => clampMonthToMax(addMonths(m, 1), maxDate));
                setMonthMenuOpen(false);
              }}
              className={[
                "h-8 w-8 rounded-md flex items-center justify-center",
                nextDisabled ? "opacity-40 cursor-default" : "hover:bg-black/5",
              ].join(" ")}
            >
              <span className="text-[20px] leading-none text-zinc-800">→</span>
            </button>
          </div>

          <div className="mb-2 mt-1 h-px w-full bg-black/10" />

          <DayPicker
            mode="single"
            month={month}
            onMonthChange={(m) => {
              setMonth(clampMonthToMax(m, maxDate));
              setMonthMenuOpen(false);
            }}
            selected={selected ?? undefined}
            onSelect={(d) => {
              if (!d) return;
              if (isAfter(startOfDay(d), startOfDay(maxDate))) return;
              onChange(format(d, "yyyy-MM-dd"));
              setOpen(false);
              setMonthMenuOpen(false);
            }}
            showOutsideDays
            fixedWeeks
            weekStartsOn={1}
            disabled={{ after: maxDate }}
            hideNavigation
            components={{
              MonthCaption: () => <></>,
              DayButton: DayButtonLB,
            }}
          />

          {/* ✅ IMPORTANT: keep these backticks EXACTLY like this */}
          <style jsx global>{`
            .lb-rdp-scope .rdp {
              --rdp-cell-size: 40px;
            }

            .lb-rdp-scope .rdp-month_grid {
              border-collapse: separate !important;
              border-spacing: 6px 6px !important;
            }

            .lb-rdp-scope .rdp-day,
            .lb-rdp-scope .rdp-weekday {
              background: transparent !important;
              padding: 0 !important;
            }

            .lb-rdp-scope .rdp-day_button {
              width: 34px !important;
              height: 34px !important;
              padding: 0 !important;
              margin: 0 !important;
              display: inline-flex !important;
              align-items: center !important;
              justify-content: center !important;
            }

            .lb-rdp-scope .rdp-weekday {
              font-size: 14px;
              font-weight: 500;
              color: #8aa0b6;
            }
          `}</style>
        </div>
      ) : null}
    </div>
  );
}
