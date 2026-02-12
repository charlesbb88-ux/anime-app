"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Heart, MessageSquare } from "lucide-react";
import type { JournalEntryRow } from "@/lib/journal";
import { supabase } from "@/lib/supabaseClient";

/**
 * Phone journal reads ONLY from denormalized fields on user_journal_items:
 *   media_title, entry_label, poster_url, media_slug, media_year, review_post_id
 */

type UiJournalRow = JournalEntryRow & {
  media_title?: string | null;
  entry_label?: string | null;
  poster_url?: string | null;
  media_slug?: string | null;
  media_year?: number | null;
  review_post_id?: string | null;

  anime_id?: string | null;
  manga_id?: string | null;
};

/* -------- helpers copied from page (keep behavior identical) -------- */

function monthLabel(d: Date) {
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

type Group = { key: string; label: string; items: UiJournalRow[] };

function groupByMonth(rows: UiJournalRow[]): Group[] {
  const groups: Group[] = [];
  const map = new Map<string, Group>();

  for (const r of rows) {
    const d = new Date(r.logged_at);
    const label = monthLabel(d);
    const key = label;

    if (!map.has(key)) {
      const g: Group = { key, label, items: [] };
      map.set(key, g);
      groups.push(g);
    }

    map.get(key)!.items.push(r);
  }

  return groups;
}

function dayNumber(d: Date) {
  return d.getDate();
}

function countMonthStats(items: UiJournalRow[]) {
  let chapters = 0;
  let episodes = 0;

  for (const r of items) {
    if (r.kind === "manga_chapter") chapters += 1;
    if (r.kind === "anime_episode") episodes += 1;
  }

  return { chapters, episodes };
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xs border border-black bg-white px-1 py-.5 text-[11px] font-semibold text-black">
      <span className="text-zinc-700">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/* -------- rating UI copied (smaller on phone) -------- */

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function ratingToStarSteps(rating: number | null) {
  if (rating == null) return 0;
  const r = clamp(Math.round(rating), 0, 100);
  return Math.round(r / 10); // 0..10
}

function starStepsToRating(steps: number) {
  const s = clamp(steps, 0, 10);
  return s * 10;
}

function computeStarFillPercent(steps: number, starIndex: number) {
  const start = (starIndex - 1) * 2;
  const remaining = steps - start;

  if (remaining >= 2) return 100 as const;
  if (remaining === 1) return 50 as const;
  return 0 as const;
}

function StarVisual({
  filledPercent,
  disabled,
  outlineClass,
}: {
  filledPercent: 0 | 50 | 100;
  disabled?: boolean;
  outlineClass: string;
}) {
  return (
    <span className={["relative inline-block", disabled ? "opacity-60" : ""].join(" ")}>
      <span className={["block", outlineClass].join(" ")} style={{ width: 20, height: 20 }}>
        <svg viewBox="0 0 24 24" width="20" height="20" className="block">
          <path
            d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      {filledPercent > 0 && (
        <span
          className="pointer-events-none absolute left-0 top-0 overflow-hidden text-zinc-800"
          style={{ width: `${filledPercent}%`, height: 20 }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" className="block">
            <path
              d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
              fill="currentColor"
            />
          </svg>
        </span>
      )}
    </span>
  );
}

function StarRatingPhone({
  value,
  disabled,
  onChange,
}: {
  value: number | null;
  disabled?: boolean;
  onChange: (next: number | null) => void;
}) {
  const steps = ratingToStarSteps(value);
  const outlineClass = steps === 0 ? "text-zinc-200" : "text-zinc-500";

  return (
    <div
      className="flex items-center justify-start gap-[1px]"
      onContextMenu={(e) => {
        e.preventDefault();
        if (!disabled) onChange(null);
      }}
      title="Click to rate (right-click to clear)"
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const starIndex = i + 1;
        const filled = computeStarFillPercent(steps, starIndex);

        return (
          <div key={starIndex} className="relative h-5 w-5">
            <StarVisual filledPercent={filled} disabled={disabled} outlineClass={outlineClass} />

            <button
              type="button"
              disabled={disabled}
              className="absolute inset-y-0 left-0 w-1/2"
              onClick={() => onChange(starStepsToRating(starIndex * 2 - 1))}
              aria-label={`Rate ${starIndex - 0.5} stars`}
            />

            <button
              type="button"
              disabled={disabled}
              className="absolute inset-y-0 right-0 w-1/2"
              onClick={() => onChange(starStepsToRating(starIndex * 2))}
              aria-label={`Rate ${starIndex} stars`}
            />
          </div>
        );
      })}
    </div>
  );
}

/* -------- component -------- */

function getDisplay(r: UiJournalRow) {
  const title = (r.media_title ?? "Untitled").trim() || "Untitled";
  const subtitle = (r.entry_label ?? null) as string | null;
  const year = typeof r.media_year === "number" ? r.media_year : null;
  const posterUrl = (r.poster_url ?? null) as string | null;

  let href: string | null = null;
  const slug = (r.media_slug ?? null) as string | null;

  if (slug) {
    if (r.anime_id) href = `/anime/${slug}`;
    else if (r.manga_id) href = `/manga/${slug}`;
  }

  return { title, subtitle, year, posterUrl, href };
}

function postHrefForRow(r: UiJournalRow) {
  if (r.review_post_id) return `/posts/${r.review_post_id}`;
  return null;
}

