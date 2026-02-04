"use client";

import Link from "next/link";

import MangaSeriesHeaderBackdrop from "@/components/overlays/MangaSeriesHeaderBackdrop";

const CARD_CLASS = "bg-black p-4 text-neutral-100";

function postHref(postId: string) {
  return `/posts/${postId}`;
}

type Visibility = "public" | "friends" | "private";

type ActivityItem =
  | {
      id: string;
      kind: "log";
      type: "manga_series";
      title: string;

      rating: number | null;
      note: string | null;
      logged_at: string;
      visibility: Visibility;

      liked?: boolean | null;
      review_id?: string | null;
    }
  | {
      id: string;
      kind: "log";
      type: "manga_chapter";
      title: string;
      subLabel?: string;

      rating: number | null;
      note: string | null;
      logged_at: string;
      visibility: Visibility;

      liked?: boolean | null;
      review_id?: string | null;
    }
  | {
      id: string;
      kind: "review";
      type: "manga_series_review";
      title: string;

      logged_at: string;
      rating: number | null;
      content: string | null;
      contains_spoilers: boolean;
    }
  | {
      id: string;
      kind: "review";
      type: "manga_chapter_review";
      title: string;
      subLabel?: string;

      logged_at: string;
      rating: number | null;
      content: string | null;
      contains_spoilers: boolean;
    }
  | {
      id: string;
      kind: "mark";
      type: "watched" | "liked" | "watchlist" | "rating";
      title: string;
      subLabel?: string;

      logged_at: string;
      stars?: number | null;
    };

function formatRelativeShort(iso: string) {
  const d = new Date(iso);
  const now = new Date();

  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay < 30) return `${diffDay}d`;

  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function formatOnFullDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function computeStarFillPercent(halfStars: number, starIndex: number) {
  const starHalfStart = (starIndex - 1) * 2;
  const remaining = halfStars - starHalfStart;

  if (remaining >= 2) return 100 as const;
  if (remaining === 1) return 50 as const;
  return 0 as const;
}

function StarVisual({ filledPercent }: { filledPercent: 0 | 50 | 100 }) {
  return (
    <span className="relative inline-block">
      <span className="text-[18px] leading-none text-gray-600">★</span>

      {filledPercent > 0 && (
        <span
          className="pointer-events-none absolute left-0 top-0 overflow-hidden text-[18px] leading-none text-emerald-400"
          style={{ width: `${filledPercent}%` }}
        >
          ★
        </span>
      )}
    </span>
  );
}

function HalfStarsRow({ halfStars }: { halfStars: number }) {
  const hs = clampInt(halfStars, 0, 10);

  return (
    <span className="ml-2 inline-flex items-center gap-[2px] align-middle">
      {Array.from({ length: 5 }).map((_, i) => {
        const starIndex = i + 1;
        const fill = computeStarFillPercent(hs, starIndex);
        return <StarVisual key={starIndex} filledPercent={fill} />;
      })}
    </span>
  );
}

function rating100ToHalfStars(rating: number | null): number | null {
  if (typeof rating !== "number" || !Number.isFinite(rating)) return null;
  const clamped = clampInt(rating, 0, 100);
  if (clamped <= 0) return null;
  return clampInt(Math.round(clamped / 10), 1, 10);
}

function ratingToHalfStarsFlexible(rating: number | null): number | null {
  if (typeof rating !== "number" || !Number.isFinite(rating)) return null;
  if (rating <= 0) return null;

  if (rating <= 10) return clampInt(rating, 1, 10);
  return rating100ToHalfStars(rating);
}

