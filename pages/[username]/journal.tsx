// pages/[username]/journal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { NextPage } from "next";
import Link from "next/link";
import { Heart, MessageSquare } from "lucide-react";

import ProfileJournalPhone from "@/components/profile/phone/ProfileJournalPhone";

import ProfileLayout from "@/components/profile/ProfileLayout";

import { supabase } from "@/lib/supabaseClient";
import {
  listJournalEntriesByUserId,
  type JournalEntryRow,
  updateLogRating,
  toggleLogLiked,
  fetchReviewById,
  upsertReviewForLog,
  setLogReviewId,
} from "@/lib/journal";

/* ---------------------- small helpers ---------------------- */

function monthLabel(d: Date) {
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function dayNumber(d: Date) {
  return d.getDate();
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

type MediaMaps = {
  animeById: Record<string, any>;
  mangaById: Record<string, any>;
  animeEpisodeById: Record<string, any>;
  mangaChapterById: Record<string, any>;
};

async function hydrateMediaForRows(rows: JournalEntryRow[]): Promise<MediaMaps> {
  const animeIds = Array.from(new Set(rows.map((r) => r.anime_id).filter(Boolean) as string[]));
  const mangaIds = Array.from(new Set(rows.map((r) => r.manga_id).filter(Boolean) as string[]));
  const epIds = Array.from(new Set(rows.map((r) => r.anime_episode_id).filter(Boolean) as string[]));
  const chIds = Array.from(new Set(rows.map((r) => r.manga_chapter_id).filter(Boolean) as string[]));

  const [animeRes, mangaRes, epRes, chRes] = await Promise.all([
    animeIds.length
      ? supabase.from("anime").select("*").in("id", animeIds)
      : Promise.resolve({ data: [], error: null } as any),
    mangaIds.length
      ? supabase.from("manga").select("*").in("id", mangaIds)
      : Promise.resolve({ data: [], error: null } as any),
    epIds.length
      ? supabase.from("anime_episodes").select("*").in("id", epIds)
      : Promise.resolve({ data: [], error: null } as any),
    chIds.length
      ? supabase.from("manga_chapters").select("*").in("id", chIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  const animeById: Record<string, any> = {};
  const mangaById: Record<string, any> = {};
  const animeEpisodeById: Record<string, any> = {};
  const mangaChapterById: Record<string, any> = {};

  for (const a of animeRes.data ?? []) animeById[a.id] = a;
  for (const m of mangaRes.data ?? []) mangaById[m.id] = m;
  for (const e of epRes.data ?? []) animeEpisodeById[e.id] = e;
  for (const c of chRes.data ?? []) mangaChapterById[c.id] = c;

  return { animeById, mangaById, animeEpisodeById, mangaChapterById };
}

/* ---------------------- review -> post id map (for linking icon) ---------------------- */

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

async function fetchPostIdForReviewId(reviewId: string): Promise<string | null> {
  const { data, error } = await supabase.from("posts").select("id").eq("review_id", reviewId).limit(1).maybeSingle();
  if (error) return null;
  return data?.id ?? null;
}

/* ---------------------- rating UI ---------------------- */

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

/**
 * NOTE: Star colors intentionally NOT inverted per request.
 * - unfilled star stays text-zinc-700
 * - filled star stays text-amber-300
 */
function StarVisual({
  filledPercent,
  disabled,
}: {
  filledPercent: 0 | 50 | 100;
  disabled?: boolean;
}) {
  return (
    <span className={["relative inline-block leading-none", disabled ? "opacity-60" : ""].join(" ")}>
      <span className="relative -top-[3px] text-zinc-700" style={{ fontSize: 25 }}>
        ★
      </span>

      {filledPercent > 0 && (
        <span
          className="pointer-events-none absolute left-0 -top-[3px] overflow-hidden text-amber-300"
          style={{ width: `${filledPercent}%`, fontSize: 25 }}
        >
          ★
        </span>
      )}
    </span>
  );
}

function StarRating({
  value,
  disabled,
  onChange,
}: {
  value: number | null;
  disabled?: boolean;
  onChange: (next: number | null) => void;
}) {
  const steps = ratingToStarSteps(value);

  return (
    <div
      className="flex items-center justify-center gap-[2px]"
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
          <div key={starIndex} className="relative h-6 w-6">
            <StarVisual filledPercent={filled} disabled={disabled} />

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

/* ---------------------- review modal ---------------------- */

type ReviewModalState = {
  open: boolean;
  saving: boolean;
  error: string | null;

  log: JournalEntryRow | null;

  title: string;

  reviewId: string | null;
  content: string;
  rating: number | null;
  containsSpoilers: boolean;
  visibility: "public" | "friends" | "private";
  authorLiked: boolean;
};

function newModalState(): ReviewModalState {
  return {
    open: false,
    saving: false,
    error: null,
    log: null,
    title: "Review",
    reviewId: null,
    content: "",
    rating: null,
    containsSpoilers: false,
    visibility: "public",
    authorLiked: false,
  };
}

/* ---------------------- page body (inside ProfileLayout) ---------------------- */

function JournalBody({ profileId }: { profileId: string }) {
  const [rows, setRows] = useState<JournalEntryRow[]>([]);
  const [media, setMedia] = useState<MediaMaps>({
    animeById: {},
    mangaById: {},
    animeEpisodeById: {},
    mangaChapterById: {},
  });

  const [viewerId, setViewerId] = useState<string | null>(null);
  const isOwner = viewerId != null && viewerId === profileId;

  const [postIdByReviewId, setPostIdByReviewId] = useState<ReviewPostMap>({});

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [reviewModal, setReviewModal] = useState<ReviewModalState>(newModalState);

  const cursor = useMemo(() => {
    if (!rows.length) return null;
    return rows[rows.length - 1].logged_at;
  }, [rows]);

  const groups = useMemo(() => groupByMonth(rows), [rows]);

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
      subtitle = null;
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
      subtitle = null;
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

  async function loadViewer() {
    const { data } = await supabase.auth.getUser();
    setViewerId(data?.user?.id ?? null);
  }

  async function loadInitial() {
    setLoading(true);
    setErrorMsg(null);

    const { rows: r, error } = await listJournalEntriesByUserId(profileId, { limit: 50 });

    if (error) {
      setErrorMsg(error.message ?? "Failed to load journal.");
      setRows([]);
      setLoading(false);
      return;
    }

    setRows(r);
    const hydrated = await hydrateMediaForRows(r);
    setMedia(hydrated);

    const postMap = await hydratePostsForReviews(r);
    setPostIdByReviewId(postMap);

    setLoading(false);
  }

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    setErrorMsg(null);

    const { rows: more, error } = await listJournalEntriesByUserId(profileId, {
      limit: 50,
      beforeLoggedAt: cursor,
    });

    if (error) {
      setErrorMsg(error.message ?? "Failed to load more.");
      setLoadingMore(false);
      return;
    }

    const combined = [...rows, ...more];
    setRows(combined);

    const hydrated = await hydrateMediaForRows(combined);
    setMedia(hydrated);

    const postMap = await hydratePostsForReviews(combined);
    setPostIdByReviewId(postMap);

    setLoadingMore(false);
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setRows([]);
      setMedia({
        animeById: {},
        mangaById: {},
        animeEpisodeById: {},
        mangaChapterById: {},
      });
      setPostIdByReviewId({});
      await Promise.all([loadViewer(), loadInitial()]);
    })();

    return () => {
      cancelled = true;
      void cancelled;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  function patchRow(logId: string, patch: Partial<JournalEntryRow>) {
    setRows((prev) => prev.map((r) => (r.log_id === logId ? { ...r, ...patch } : r)));
  }

  async function onChangeRating(r: JournalEntryRow, next: number | null) {
    setBusyRow(r.log_id);
    setErrorMsg(null);

    patchRow(r.log_id, { rating: next });

    const { error } = await updateLogRating({
      kind: r.kind,
      logId: r.log_id,
      rating: next,
    });

    if (error) {
      patchRow(r.log_id, { rating: r.rating });
      setErrorMsg(error.message ?? "Failed to update rating.");
    }

    setBusyRow(null);
  }

  async function onToggleLike(r: JournalEntryRow) {
    const next = !Boolean(r.liked);
    setBusyRow(r.log_id);
    setErrorMsg(null);

    patchRow(r.log_id, { liked: next });

    const { error } = await toggleLogLiked({
      kind: r.kind,
      logId: r.log_id,
      liked: next,
    });

    if (error) {
      patchRow(r.log_id, { liked: r.liked });
      setErrorMsg(error.message ?? "Failed to update like.");
    }

    setBusyRow(null);
  }

  async function openReviewEditor(r: JournalEntryRow) {
    const display = getDisplay(r);

    setReviewModal({
      ...newModalState(),
      open: true,
      saving: false,
      error: null,
      log: r,
      title: display.title,

      reviewId: r.review_id ?? null,
      rating: r.rating == null ? null : Math.round(Number(r.rating)),
      containsSpoilers: Boolean(r.contains_spoilers),
      visibility: r.visibility ?? "public",
      authorLiked: Boolean(r.liked),
      content: "",
    });

    if (r.review_id) {
      const { review, error } = await fetchReviewById(r.review_id);
      if (error) {
        setReviewModal((m) => ({ ...m, error: error.message ?? "Failed to load review." }));
        return;
      }
      if (review) {
        setReviewModal((m) => ({
          ...m,
          reviewId: review.id,
          content: review.content ?? "",
          rating: review.rating ?? m.rating,
          containsSpoilers: Boolean(review.contains_spoilers),
          visibility: review.visibility ?? m.visibility,
          authorLiked: Boolean(review.author_liked),
        }));
      }
    }
  }

  async function saveReviewFromModal() {
    if (!reviewModal.log) return;

    setReviewModal((m) => ({ ...m, saving: true, error: null }));
    setErrorMsg(null);

    const r = reviewModal.log;

    const { reviewId, error } = await upsertReviewForLog({
      kind: r.kind,
      anime_id: r.anime_id,
      anime_episode_id: r.anime_episode_id,
      manga_id: r.manga_id,
      manga_chapter_id: r.manga_chapter_id,

      review_id: reviewModal.reviewId,

      rating: reviewModal.rating,
      content: reviewModal.content,
      contains_spoilers: reviewModal.containsSpoilers,
      visibility: reviewModal.visibility,
      author_liked: reviewModal.authorLiked,
    });

    if (error) {
      setReviewModal((m) => ({ ...m, saving: false, error: error.message ?? "Failed to save review." }));
      return;
    }

    if (!reviewModal.reviewId && reviewId) {
      const { error: linkErr } = await setLogReviewId({
        kind: r.kind,
        logId: r.log_id,
        reviewId,
      });

      if (linkErr) {
        setReviewModal((m) => ({
          ...m,
          saving: false,
          error: linkErr.message ?? "Saved review, but failed to link it.",
        }));
        return;
      }
    }

    const finalReviewId = (reviewId ?? reviewModal.reviewId ?? null) as string | null;

    patchRow(r.log_id, {
      review_id: finalReviewId,
      rating: reviewModal.rating,
      liked: reviewModal.authorLiked,
      contains_spoilers: reviewModal.containsSpoilers,
      visibility: reviewModal.visibility,
    });

    // make the link work immediately after first save
    if (finalReviewId && !postIdByReviewId[finalReviewId]) {
      const postId = await fetchPostIdForReviewId(finalReviewId);
      if (postId) setPostIdByReviewId((prev) => ({ ...prev, [finalReviewId]: postId }));
    }

    setReviewModal((m) => ({ ...m, saving: false, open: false }));
  }

  return (
    <>
      {errorMsg && (
        <div className="mb-4 rounded-lg border border-red-600/30 bg-red-600/10 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      {/* ✅ Desktop (unchanged layout; only review cell behavior) */}
      <div className="hidden sm:block">
        {/* Table */}
        <div className="overflow-hidden rounded-md border border border-black bg-white">
          {/* header row */}
          <div className="grid grid-cols-[56px_1fr_90px_140px_70px_70px] gap-0 border-b border-black bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
            <div>DAY</div>
            <div>TITLE</div>
            <div className="text-center">YEAR</div>
            <div className="text-center">RATING</div>
            <div className="text-center">LIKE</div>
            <div className="text-center">REVIEW</div>
          </div>

          {loading ? (
            <div className="px-4 py-8 text-sm text-zinc-700">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-zinc-700">No journal entries (or they’re private).</div>
          ) : (
            <div>
              {groups.map((g) => (
                <div key={g.key} className="border-b border-black last:border-b-0">
                  <div className="px-4 py-3 text-xs font-semibold tracking-wide text-zinc-700">{g.label}</div>

                  {g.items.map((r) => {
                    const d = new Date(r.logged_at);
                    const day = dayNumber(d);
                    const display = getDisplay(r);
                    const isBusy = busyRow === r.log_id;

                    const postHref = r.review_id ? postHrefForReviewId(r.review_id) : null;

                    return (
                      <div
                        key={`${r.kind}:${r.log_id}`}
                        className="grid grid-cols-[56px_1fr_90px_140px_70px_70px] items-center gap-0 border-t border-black px-4 py-3 text-sm text-zinc-900 hover:bg-zinc-100"
                      >
                        <div className="flex items-center justify-end pr-5">
                          <div className="w-[2ch] text-right tabular-nums text-3xl font-semibold leading-none text-zinc-600">
                            {day}
                          </div>
                        </div>

                        {/* title cell */}
                        <div className="flex min-w-0 items-center gap-3">
                          {display.posterUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={display.posterUrl}
                              alt=""
                              className="h-[84px] w-[56px] shrink-0 rounded object-cover ring-1 ring-zinc-200"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-[42px] w-[28px] rounded bg-zinc-100 ring-1 ring-zinc-200" />
                          )}

                          <div className="min-w-0">
                            <div className="flex items-baseline gap-2">
                              {display.href ? (
                                <Link
                                  href={display.href}
                                  className="truncate text-xl font-bold text-zinc-900 hover:text-black hover:underline"
                                >
                                  {display.title}
                                </Link>
                              ) : (
                                <div className="truncate font-semibold text-zinc-900">{display.title}</div>
                              )}
                            </div>

                            {display.subtitle ? (
                              <div className="truncate text-lg font-bold text-zinc-900">{display.subtitle}</div>
                            ) : null}
                          </div>
                        </div>

                        {/* year */}
                        <div className="flex items-center justify-center text-lg leading-none text-zinc-600">
                          {typeof display.year === "number" ? display.year : null}
                        </div>

                        {/* rating */}
                        <div className="flex items-center justify-center">
                          <StarRating
                            value={r.rating == null ? null : Math.round(Number(r.rating))}
                            disabled={isBusy}
                            onChange={(next) => onChangeRating(r, next)}
                          />
                        </div>

                        {/* like */}
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => onToggleLike(r)}
                            className="inline-flex items-center justify-center rounded-md p-1 hover:bg-zinc-100 disabled:opacity-50"
                            title="Like"
                          >
                            <Heart
                              className={`h-5 w-5 ${r.liked ? "text-rose-400" : "text-zinc-600"}`}
                              fill={r.liked ? "currentColor" : "none"}
                            />
                          </button>
                        </div>

                        {/* review column (icon position unchanged; Edit is absolute under it) */}
                        <div className="flex items-center justify-center">
                          <div className="relative h-[28px] w-[28px]">
                            {r.review_id && postHref ? (
                              <Link
                                href={postHref}
                                className="absolute inset-0 inline-flex items-center justify-center rounded-md p-1 hover:bg-zinc-100"
                                title="Open review"
                              >
                                <MessageSquare className="h-5 w-5 text-zinc-700" />
                              </Link>
                            ) : r.review_id ? (
                              // review exists but no post found yet — keep icon in same spot (still clickable to edit)
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => openReviewEditor(r)}
                                className="absolute inset-0 inline-flex items-center justify-center rounded-md p-1 hover:bg-zinc-100 disabled:opacity-50"
                                title="Edit review"
                              >
                                <MessageSquare className="h-5 w-5 text-zinc-700" />
                              </button>
                            ) : (
                              <div className="absolute inset-0 inline-flex items-center justify-center p-1" title="No review">
                                <MessageSquare className="h-5 w-5 text-zinc-300" />
                              </div>
                            )}

                            {isOwner && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => openReviewEditor(r)}
                                className="absolute left-1/2 top-full mt-1 -translate-x-1/2 rounded-md px-2 py-[3px] text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                                title="Edit review"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              <div className="px-4 py-4">
                <button
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 text-sm text-zinc-800 hover:bg-zinc-100 disabled:opacity-50"
                  onClick={loadMore}
                  disabled={loadingMore || !cursor}
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ✅ Phone (EXACTLY as you had it) */}
      <div className="sm:hidden">
        <ProfileJournalPhone
          rows={rows}
          media={media}
          loading={loading}
          loadingMore={loadingMore}
          cursor={cursor}
          busyRow={busyRow}
          onLoadMore={loadMore}
          onToggleLike={onToggleLike}
          onChangeRating={onChangeRating}
          onOpenReviewEditor={openReviewEditor}
        />
      </div>

      {/* Review Modal */}
      {reviewModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 px-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-900">Review — {reviewModal.title}</div>
                <div className="text-xs text-zinc-600">This review is tied to this specific log entry.</div>
              </div>

              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-100"
                onClick={() => setReviewModal(newModalState())}
                disabled={reviewModal.saving}
              >
                Close
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              {reviewModal.error && (
                <div className="rounded-lg border border-red-600/30 bg-red-600/10 px-4 py-3 text-sm text-red-800">
                  {reviewModal.error}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-1">
                  <div className="mb-1 text-xs text-zinc-600">Visibility</div>
                  <select
                    className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                    value={reviewModal.visibility}
                    onChange={(e) => setReviewModal((m) => ({ ...m, visibility: e.target.value as any }))}
                    disabled={reviewModal.saving}
                  >
                    <option value="public">public</option>
                    <option value="friends">friends</option>
                    <option value="private">private</option>
                  </select>
                </div>

                <div className="sm:col-span-1">
                  <div className="mb-1 text-xs text-zinc-600">Spoilers</div>
                  <label className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800">
                    <input
                      type="checkbox"
                      checked={reviewModal.containsSpoilers}
                      onChange={(e) => setReviewModal((m) => ({ ...m, containsSpoilers: e.target.checked }))}
                      disabled={reviewModal.saving}
                    />
                    Contains spoilers
                  </label>
                </div>

                <div className="sm:col-span-1">
                  <div className="mb-1 text-xs text-zinc-600">Rating</div>
                  <div className="rounded-md border border-zinc-200 bg-white px-2 py-2">
                    <StarRating
                      value={reviewModal.rating}
                      disabled={reviewModal.saving}
                      onChange={(next) => setReviewModal((m) => ({ ...m, rating: next }))}
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-1 text-xs text-zinc-600">Author liked</div>
                <label className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800">
                  <input
                    type="checkbox"
                    checked={reviewModal.authorLiked}
                    onChange={(e) => setReviewModal((m) => ({ ...m, authorLiked: e.target.checked }))}
                    disabled={reviewModal.saving}
                  />
                  Mark as liked for this log
                </label>
              </div>

              <div>
                <div className="mb-1 text-xs text-zinc-600">Review</div>
                <textarea
                  className="min-h-[180px] w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500"
                  placeholder="Write your review…"
                  value={reviewModal.content}
                  onChange={(e) => setReviewModal((m) => ({ ...m, content: e.target.value }))}
                  disabled={reviewModal.saving}
                />
                <div className="mt-1 text-xs text-zinc-500">Review text is required (your DB schema enforces this).</div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-zinc-200 px-5 py-4">
              <button
                type="button"
                className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-100 disabled:opacity-50"
                onClick={() => setReviewModal(newModalState())}
                disabled={reviewModal.saving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-900 disabled:opacity-50"
                onClick={saveReviewFromModal}
                disabled={reviewModal.saving}
              >
                {reviewModal.saving ? "Saving…" : "Save review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------------- page wrapper (uses shared profile layout) ---------------------- */

const UsernameJournalPage: NextPage = () => {
  return (
    <ProfileLayout activeTab="journal" maxWidthClassName="max-w-6xl">
      {({ profile }) => <JournalBody profileId={profile.id} />}
    </ProfileLayout>
  );
};

export default UsernameJournalPage;
