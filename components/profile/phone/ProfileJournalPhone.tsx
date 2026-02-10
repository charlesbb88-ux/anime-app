"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Heart, MessageSquare } from "lucide-react";
import type { JournalEntryRow } from "@/lib/journal";
import { supabase } from "@/lib/supabaseClient";

/* -------- helpers copied from page (keep behavior identical) -------- */

function monthLabel(d: Date) {
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

type Group = { key: string; label: string; items: JournalEntryRow[] };

function groupByMonth(rows: JournalEntryRow[]): Group[] {
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

function pickFirstString(obj: any, keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickFirstNumber(obj: any, keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  }
  return null;
}

function pickPosterUrl(obj: any) {
  return pickFirstString(obj, [
    "poster_url",
    "poster",
    "cover_url",
    "cover",
    "image_url",
    "image",
    "thumbnail_url",
    "thumb_url",
  ]);
}

function pickSlug(obj: any) {
  return pickFirstString(obj, ["slug", "handle", "url_slug"]);
}

function normalizeTitle(obj: any) {
  return (
    pickFirstString(obj, ["title_english", "title_romaji", "title", "name"]) ??
    pickFirstString(obj, ["title_native", "romanized_title"]) ??
    "Untitled"
  );
}

function normalizeYear(obj: any) {
  return pickFirstNumber(obj, ["year", "release_year", "start_year", "season_year"]);
}

function normalizeEpisodeLabel(ep: any) {
  const num = pickFirstNumber(ep, ["episode_number", "number", "episode", "ep_number"]);
  const t = pickFirstString(ep, ["title", "name"]);
  if (num != null && t) return `E${num}: ${t}`;
  if (num != null) return `E${num}`;
  if (t) return t;
  return "Episode";
}

function normalizeChapterLabel(ch: any) {
  const num = pickFirstNumber(ch, ["chapter_number", "number", "chapter"]);
  const t = pickFirstString(ch, ["title", "name"]);
  if (num != null && t) return `Ch ${num}: ${t}`;
  if (num != null) return `Ch ${num}`;
  if (t) return t;
  return "Chapter";
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

type MediaMaps = {
  animeById: Record<string, any>;
  mangaById: Record<string, any>;
  animeEpisodeById: Record<string, any>;
  mangaChapterById: Record<string, any>;
};

type ReviewPostMap = Record<string, string>; // review_id -> post_id

async function hydratePostsForReviews(rows: JournalEntryRow[]): Promise<ReviewPostMap> {
  const reviewIds = Array.from(new Set(rows.map((r) => r.review_id).filter(Boolean) as string[]));
  if (!reviewIds.length) return {};

  const { data, error } = await supabase.from("posts").select("id, review_id").in("review_id", reviewIds);
  if (error) return {};

  const map: ReviewPostMap = {};
  for (const p of data ?? []) {
    if (p?.review_id && p?.id) map[p.review_id] = p.id;
  }
  return map;
}

function countMonthStats(items: JournalEntryRow[]) {
  // Count only actual logs:
  // - chapters read: manga_chapter
  // - episodes watched: anime_episode
  let chapters = 0;
  let episodes = 0;

  for (const r of items) {
    if (r.kind === "manga_chapter") chapters += 1;
    if (r.kind === "anime_episode") episodes += 1;
  }

  return { chapters, episodes };
}

function StatPill({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xs border border-black bg-white px-1 py-.5 text-[11px] font-semibold text-black">
      <span className="text-zinc-700">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export default function ProfileJournalPhone({
  rows,
  media,
  loading,
  loadingMore,
  cursor,
  busyRow,
  onLoadMore,
  onToggleLike,
  onChangeRating,
  onOpenReviewEditor,
}: {
  rows: JournalEntryRow[];
  media: MediaMaps;
  loading: boolean;
  loadingMore: boolean;
  cursor: string | null;
  busyRow: string | null;
  onLoadMore: () => void;
  onToggleLike: (r: JournalEntryRow) => void;
  onChangeRating: (r: JournalEntryRow, next: number | null) => void;
  onOpenReviewEditor: (r: JournalEntryRow) => void;
}) {
  const groups = groupByMonth(rows);
  const loadmore_ref = useRef<HTMLDivElement | null>(null);

  // ✅ who is viewing (for Edit button visibility)
  const [viewerId, setViewerId] = useState<string | null>(null);

  // ✅ review_id -> post_id (for linking review icon to /posts/:postId)
  const [postIdByReviewId, setPostIdByReviewId] = useState<ReviewPostMap>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setViewerId(data?.user?.id ?? null);
    })();
  }, []);

  // keep map up-to-date as rows change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const m = await hydratePostsForReviews(rows);
      if (!cancelled) setPostIdByReviewId(m);
    })();
    return () => {
      cancelled = true;
    };
  }, [rows]);

  // Defensive: if "load more" returns no new rows, stop auto-loading.
  const [exhausted, setExhausted] = useState(false);

  // If parent correctly nulls cursor, treat that as end.
  useEffect(() => {
    if (!cursor) setExhausted(true);
  }, [cursor]);

  const tryLoadMore = useCallback(() => {
    if (!cursor) return;
    if (loading) return;
    if (loadingMore) return;
    if (exhausted) return;

    const before = rows.length;

    onLoadMore();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const after = rows.length;
        if (after <= before) setExhausted(true);
      });
    });
  }, [cursor, exhausted, loading, loadingMore, onLoadMore, rows.length]);

  useEffect(() => {
    if (!cursor) return;
    if (loading) return;
    if (loadingMore) return;
    if (exhausted) return;

    const el = loadmore_ref.current;
    if (!el) return;

    let didfire = false;

    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        if (didfire) return;

        if (!cursor) return;
        if (loadingMore) return;
        if (exhausted) return;

        didfire = true;
        tryLoadMore();
      },
      {
        root: null,
        rootMargin: "600px 0px",
        threshold: 0,
      }
    );

    obs.observe(el);

    return () => {
      obs.disconnect();
    };
  }, [cursor, exhausted, loading, loadingMore, tryLoadMore]);

  function getDisplay(r: JournalEntryRow) {
    const anime = r.anime_id ? media.animeById[r.anime_id] : null;
    const manga = r.manga_id ? media.mangaById[r.manga_id] : null;
    const ep = r.anime_episode_id ? media.animeEpisodeById[r.anime_episode_id] : null;
    const ch = r.manga_chapter_id ? media.mangaChapterById[r.manga_chapter_id] : null;

    let title = "Untitled";
    let subtitle: string | null = null;
    let year: number | null = null;
    let posterUrl: string | null = null;
    let href: string | null = null;

    if (r.kind === "anime_episode") {
      title = anime ? normalizeTitle(anime) : "Anime";
      subtitle = ep ? normalizeEpisodeLabel(ep) : "Episode";
      year = anime ? normalizeYear(anime) : null;
      posterUrl = anime ? pickPosterUrl(anime) : null;
      const slug = anime ? pickSlug(anime) : null;
      href = slug ? `/anime/${slug}` : null;
    } else if (r.kind === "anime_series") {
      title = anime ? normalizeTitle(anime) : "Anime";
      year = anime ? normalizeYear(anime) : null;
      posterUrl = anime ? pickPosterUrl(anime) : null;
      const slug = anime ? pickSlug(anime) : null;
      href = slug ? `/anime/${slug}` : null;
    } else if (r.kind === "manga_chapter") {
      title = manga ? normalizeTitle(manga) : "Manga";
      subtitle = ch ? normalizeChapterLabel(ch) : "Chapter";
      year = manga ? normalizeYear(manga) : null;
      posterUrl = manga ? pickPosterUrl(manga) : null;
      const slug = manga ? pickSlug(manga) : null;
      href = slug ? `/manga/${slug}` : null;
    } else {
      title = manga ? normalizeTitle(manga) : "Manga";
      year = manga ? normalizeYear(manga) : null;
      posterUrl = manga ? pickPosterUrl(manga) : null;
      const slug = manga ? pickSlug(manga) : null;
      href = slug ? `/manga/${slug}` : null;
    }

    return { title, subtitle, year, posterUrl, href };
  }

  function postHrefForReviewId(reviewId: string) {
    const postId = postIdByReviewId[reviewId];
    return postId ? `/posts/${postId}` : null;
  }

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
                {/* Month header (updated) */}
                <div className="border-b border-black bg-zinc-50 px-4 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    {/* bigger month text + matches page style */}
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-extrabold tracking-wide text-zinc-900">
                        {g.label}
                      </div>
                    </div>

                    {/* month stats */}
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

                    const isOwner =
                      viewerId != null && (r as any).user_id != null && viewerId === (r as any).user_id;

                    const postHref = r.review_id ? postHrefForReviewId(r.review_id) : null;

                    return (
                      <div key={`${r.kind}:${r.log_id}`} className="pl-2 pr-3 py-1">
                        <div className="flex items-center gap-3">
                          <div className="w-[43px] shrink-0 tabular-nums text-3xl font-semibold leading-none flex items-center justify-end">
                            {day}
                          </div>

                          {/* ✅ DO NOT CHANGE: this padding defines the row height */}
                          <div className="py-1 shrink-0">
                            {display.posterUrl ? (
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

                                  {/* REVIEW ICON + EDIT (absolute, does not shift row) */}
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

          {/* ✅ invisible infinite-scroll sentinel (no UI) */}
          <div ref={loadmore_ref} className="h-1 w-full" />
        </>
      )}
    </div>
  );
}
