"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import FeedShell from "@/components/FeedShell";
import ReviewIcon from "@/components/icons/ReviewIcon";
import { JournalEntryRow, listJournalEntriesByUserId } from "@/lib/journal";

type Props = {
  profileId: string;
  title?: string;
  limit?: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function roundToHalf(n: number) {
  return Math.round(n * 2) / 2;
}

function normalizeStars(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;

  const n0 = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n0)) return null;

  // >5 => assume 0..10 DB scale
  const scaled = n0 > 5 ? n0 / 2 : n0;
  return roundToHalf(clamp(scaled, 0, 5));
}

function renderStars(stars: number) {
  const s = clamp(stars, 0, 5);
  const full = Math.floor(s);
  const half = s % 1 !== 0;

  let out = "";
  for (let i = 0; i < full; i++) out += "★";
  if (half) out += "½";
  return out;
}

function entryMediaHref(row: JournalEntryRow) {
  const slug = row.media_slug?.trim();
  if (!slug) return null;

  if (row.kind.startsWith("anime_")) return `/anime/${slug}`;
  if (row.kind.startsWith("manga_")) return `/manga/${slug}`;

  return null;
}

function reviewPostHref(row: JournalEntryRow) {
  if (row.review_post_id) return `/posts/${row.review_post_id}`;
  return null;
}

export default function ProfileUserRightSidebarRecentReviews({
  profileId,
  title = "Recent Reviews",
  limit = 4,
}: Props) {
  const [rows, setRows] = useState<JournalEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canLoad = useMemo(() => !!profileId, [profileId]);

  const getStarsForRow = useCallback((r: any) => {
    const raw =
      r.stars ??
      r.rating ??
      r.review_rating ??
      r.score ??
      r.user_rating ??
      r.review_stars ??
      null;

    return normalizeStars(raw);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!canLoad) return;

      setLoading(true);
      setError(null);

      try {
        const fetchLimit = Math.max(limit * 8, 40);

        const { rows, error } = await listJournalEntriesByUserId(profileId, {
          limit: fetchLimit,
        });

        if (error) throw error;

        const onlyReviews = (rows ?? [])
          .filter((r) => !!r.review_id && !!r.review_post_id)
          .slice(0, limit);

        if (!cancelled) setRows(onlyReviews);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load recent reviews.");
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [profileId, limit, canLoad]);

  return (
    <aside className="w-full">
      <FeedShell>
        <div className="px-4 py-3.5">
          <div className="flex items-baseline justify-between">
            <div className="text-[0.95rem] font-bold">{title}</div>
          </div>

          <div className="h-2.5" />

          {loading && <div className="text-[0.9rem] text-slate-500">Loading…</div>}
          {!loading && error && <div className="text-[0.9rem] text-red-700">{error}</div>}
          {!loading && !error && rows.length === 0 && (
            <div className="text-[0.9rem] text-slate-500">No reviews yet.</div>
          )}

          {!loading && !error && rows.length > 0 && (
            <div className="grid [grid-template-columns:repeat(auto-fill,minmax(100px,1fr))] gap-x-2 gap-y-4">
              {rows.map((r) => {
                const titleText = ((r.media_title ?? "Untitled") as string).trim() || "Untitled";
                const href = reviewPostHref(r) ?? entryMediaHref(r) ?? "#";
                const stars = getStarsForRow(r);

                return (
                  <div key={r.log_id} className="block">
                    {/* Poster (no hover effects at all) */}
                    <Link href={href} title={titleText} className="block">
                      <div className="relative w-full aspect-[2/3] overflow-hidden rounded-[4px] bg-slate-200 border-2 border-black">
                        {r.poster_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.poster_url}
                            alt={titleText}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-[10px] text-slate-500">No poster</span>
                          </div>
                        )}
                      </div>
                    </Link>

                    {/* Stars row (static) */}
                    <div className="mt-0 flex items-center justify-between">
                      <div className="min-h-[12px] leading-none">
                        {typeof stars === "number" && stars > 0 ? (
                          <span className="text-[14px] text-slate-1000 tracking-tight leading-none">
                            {renderStars(stars)}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {href && href !== "#" ? (
                          <Link
                            href={href}
                            className="text-slate-600 hover:text-slate-900"
                            aria-label="Review"
                          >
                            <ReviewIcon size={12} />
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </FeedShell>
    </aside>
  );
}