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

export default function LogDatePicker({
  value,
  onChange,
  disabled,
  maxDateStr,
}: Props) {
  const selected = ymdToDate(value);
  const maxDate = ymdToDate(maxDateStr) ?? new Date();

  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

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
    }

    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("touchstart", onDocDown, { passive: true });

    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("touchstart", onDocDown);
    };
  }, [open]);

  const fieldLabel = selected ? format(selected, "dd MMM yyyy") : "Select date";

  const maxMonth = startOfMonth(maxDate);
  const prevMonth = addMonths(month, -1);
  const nextMonth = addMonths(month, 1);
  const nextDisabled = isAfter(startOfMonth(nextMonth), maxMonth);

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

      // This matters on iOS: a transparent border prevents AA “bleeding”
      // that makes adjacent tiles look fused.
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
        onClick={() => setOpen((v) => !v)}
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
            // ✅ scope class so our CSS *definitely* applies
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
              onClick={() => setMonth(startOfMonth(prevMonth))}
              className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-black/5"
            >
              <span className="text-[20px] leading-none text-zinc-800">←</span>
            </button>

            <div className="flex flex-1 justify-center px-2">
              <div className="w-[190px] max-w-[190px] flex items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-1.5 shadow-sm">
                <span className="text-[15px] font-medium text-zinc-800 truncate">
                  {format(month, "MMMM, yyyy")}
                </span>
                <span className="text-zinc-500">▾</span>
              </div>
            </div>

            <button
              type="button"
              aria-label="Next month"
              disabled={nextDisabled}
              onClick={() =>
                setMonth((m) => clampMonthToMax(addMonths(m, 1), maxDate))
              }
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
            onMonthChange={(m) => setMonth(clampMonthToMax(m, maxDate))}
            selected={selected ?? undefined}
            onSelect={(d) => {
              if (!d) return;
              if (isAfter(startOfDay(d), startOfDay(maxDate))) return;
              onChange(format(d, "yyyy-MM-dd"));
              setOpen(false);
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

          {/* ✅ Hard-force the real gaps (Letterboxd look), even on iOS/Safari */}
          <style jsx global>{`
            .lb-rdp-scope .rdp {
              --rdp-cell-size: 40px;
            }

            /* The month grid is a TABLE in RDP.
               These two lines are the whole “gap between tiles” trick. */
            .lb-rdp-scope .rdp-month_grid {
              border-collapse: separate !important;
              border-spacing: 6px 6px !important;
            }

            /* Make sure the cell itself is transparent so you don't get a blue slab */
            .lb-rdp-scope .rdp-day,
            .lb-rdp-scope .rdp-weekday {
              background: transparent !important;
              padding: 0 !important;
            }

            /* Keep numbers centered and prevent any stretching */
            .lb-rdp-scope .rdp-day_button {
              width: 34px !important;
              height: 34px !important;
              padding: 0 !important;
              margin: 0 !important;
              display: inline-flex !important;
              align-items: center !important;
              justify-content: center !important;
            }

            /* Weekday labels color/weight like your Tailwind version */
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