function joinWithCommasAnd(parts: string[]) {
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function actionWordSeries(a: "reviewed" | "liked" | "watched" | "rated") {
  if (a === "rated") return "rated";
  if (a === "reviewed") return "reviewed";
  if (a === "liked") return "liked";
  return "watched";
}

function buildSnapshotPrefixSeries(
  actions: Array<"reviewed" | "liked" | "watched" | "rated">
) {
  return `You ${joinWithCommasAnd(actions.map(actionWordSeries))}`;
}

function actionWordChapter(a: "reviewed" | "liked" | "read" | "rated") {
  if (a === "rated") return "rated";
  if (a === "reviewed") return "reviewed";
  if (a === "liked") return "liked";
  return "read";
}

function buildSnapshotPrefixChapter(
  actions: Array<"reviewed" | "liked" | "read" | "rated">
) {
  return `You ${joinWithCommasAnd(actions.map(actionWordChapter))}`;
}

type Props = {
  mangaId: string; // ✅ needed for MangaSeriesHeaderBackdrop
  posterUrl: string | null;
  pageTitle: string;

  items: ActivityItem[];
  error: string | null;

  feedLimit: number;
  loadingMore: boolean;
  onLoadMore: () => void;

  slugHref: string;

  reviewIdToPostId: Record<string, string>;
};

export default function MangaActivityPhoneLayout(props: Props) {
  const {
    mangaId,
    posterUrl,
    pageTitle,
    items,
    error,
    feedLimit,
    loadingMore,
    onLoadMore,
    slugHref,
    reviewIdToPostId,
  } = props;

  return (
    <div className="min-h-screen bg-transparent">
      {/* BACKDROP lives behind everything */}
      {mangaId ? (
        <div className="relative w-screen">
          {/* ensure backdrop is always behind */}
          <div className="absolute inset-x-0 top-0 z-0">
            <MangaSeriesHeaderBackdrop
              mangaId={mangaId}
              overlaySrc="/overlays/my-overlay4.png"
              backdropHeightClassName="h-[520px]"
            />

            {/* soft fade into content */}
            <div className="pointer-events-none -mt-28 h-28 bg-gradient-to-b from-transparent to-black/95" />
          </div>

          {/* spacer to reserve the same vertical space as the backdrop */}
          <div className="h-[520px]" />

          {/* header row (must be above backdrop) */}
          <div className="relative z-20 -mt-[180px] px-4">
            <div className="flex items-end gap-3">
              {posterUrl ? (
                <img
                  src={posterUrl}
                  alt=""
                  className="h-[92px] w-[64px] rounded-md object-cover ring-2 ring-black/80"
                />
              ) : null}

              <div className="min-w-0 pb-1">
                {/* KEEP this row label */}
                <div className="text-[12px] font-semibold uppercase tracking-wide text-black/70">
                  Your activity
                </div>

                {/* REMOVE the "your activity -" prefix + remove the hover dot by NOT rendering any separator here */}
                <div className="mt-1 text-[18px] font-semibold leading-snug whitespace-normal break-words text-black">
                  {pageTitle.replace(/^your activity\s*[-–—:·]\s*/i, "").trim()}
                </div>
              </div>
            </div>
          </div>

          {/* content (also above backdrop) */}
          <div className="relative z-20 px-4 pb-8 pt-4">
            {error ? (
              <div className="text-sm text-red-300">{error}</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-neutral-500">No activity yet.</div>
            ) : (
              <ul className="space-y-1">
                {items.map((item) => {
                  if (item.kind === "log" && item.type === "manga_series") {
                    const actions: Array<
                      "watched" | "liked" | "rated" | "reviewed"
                    > = [];
                    actions.push("watched");
                    if (item.liked) actions.push("liked");

                    const hs = ratingToHalfStarsFlexible(item.rating);
                    if (hs !== null) actions.push("rated");
                    if (item.review_id) actions.push("reviewed");

                    const prefix = buildSnapshotPrefixSeries(actions);

                    const postId = item.review_id
                      ? reviewIdToPostId[String(item.review_id)]
                      : undefined;

                    return (
                      <li key={`series-snap-${item.id}`} className={CARD_CLASS}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm font-medium">
                            {postId ? (
                              <Link
                                href={postHref(postId)}
                                className="inline hover:underline"
                              >
                                {prefix}{" "}
                                <span className="font-bold text-white">
                                  {item.title}
                                </span>
                                {hs !== null ? (
                                  <HalfStarsRow halfStars={hs} />
                                ) : null}
                                <span className="ml-1">
                                  {" "}
                                  on {formatOnFullDate(item.logged_at)}
                                </span>
                              </Link>
                            ) : (
                              <>
                                {prefix}{" "}
                                <span className="font-bold text-white">
                                  {item.title}
                                </span>
                                {hs !== null ? (
                                  <HalfStarsRow halfStars={hs} />
                                ) : null}
                                <span className="ml-1">
                                  {" "}
                                  on {formatOnFullDate(item.logged_at)}
                                </span>
                              </>
                            )}
                          </div>

                          <div className="whitespace-nowrap text-xs text-neutral-100">
                            {formatRelativeShort(item.logged_at)}
                          </div>
                        </div>
                      </li>
                    );
                  }

                  if (item.kind === "log" && item.type === "manga_chapter") {
                    const actions: Array<
                      "read" | "liked" | "rated" | "reviewed"
                    > = [];
                    actions.push("read");
                    if (item.liked) actions.push("liked");

                    const hs = ratingToHalfStarsFlexible(item.rating);
                    if (hs !== null) actions.push("rated");
                    if (item.review_id) actions.push("reviewed");

                    const prefix = buildSnapshotPrefixChapter(actions);

                    const postId = item.review_id
                      ? reviewIdToPostId[String(item.review_id)]
                      : undefined;

                    return (
                      <li key={`chapter-snap-${item.id}`} className={CARD_CLASS}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm font-medium">
                            {postId ? (
                              <Link
                                href={postHref(postId)}
                                className="inline hover:underline"
                              >
                                {prefix}{" "}
                                <span className="font-bold text-white">
                                  {item.title}
                                </span>
                                {item.subLabel ? (
                                  <span className="ml-1 text-neutral-300">
                                    · {item.subLabel}
                                  </span>
                                ) : null}
                                {hs !== null ? (
                                  <HalfStarsRow halfStars={hs} />
                                ) : null}
                                <span className="ml-1">
                                  {" "}
                                  on {formatOnFullDate(item.logged_at)}
                                </span>
                              </Link>
                            ) : (
                              <>
                                {prefix}{" "}
                                <span className="font-bold text-white">
                                  {item.title}
                                </span>
                                {item.subLabel ? (
                                  <span className="ml-1 text-neutral-300">
                                    · {item.subLabel}
                                  </span>
                                ) : null}
                                {hs !== null ? (
                                  <HalfStarsRow halfStars={hs} />
                                ) : null}
                                <span className="ml-1">
                                  {" "}
                                  on {formatOnFullDate(item.logged_at)}
                                </span>
                              </>
                            )}
                          </div>

                          <div className="whitespace-nowrap text-xs text-neutral-100">
                            {formatRelativeShort(item.logged_at)}
                          </div>
                        </div>
                      </li>
                    );
                  }

                  if (item.kind === "mark" && item.type === "watched") {
                    return (
                      <li key={`watched-${item.id}`} className={CARD_CLASS}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm font-medium">
                            You marked{" "}
                            <span className="font-bold text-white">
                              {item.title}
                            </span>
                            {item.subLabel ? (
                              <span className="ml-1 text-neutral-300">
                                · {item.subLabel}
                              </span>
                            ) : null}{" "}
                            as {item.subLabel ? "read" : "watched"}
                          </div>
                          <div className="whitespace-nowrap text-xs text-neutral-100">
                            {formatRelativeShort(item.logged_at)}
                          </div>
                        </div>
                      </li>
                    );
                  }

                  if (item.kind === "mark" && item.type === "liked") {
                    return (
                      <li key={`liked-${item.id}`} className={CARD_CLASS}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm font-medium">
                            You liked{" "}
                            <span className="font-bold text-white">
                              {item.title}
                            </span>
                            {item.subLabel ? (
                              <span className="ml-1 text-neutral-300">
                                · {item.subLabel}
                              </span>
                            ) : null}
                          </div>
                          <div className="whitespace-nowrap text-xs text-neutral-100">
                            {formatRelativeShort(item.logged_at)}
                          </div>
                        </div>
                      </li>
                    );
                  }

                  if (item.kind === "mark" && item.type === "watchlist") {
                    return (
                      <li key={`watchlist-${item.id}`} className={CARD_CLASS}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm font-medium">
                            You added{" "}
                            <span className="font-bold text-white">
                              {item.title}
                            </span>
                            {item.subLabel ? (
                              <span className="ml-1 text-neutral-300">
                                · {item.subLabel}
                              </span>
                            ) : null}{" "}
                            to your watchlist
                          </div>
                          <div className="whitespace-nowrap text-xs text-neutral-100">
                            {formatRelativeShort(item.logged_at)}
                          </div>
                        </div>
                      </li>
                    );
                  }

                  if (item.kind === "mark" && item.type === "rating") {
                    const hs = clampInt(Number(item.stars ?? 0), 0, 10);

                    return (
                      <li key={`rating-${item.id}`} className={CARD_CLASS}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm font-medium">
                            You rated{" "}
                            <span className="font-bold text-white">
                              {item.title}
                            </span>
                            {item.subLabel ? (
                              <span className="ml-1 text-neutral-300">
                                · {item.subLabel}
                              </span>
                            ) : null}
                            {hs > 0 ? <HalfStarsRow halfStars={hs} /> : null}
                          </div>
                          <div className="whitespace-nowrap text-xs text-neutral-100">
                            {formatRelativeShort(item.logged_at)}
                          </div>
                        </div>
                      </li>
                    );
                  }

                  if (item.kind === "review") {
                    const postId = reviewIdToPostId[String(item.id)];

                    return (
                      <li key={`review-${item.id}`} className={CARD_CLASS}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm font-medium">
                            {postId ? (
                              <Link
                                href={postHref(postId)}
                                className="inline hover:underline"
                              >
                                You reviewed{" "}
                                <span className="font-bold text-white">
                                  {item.title}
                                </span>
                                {"subLabel" in item && item.subLabel ? (
                                  <span className="ml-1 text-neutral-300">
                                    · {item.subLabel}
                                  </span>
                                ) : null}
                              </Link>
                            ) : (
                              <>
                                You reviewed{" "}
                                <span className="font-bold text-white">
                                  {item.title}
                                </span>
                                {"subLabel" in item && item.subLabel ? (
                                  <span className="ml-1 text-neutral-300">
                                    · {item.subLabel}
                                  </span>
                                ) : null}
                              </>
                            )}
                          </div>
                          <div className="whitespace-nowrap text-xs text-neutral-100">
                            {formatRelativeShort(item.logged_at)}
                          </div>
                        </div>
                      </li>
                    );
                  }

                  return null;
                })}
              </ul>
            )}

            {!error && items.length >= feedLimit ? (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={onLoadMore}
                  className="inline-flex rounded bg-black px-3 py-2 text-sm text-neutral-100 hover:bg-neutral-700 disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            ) : null}

            <div className="mt-4">
              <Link
                href={slugHref}
                className="text-sm text-neutral-300 hover:underline"
              >
                ← Back
              </Link>
            </div>
          </div>
        </div>
      ) : (
        // no mangaId: keep the old structure, but still ensure header/content are above anything
        <div className="relative z-10">
          <div className="px-4 pt-4">
            <div className="flex items-end gap-3">
              {posterUrl ? (
                <img
                  src={posterUrl}
                  alt=""
                  className="h-[92px] w-[64px] rounded-md object-cover ring-2 ring-black/80"
                />
              ) : null}

              <div className="min-w-0 pb-1">
                <div className="truncate text-lg font-semibold text-white">
                  {pageTitle.replace(/^your activity\s*[-–—:·]\s*/i, "").trim()}
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 pb-8 pt-4">
            {error ? (
              <div className="text-sm text-red-300">{error}</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-neutral-500">No activity yet.</div>
            ) : (
              <ul className="space-y-1">
                {items.map((item) => {
                  if (item.kind === "log" && item.type === "manga_series") {
                    const actions: Array<
                      "watched" | "liked" | "rated" | "reviewed"
                    > = [];
                    actions.push("watched");
                    if (item.liked) actions.push("liked");

                    const hs = ratingToHalfStarsFlexible(item.rating);
                    if (hs !== null) actions.push("rated");
                    if (item.review_id) actions.push("reviewed");

                    const prefix = buildSnapshotPrefixSeries(actions);

                    const postId = item.review_id
                      ? reviewIdToPostId[String(item.review_id)]
                      : undefined;

                    return (
                      <li key={`series-snap-${item.id}`} className={CARD_CLASS}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm font-medium">
                            {postId ? (
                              <Link
                                href={postHref(postId)}
                                className="inline hover:underline"
                              >
                                {prefix}{" "}
                                <span className="font-bold text-white">
                                  {item.title}
                                </span>
                                {hs !== null ? (
                                  <HalfStarsRow halfStars={hs} />
                                ) : null}
                                <span className="ml-1">
                                  {" "}
                                  on {formatOnFullDate(item.logged_at)}
                                </span>
                              </Link>
                            ) : (
                              <>
                                {prefix}{" "}
                                <span className="font-bold text-white">
                                  {item.title}
                                </span>
                                {hs !== null ? (
                                  <HalfStarsRow halfStars={hs} />
                                ) : null}
                                <span className="ml-1">
                                  {" "}
                                  on {formatOnFullDate(item.logged_at)}
                                </span>
                              </>
                            )}
                          </div>

                          <div className="whitespace-nowrap text-xs text-neutral-100">
                            {formatRelativeShort(item.logged_at)}
                          </div>
                        </div>
                      </li>
                    );
                  }

                  if (item.kind === "log" && item.type === "manga_chapter") {
                    const actions: Array<
                      "read" | "liked" | "rated" | "reviewed"
                    > = [];
                    actions.push("read");
                    if (item.liked) actions.push("liked");

                    const hs = ratingToHalfStarsFlexible(item.rating);
                    if (hs !== null) actions.push("rated");
                    if (item.review_id) actions.push("reviewed");

                    const prefix = buildSnapshotPrefixChapter(actions);

                    const postId = item.review_id
                      ? reviewIdToPostId[String(item.review_id)]
                      : undefined;

                    return (
                      <li key={`chapter-snap-${item.id}`} className={CARD_CLASS}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm font-medium">
                            {postId ? (
                              <Link
                                href={postHref(postId)}
                                className="inline hover:underline"
                              >
                                {prefix}{" "}
                                <span className="font-bold text-white">
                                  {item.title}
                                </span>
                                {item.subLabel ? (
                                  <span className="ml-1 text-neutral-300">
                                    · {item.subLabel}
                                  </span>
                                ) : null}
                                {hs !== null ? (
                                  <HalfStarsRow halfStars={hs} />
                                ) : null}
                                <span className="ml-1">
                                  {" "}
                                  on {formatOnFullDate(item.logged_at)}
                                </span>
                              </Link>
                            ) : (
                              <>
                                {prefix}{" "}
                                <span className="font-bold text-white">
                                  {item.title}
                                </span>
                                {item.subLabel ? (
                                  <span className="ml-1 text-neutral-300">
                                    · {item.subLabel}
                                  </span>
                                ) : null}
                                {hs !== null ? (
                                  <HalfStarsRow halfStars={hs} />
                                ) : null}
                                <span className="ml-1">
                                  {" "}
                                  on {formatOnFullDate(item.logged_at)}
                                </span>
                              </>
                            )}
                          </div>

                          <div className="whitespace-nowrap text-xs text-neutral-100">
                            {formatRelativeShort(item.logged_at)}
                          </div>
                        </div>
                      </li>
                    );
                  }

                  if (item.kind === "mark" && item.type === "watched") {
                    return (
                      <li key={`watched-${item.id}`} className={CARD_CLASS}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm font-medium">
                            You marked{" "}
                            <span className="font-bold text-white">
                              {item.title}
                            </span>
                            {item.subLabel ? (
                              <span className="ml-1 text-neutral-300">
                                · {item.subLabel}
                              </span>
                            ) : null}{" "}
                            as {item.subLabel ? "read" : "watched"}
                          </div>
                          <div className="whitespace-nowrap text-xs text-neutral-100">
                            {formatRelativeShort(item.logged_at)}
                          </div>
                        </div>
                      </li>
                    );
                  }

                  if (item.kind === "mark" && item.type === "liked") {
                    return (
                      <li key={`liked-${item.id}`} className={CARD_CLASS}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm font-medium">
                            You liked{" "}
                            <span className="font-bold text-white">
                              {item.title}
                            </span>
                            {item.subLabel ? (
                              <span className="ml-1 text-neutral-300">
                                · {item.subLabel}
                              </span>
                            ) : null}
                          </div>
                          <div className="whitespace-nowrap text-xs text-neutral-100">
                            {formatRelativeShort(item.logged_at)}
                          </div>
                        </div>
                      </li>
                    );
                  }

                  if (item.kind === "mark" && item.type === "watchlist") {
                    return (
                      <li key={`watchlist-${item.id}`} className={CARD_CLASS}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm font-medium">
                            You added{" "}
                            <span className="font-bold text-white">
                              {item.title}
                            </span>
                            {item.subLabel ? (
                              <span className="ml-1 text-neutral-300">
                                · {item.subLabel}
                              </span>
                            ) : null}{" "}
                            to your watchlist
                          </div>
                          <div className="whitespace-nowrap text-xs text-neutral-100">
                            {formatRelativeShort(item.logged_at)}
                          </div>
                        </div>
                      </li>
                    );
                  }

                  if (item.kind === "mark" && item.type === "rating") {
                    const hs = clampInt(Number(item.stars ?? 0), 0, 10);

                    return (
                      <li key={`rating-${item.id}`} className={CARD_CLASS}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm font-medium">
                            You rated{" "}
                            <span className="font-bold text-white">
                              {item.title}
                            </span>
                            {item.subLabel ? (
                              <span className="ml-1 text-neutral-300">
                                · {item.subLabel}
                              </span>
                            ) : null}
                            {hs > 0 ? <HalfStarsRow halfStars={hs} /> : null}
                          </div>
                          <div className="whitespace-nowrap text-xs text-neutral-100">
                            {formatRelativeShort(item.logged_at)}
                          </div>
                        </div>
                      </li>
                    );
                  }

                  if (item.kind === "review") {
                    const postId = reviewIdToPostId[String(item.id)];

                    return (
                      <li key={`review-${item.id}`} className={CARD_CLASS}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm font-medium">
                            {postId ? (
                              <Link
                                href={postHref(postId)}
                                className="inline hover:underline"
                              >
                                You reviewed{" "}
                                <span className="font-bold text-white">
                                  {item.title}
                                </span>
                                {"subLabel" in item && item.subLabel ? (
                                  <span className="ml-1 text-neutral-300">
                                    · {item.subLabel}
                                  </span>
                                ) : null}
                              </Link>
                            ) : (
                              <>
                                You reviewed{" "}
                                <span className="font-bold text-white">
                                  {item.title}
                                </span>
                                {"subLabel" in item && item.subLabel ? (
                                  <span className="ml-1 text-neutral-300">
                                    · {item.subLabel}
                                  </span>
                                ) : null}
                              </>
                            )}
                          </div>
                          <div className="whitespace-nowrap text-xs text-neutral-100">
                            {formatRelativeShort(item.logged_at)}
                          </div>
                        </div>
                      </li>
                    );
                  }

                  return null;
                })}
              </ul>
            )}

            {!error && items.length >= feedLimit ? (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={onLoadMore}
                  className="inline-flex rounded bg-black px-3 py-2 text-sm text-neutral-100 hover:bg-neutral-700 disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            ) : null}

            <div className="mt-4">
              <Link
                href={slugHref}
                className="text-sm text-neutral-300 hover:underline"
              >
                ← Back
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