export default function ProfileJournalPhone({
  rows,
  loading,
  loadingMore,
  cursor,
  busyRow,
  onLoadMore,
  onToggleLike,
  onChangeRating,
  onOpenReviewEditor,
}: {
  rows: UiJournalRow[];
  loading: boolean;
  loadingMore: boolean;
  cursor: string | null;
  busyRow: string | null;
  onLoadMore: () => void;
  onToggleLike: (r: UiJournalRow) => void;
  onChangeRating: (r: UiJournalRow, next: number | null) => void;
  onOpenReviewEditor: (r: UiJournalRow) => void;
}) {
  const groups = useMemo(() => groupByMonth(rows), [rows]);
  const loadmore_ref = useRef<HTMLDivElement | null>(null);

  // who is viewing (for Edit visibility)
  const [viewerId, setViewerId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setViewerId(data?.user?.id ?? null);
    })();
  }, []);

  /**
   * REAL infinite scroll:
   * - when sentinel becomes visible, call onLoadMore()
   * - guard with loading/loadingMore/cursor
   * - prevent rapid double-fires with a ref
   */
  const requested_ref = useRef(false);
  const last_len_ref = useRef<number>(rows.length);

  useEffect(() => {
    if (rows.length !== last_len_ref.current) {
      last_len_ref.current = rows.length;
      requested_ref.current = false; // new rows arrived -> allow next request
    }
  }, [rows.length]);

  useEffect(() => {
    if (!loadingMore) {
      requested_ref.current = false; // fetch ended -> allow next request
    }
  }, [loadingMore]);

  useEffect(() => {
    const el = loadmore_ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;

        if (!cursor) return; // parent has no cursor => end
        if (loading) return;
        if (loadingMore) return;
        if (requested_ref.current) return;

        requested_ref.current = true;
        onLoadMore();
      },
      {
        root: null,
        rootMargin: "900px 0px",
        threshold: 0,
      }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [cursor, loading, loadingMore, onLoadMore]);

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
          No journal entries (or they’re private).
        </div>
      ) : (
        <>
          {groups.map((g) => {
            const stats = countMonthStats(g.items);

            return (
              <div key={g.key} className="overflow-hidden rounded-xl border border-black bg-white">
                <div className="border-b border-black bg-zinc-50 px-4 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-extrabold tracking-wide text-zinc-900">
                        {g.label}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <StatPill label="Chapters" value={stats.chapters} />
                      <StatPill label="Episodes" value={stats.episodes} />
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-black">
                  {g.items.map((r) => {
                    const d = new Date(r.logged_at);
                    const day = dayNumber(d);
                    const display = getDisplay(r);
                    const isBusy = busyRow === r.log_id;

                    const isOwner = viewerId != null && r.user_id != null && viewerId === r.user_id;
                    const postHref = r.review_id ? postHrefForRow(r) : null;

                    return (
                      <div key={`${r.kind}:${r.log_id}`} className="pl-2 pr-3 py-1">
                        <div className="flex items-center gap-3">
                          <div className="w-[43px] shrink-0 tabular-nums text-3xl font-semibold leading-none flex items-center justify-end">
                            {day}
                          </div>

                          {/* ✅ DO NOT CHANGE: this padding defines the row height */}
                          <div className="py-1 shrink-0">
                            {display.posterUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={display.posterUrl}
                                alt=""
                                className="h-[72px] w-[48px] rounded-xs object-cover ring-1 ring-black"
                                loading="lazy"
                              />
                            ) : (
                              <div className="h-[72px] w-[48px] rounded-xs bg-zinc-100 ring-1 ring-black" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1 flex items-center">
                            <div className="min-w-0 flex-1 flex flex-col justify-center">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  {display.href ? (
                                    <Link
                                      href={display.href}
                                      className="block truncate text-[15px] font-bold text-zinc-900 hover:underline"
                                    >
                                      {display.title}
                                    </Link>
                                  ) : (
                                    <div className="truncate text-[15px] font-bold text-zinc-900">{display.title}</div>
                                  )}

                                  {display.subtitle ? (
                                    <div className="truncate text-[13px] font-semibold text-zinc-900">
                                      {display.subtitle}
                                    </div>
                                  ) : null}
                                </div>

                                <div className="flex shrink-0 items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => onToggleLike(r)}
                                    className="inline-flex items-center justify-center rounded-md p-1 hover:bg-zinc-100 disabled:opacity-50"
                                    title="Like"
                                  >
                                    <Heart
                                      className={`h-5 w-5 ${r.liked ? "text-red-500" : "text-zinc-200"}`}
                                      fill={r.liked ? "currentColor" : "none"}
                                    />
                                  </button>

                                  <div className="relative h-[28px] w-[28px]">
                                    {r.review_id && postHref ? (
                                      <Link
                                        href={postHref}
                                        className="absolute inset-0 inline-flex items-center justify-center rounded-md p-1 hover:bg-zinc-100"
                                        title="Open review"
                                      >
                                        <MessageSquare className="h-5 w-5 text-zinc-700" />
                                      </Link>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => onOpenReviewEditor(r)}
                                        className="absolute inset-0 inline-flex items-center justify-center rounded-md p-1 hover:bg-zinc-100 disabled:opacity-50"
                                        disabled={isBusy}
                                        title={r.review_id ? "Edit review" : "Add review"}
                                      >
                                        <MessageSquare
                                          className={`h-5 w-5 ${r.review_id ? "text-zinc-700" : "text-zinc-200"}`}
                                        />
                                      </button>
                                    )}

                                    {isOwner && (
                                      <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() => onOpenReviewEditor(r)}
                                        className="absolute left-1/2 top-full mt-1 -translate-x-1/2 rounded-md px-2 py-[3px] text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                                        title="Edit review"
                                      >
                                        Edit
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-1">
                                <StarRatingPhone
                                  value={r.rating == null ? null : Math.round(Number(r.rating))}
                                  disabled={isBusy}
                                  onChange={(next) => onChangeRating(r, next)}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* sentinel */}
          <div ref={loadmore_ref} className="h-1 w-full" />
        </>
      )}
    </div>
  );
}
