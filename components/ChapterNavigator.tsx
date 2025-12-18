"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Props = {
  slug: string;
  totalChapters: number | null;
  currentChapterNumber: number | null; // null on main manga page
};

export default function ChapterNavigator({
  slug,
  totalChapters,
  currentChapterNumber,
}: Props) {
  const [value, setValue] = useState<string>("");

  const total = typeof totalChapters === "number" && totalChapters > 0 ? totalChapters : null;

  const prevNum = useMemo(() => {
    if (currentChapterNumber == null) return null;
    const n = currentChapterNumber - 1;
    if (n <= 0) return null;
    return n;
  }, [currentChapterNumber]);

  const nextNum = useMemo(() => {
    if (currentChapterNumber == null) return null;
    const n = currentChapterNumber + 1;
    if (total != null && n > total) return null;
    return n;
  }, [currentChapterNumber, total]);

  function parseTarget(): number | null {
    const raw = value.trim();
    if (!raw) return null;

    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    const int = Math.floor(n);
    if (int <= 0) return null;

    if (total != null && int > total) return null;
    return int;
  }

  const target = parseTarget();
  const canGo = !!target;

  const baseBtn =
    "rounded-md border border-gray-700 bg-gray-900/40 px-3 py-1 text-xs font-medium text-gray-200 hover:bg-gray-900/60";

  const disabledBtn =
    "rounded-md border border-gray-800 bg-gray-900/20 px-3 py-1 text-xs font-medium text-gray-500 cursor-not-allowed";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Prev / Next only make sense when you're ON a chapter page */}
      {currentChapterNumber != null ? (
        <>
          {prevNum ? (
            <Link href={`/manga/${slug}/chapter/${prevNum}`} className={baseBtn}>
              ← Prev
            </Link>
          ) : (
            <span className={disabledBtn}>← Prev</span>
          )}

          {nextNum ? (
            <Link href={`/manga/${slug}/chapter/${nextNum}`} className={baseBtn}>
              Next →
            </Link>
          ) : (
            <span className={disabledBtn}>Next →</span>
          )}
        </>
      ) : (
        <>
          <span className={disabledBtn}>← Prev</span>
          <span className={disabledBtn}>Next →</span>
        </>
      )}

      {/* Jump to chapter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Go to:</span>

        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="numeric"
          placeholder={total ? `1-${total}` : "Chapter #"}
          className="w-24 rounded-md border border-gray-700 bg-black/20 px-2 py-1 text-xs text-gray-100 outline-none"
        />

        {canGo ? (
          <Link href={`/manga/${slug}/chapter/${target}`} className={baseBtn}>
            Go
          </Link>
        ) : (
          <span className={disabledBtn}>Go</span>
        )}
      </div>

      {total != null && (
        <span className="text-xs text-gray-500">
          Total: <span className="text-gray-300">{total}</span>
        </span>
      )}
    </div>
  );
}
