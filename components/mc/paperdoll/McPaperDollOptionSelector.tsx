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
    <div className="rounded-2xl border border-black border-2 bg-white p-4">
      <div className="mb-3 text-sm font-semibold text-black">{title}</div>

      <div className="flex flex-wrap gap-2">
        {allowNone && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={[
              "rounded-xl border px-3 py-2 text-sm transition",
              selectedId == null
                ? "border-black bg-black text-white"
                : "border-black bg-white/20 text-black/80 hover:bg-black/5",
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
                  ? "border-black bg-black text-white"
                  : "border-black bg-white/20 text-black/80 hover:bg-black/5",
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