"use client";

type Option = {
  id: string;
  label: string;
};

type Props = {
  title: string;
  options: Option[];
  selectedId: string | null | undefined;
  onSelect: (id: string | null) => void;
  allowNone?: boolean;
  noneLabel?: string;
};

export default function McPaperDollOptionSelector({
  title,
  options,
  selectedId,
  onSelect,
  allowNone = false,
  noneLabel = "None",
}: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 text-sm font-semibold text-white">{title}</div>

      <div className="flex flex-wrap gap-2">
        {allowNone && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={[
              "rounded-xl border px-3 py-2 text-sm transition",
              selectedId == null
                ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                : "border-white/10 bg-black/20 text-white/80 hover:border-white/20 hover:bg-white/10",
            ].join(" ")}
          >
            {noneLabel}
          </button>
        )}

        {options.map((option) => {
          const selected = selectedId === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option.id)}
              className={[
                "rounded-xl border px-3 py-2 text-sm transition",
                selected
                  ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                  : "border-white/10 bg-black/20 text-white/80 hover:border-white/20 hover:bg-white/10",
              ].join(" ")}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}