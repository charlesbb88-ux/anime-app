"use client";

import Link from "next/link";
import SmartBackdropImage from "@/components/SmartBackdropImage";
import { FALLBACK_BACKDROP_SRC } from "@/lib/fallbacks";

const CARD_CLASS = "bg-black p-4 text-neutral-100";

function postHref(postId: string) {
  return `/posts/${postId}`;
}

type Visibility = "public" | "friends" | "private";

type ActivityItem =
  | {
      id: string;
      kind: "log";
      type: "anime_episode";
      title: string;
      subLabel?: string;
      rating: number | null;
      note: null;
      logged_at: string;
      visibility: Visibility;
      liked?: boolean | null;
      review_id?: string | null;
    }
  | {
      id: string;
      kind: "review";
      type: "anime_episode_review";
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

/* -------------------- Dates -------------------- */

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

/* -------------------- Half-star visuals -------------------- */

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

// Convert 0..100 to half-stars 1..10
function rating100ToHalfStars(rating: number | null): number | null {
  if (typeof rating !== "number" || !Number.isFinite(rating)) return null;
  const clamped = clampInt(rating, 0, 100);
  if (clamped <= 0) return null;
  return clampInt(Math.round(clamped / 10), 1, 10);
}

function joinWithCommasAnd(parts: string[]) {
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function actionWord(a: "reviewed" | "liked" | "watched" | "rated") {
  if (a === "rated") return "rated";
  if (a === "reviewed") return "reviewed";
  if (a === "liked") return "liked";
  return "watched";
}

function buildSnapshotPrefix(actions: Array<"reviewed" | "liked" | "watched" | "rated">) {
  return `You ${joinWithCommasAnd(actions.map(actionWord))}`;
}

type Props = {
  animeId: string;
  posterUrl: string | null;
  pageTitle: string;
  subLabel?: string;

  items: ActivityItem[];
  error: string | null;

  episodeHref: string;
  reviewIdToPostId: Record<string, string>;

  backdropUrl?: string | null; // ✅ add
  overlaySrc?: string | null; // ✅ add (optional)
};

export default function AnimeEpisodeActivityPhoneLayout(props: Props) {
  const { animeId, posterUrl, pageTitle, subLabel, items, error, episodeHref, reviewIdToPostId } =
    props;

  // phone header: small "Your activity" label + cleaned main title
  const headerTitle = pageTitle.replace(/^your activity\s*[-–—:·]\s*/i, "").trim();

  return (
    <div className="min-h-screen bg-transparent">
      {animeId ? (
        <div className="relative w-screen">
          {/* backdrop behind everything */}
          <div className="absolute inset-x-0 top-0 z-0">
            <div className="relative w-full overflow-hidden h-[520px] -mt-10">
              <style jsx>{`
                .episode-image-frame {
                  position: absolute;
                  left: 0;
                  width: 100%;
                  height: 100%;
                  overflow: hidden;
                  z-index: 0;
                  top: 0;
                }

                /* 👇 CHANGE THESE TWO VALUES TO TEST (PHONE ONLY) */
                @media (max-width: 767px) {
                  .episode-image-frame {
                    height: 70%; /* (A) visible image area */
                    top: 40px; /* (B) move image DOWN */
                  }
                }
              `}</style>

              {/* ✅ IMAGE ONLY (wrapped). Overlay stays full height. */}
              <div className="episode-image-frame">
                <SmartBackdropImage
                  src={props.backdropUrl ?? null}
                  posterFallbackSrc={posterUrl}
                  finalFallbackSrc={FALLBACK_BACKDROP_SRC}
                  alt=""
                  width={1920}
                  height={1080}
                  priority
                  sizes="100vw"
                  className="h-full w-full object-cover object-bottom"
                  posterFallbackObjectPosition="50% 45%"
                  finalFallbackObjectPosition="50% 13%"
                />
              </div>

              {/* ✅ OVERLAY stays full height and does NOT move */}
              {(props.overlaySrc ?? "/overlays/my-overlay4.png") ? (
                <img
                  src={(props.overlaySrc ?? "/overlays/my-overlay4.png") as string}
                  alt=""
                  className="pointer-events-none absolute inset-0 z-10 h-full w-full object-cover"
                />
              ) : null}
            </div>

            <div className="pointer-events-none -mt-28 h-28 bg-gradient-to-b from-transparent to-black/95" />
          </div>

          {/* reserve height */}
          <div className="h-[520px]" />

          {/* header row */}
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
                <div className="text-[12px] font-semibold uppercase tracking-wide text-black/70">
                  Your activity
                </div>

                <div className="mt-1 text-[18px] font-semibold leading-snug whitespace-normal break-words text-black">
                  {headerTitle}
                </div>

                {subLabel ? (
                  <div className="mt-1 text-[12px] font-medium text-black/60">{subLabel}</div>
                ) : null}
              </div>
            </div>
          </div>

          {/* content */}
          <div className="relative z-20 px-4 pb-8 pt-4">
            {error ? (
              <div className="text-sm text-red-300">{error}</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-neutral-500">No activity yet.</div>
            ) : (
              <ul className="space-y-1">
                {items.map((item) => {
                  // MARKS
                  if (item.kind === "mark" && item.type === "watched") {
                    return (
                      <li key={`watched-${item.id}`} className={CARD_CLASS}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm font-medium">
                            You marked <span className="font-bold text-white">{item.title}</span>{" "}
                            as watched
                            {item.subLabel ? (
                              <span className="ml-2 text-neutral-400">· {item.subLabel}</span>
                            ) : null}
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
                            You liked <span className="font-bold text-white">{item.title}</span>
                            {item.subLabel ? (
                              <span className="ml-2 text-neutral-400">· {item.subLabel}</span>
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
                            You added <span className="font-bold text-white">{item.title}</span>{" "}
                            to your watchlist
                            {item.subLabel ? (
                              <span className="ml-2 text-neutral-400">· {item.subLabel}</span>
                            ) : null}
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
                            You rated <span className="font-bold text-white">{item.title}</span>
                            {item.subLabel ? (
                              <span className="ml-2 text-neutral-400">· {item.subLabel}</span>
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

                  // REVIEW
                  if (item.kind === "review") {
                    const postId = reviewIdToPostId[String(item.id)];

                    return (
                      <li key={`review-${item.id}`} className={CARD_CLASS}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm font-medium">
                            {postId ? (
                              <Link href={postHref(postId)} className="inline hover:underline">
                                You reviewed{" "}
                                <span className="font-bold text-white">{item.title}</span>
                                {item.subLabel ? (
                                  <span className="ml-2 text-neutral-400">· {item.subLabel}</span>
                                ) : null}
                              </Link>
                            ) : (
                              <>
                                You reviewed{" "}
                                <span className="font-bold text-white">{item.title}</span>
                                {item.subLabel ? (
                                  <span className="ml-2 text-neutral-400">· {item.subLabel}</span>
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

                  // LOG (snapshot style)
                  if (item.kind === "log" && item.type === "anime_episode") {
                    const actions: Array<"watched" | "liked" | "rated" | "reviewed"> = [];

                    actions.push("watched");
                    if (item.liked) actions.push("liked");

                    const hs = rating100ToHalfStars(item.rating);
                    if (hs !== null) actions.push("rated");

                    if (item.review_id) actions.push("reviewed");

                    const prefix = buildSnapshotPrefix(actions);

                    const postId = item.review_id
                      ? reviewIdToPostId[String(item.review_id)]
                      : undefined;

                    return (
                      <li key={`episode-log-${item.id}`} className={CARD_CLASS}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm font-medium">
                            {postId ? (
                              <Link href={postHref(postId)} className="inline hover:underline">
                                {prefix}{" "}
                                <span className="font-bold text-white">{item.title}</span>
                                {item.subLabel ? (
                                  <span className="ml-2 text-neutral-400">· {item.subLabel}</span>
                                ) : null}
                                {hs !== null ? <HalfStarsRow halfStars={hs} /> : null}
                                <span className="ml-1"> on {formatOnFullDate(item.logged_at)}</span>
                              </Link>
                            ) : (
                              <>
                                {prefix}{" "}
                                <span className="font-bold text-white">{item.title}</span>
                                {item.subLabel ? (
                                  <span className="ml-2 text-neutral-400">· {item.subLabel}</span>
                                ) : null}
                                {hs !== null ? <HalfStarsRow halfStars={hs} /> : null}
                                <span className="ml-1"> on {formatOnFullDate(item.logged_at)}</span>
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

            <div className="mt-4">
              <Link href={episodeHref} className="text-sm text-neutral-300 hover:underline">
                ← Back
              </Link>
            </div>
          </div>
        </div>
      ) : (
        // fallback if animeId not ready yet
        <div className="px-4 pb-8 pt-4">
          <div className="flex items-end gap-3">
            {posterUrl ? (
              <img
                src={posterUrl}
                alt=""
                className="h-[92px] w-[64px] rounded-md object-cover ring-2 ring-black/80"
              />
            ) : null}

            <div className="min-w-0 pb-1">
              <div className="truncate text-lg font-semibold text-white">{headerTitle}</div>
              {subLabel ? (
                <div className="mt-1 text-xs font-medium text-neutral-300">{subLabel}</div>
              ) : null}
            </div>
          </div>

          {/* content block reuses the same list UI */}
          <div className="pt-4">
            {error ? (
              <div className="text-sm text-red-300">{error}</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-neutral-500">No activity yet.</div>
            ) : (
              <ul className="space-y-1">
                {/* You can keep the same items.map block here too if you want parity,
                    but usually animeId will be ready so this fallback is rarely seen. */}
                {items.map(() => null)}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}