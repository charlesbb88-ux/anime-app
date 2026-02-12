"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import ProfileLayout from "../../components/profile/ProfileLayout";
import ReviewIcon from "@/components/icons/ReviewIcon";
import ProfileLibraryPhone from "@/components/profile/phone/ProfileLibraryPhone";
import { supabase } from "../../lib/supabaseClient";

type LibraryRow = {
  user_id: string;
  kind: "anime" | "manga";
  media_id: string;

  slug: string | null;
  title: string | null;
  title_english: string | null;
  image_url: string | null;

  liked: boolean;
  stars: number | null; // 0..10 in DB

  reviewed: boolean;
  review_post_id: string | null;

  marked_at: string | null;
};

type LibraryItem = {
  kind: "anime" | "manga";
  id: string;
  slug: string | null;
  posterUrl: string | null;
  title: string;

  stars: number | null; // 0..5 normalized for UI
  liked: boolean;

  reviewed: boolean;
  reviewPostId: string | null;

  markedAt: string | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function roundToHalf(n: number) {
  return Math.round(n * 2) / 2;
}

function normalizeStarsFromDb(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;

  const n0 = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n0)) return null;

  // DB stars are 0..10 (half-star steps). Convert to 0..5.
  const scaled = n0 / 2;
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

const PAGE_SIZE = 180;

function LibraryBody({ profileId }: { profileId: string }) {
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // keyset cursor
  const cursor = useMemo(() => {
    const last = items[items.length - 1];
    if (!last) return null;
    return {
      markedAt: last.markedAt ?? null,
      kind: last.kind,
      id: last.id,
    };
  }, [items]);

  function itemHref(it: LibraryItem) {
    if (!it.slug) return "#";
    return it.kind === "anime" ? `/anime/${it.slug}` : `/manga/${it.slug}`;
  }

  const mapRow = useCallback((r: LibraryRow): LibraryItem | null => {
    const title = ((r.title_english || r.title || "") as string).trim() || "Untitled";

    return {
      kind: r.kind,
      id: r.media_id,
      slug: r.slug ?? null,
      posterUrl: r.image_url ?? null,
      title,

      stars: normalizeStarsFromDb(r.stars),
      liked: !!r.liked,

      reviewed: !!r.reviewed,
      reviewPostId: r.review_post_id ?? null,

      markedAt: r.marked_at ?? null,
    };
  }, []);

  useEffect(() => {
    if (!profileId) return;

    let cancelled = false;

    async function loadFirst() {
      setLoadingLibrary(true);
      setLoadingMore(false);
      setHasMore(true);

      try {
        const { data, error } = await supabase
          .from("user_library_items")
          .select(
            "user_id, kind, media_id, slug, title, title_english, image_url, liked, stars, reviewed, review_post_id, marked_at"
          )
          .eq("user_id", profileId)
          .order("marked_at", { ascending: false, nullsFirst: false })
          .order("kind", { ascending: true })
          .order("media_id", { ascending: true })
          .limit(PAGE_SIZE);

        if (cancelled) return;

        if (error) {
          setItems([]);
          setHasMore(false);
          return;
        }

        const mapped: LibraryItem[] = [];
        for (const r of (data || []) as LibraryRow[]) {
          const it = mapRow(r);
          if (it) mapped.push(it);
        }

        setItems(mapped);
        setHasMore(mapped.length === PAGE_SIZE);
      } finally {
        if (!cancelled) setLoadingLibrary(false);
      }
    }

    loadFirst();
    return () => {
      cancelled = true;
    };
  }, [profileId, mapRow]);

  const loadMore = useCallback(async () => {
    if (!profileId || loadingLibrary || loadingMore || !hasMore) return;
    if (!cursor || !cursor.markedAt) {
      setHasMore(false);
      return;
    }

    setLoadingMore(true);
    try {
      // Keyset pagination:
      // fetch rows strictly "after" the last row in our ordering
      //
      // ordering is:
      // marked_at desc, kind asc, media_id asc
      //
      // so "after" means:
      // marked_at < cursor.markedAt
      // OR (marked_at = cursor.markedAt AND kind > cursor.kind)
      // OR (marked_at = cursor.markedAt AND kind = cursor.kind AND media_id > cursor.id)

      const { data, error } = await supabase
        .from("user_library_items")
        .select(
          "user_id, kind, media_id, slug, title, title_english, image_url, liked, stars, reviewed, review_post_id, marked_at"
        )
        .eq("user_id", profileId)
        .or(
          [
            `marked_at.lt.${cursor.markedAt}`,
            `and(marked_at.eq.${cursor.markedAt},kind.gt.${cursor.kind})`,
            `and(marked_at.eq.${cursor.markedAt},kind.eq.${cursor.kind},media_id.gt.${cursor.id})`,
          ].join(",")
        )
        .order("marked_at", { ascending: false, nullsFirst: false })
        .order("kind", { ascending: true })
        .order("media_id", { ascending: true })
        .limit(PAGE_SIZE);

      if (error) return;

      const mapped: LibraryItem[] = [];
      for (const r of (data || []) as LibraryRow[]) {
        const it = mapRow(r);
        if (it) mapped.push(it);
      }

      setItems((prev) => {
        const seen = new Set(prev.map((x) => `${x.kind}:${x.id}`));
        const out = [...prev];
        for (const it of mapped) {
          const key = `${it.kind}:${it.id}`;
          if (!seen.has(key)) out.push(it);
        }
        return out;
      });

      setHasMore(mapped.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [profileId, loadingLibrary, loadingMore, hasMore, cursor, mapRow]);

  return (
    <>
      {/* ✅ PC stays EXACTLY the same */}
      <div className="hidden sm:block">
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold tracking-wide text-slate-900 uppercase">Watched / Read</h2>
              <span className="text-sm text-slate-500">{items.length}</span>
            </div>

            {loadingLibrary ? <span className="text-sm text-slate-500">Loading…</span> : null}
          </div>

          {loadingLibrary ? (
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-600">Loading library…</div>
          ) : items.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
              Nothing in this library yet.
            </div>
          ) : (
            <>
              <div className="grid [grid-template-columns:repeat(auto-fill,minmax(100px,1fr))] gap-x-2 gap-y-4">
                {items.map((it) => {
                  const href = itemHref(it);

                  return (
                    <div key={`${it.kind}:${it.id}`} className="block">
                      {/* ✅ only the poster is the media link */}
                      <Link href={href} title={it.title} className="block">
                        {/* ✅ HOVER TRIGGER IS ONLY THIS POSTER BOX (NOT THE STARS ROW) */}
                        <div className="group relative w-full aspect-[2/3] overflow-visible">
                          <div className="relative w-full h-full overflow-hidden rounded-[4px] bg-slate-200 border-2 border-black group-hover:border-slate-400 transition">
                            {it.posterUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={it.posterUrl} alt={it.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="text-[10px] text-slate-500">No poster</span>
                              </div>
                            )}

                            {it.posterUrl ? (
                              <div className="pointer-events-none absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
                            ) : null}
                          </div>

                          {it.posterUrl ? (
                            <div className="pointer-events-none absolute inset-0 z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="flex-none w-[220px] aspect-[2/3] overflow-hidden rounded-[6px] ring-5 ring-black shadow-2xl bg-slate-200">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={it.posterUrl} alt={it.title} className="w-full h-full object-cover" />
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </Link>

                      {/* ✅ not inside .group, so hovering here does NOTHING to the preview */}
                      <div className="mt-0 flex items-center justify-between">
                        <div className="min-h-[12px] leading-none">
                          {(() => {
                            const hasStars = typeof it.stars === "number" && it.stars > 0;

                            return (
                              <div className="flex items-start">
                                {hasStars ? (
                                  <span className="text-[14px] text-slate-1000 tracking-tight leading-none">
                                    {renderStars(it.stars as number)}
                                  </span>
                                ) : null}

                                {it.liked ? (
                                  <span
                                    className={[
                                      "text-[15px] text-slate-1000 leading-none",
                                      hasStars ? "ml-1 relative top-[.5px]" : "",
                                    ].join(" ")}
                                    aria-label="Liked"
                                    title="Liked"
                                  >
                                    ♥
                                  </span>
                                ) : null}
                              </div>
                            );
                          })()}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {it.reviewed ? (
                            it.reviewPostId ? (
                              <Link href={`/posts/${it.reviewPostId}`} className="text-slate-600 hover:text-slate-900">
                                <ReviewIcon size={12} />
                              </Link>
                            ) : (
                              <span className="text-slate-600" aria-label="Reviewed" title="Reviewed">
                                <ReviewIcon size={12} />
                              </span>
                            )
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <InfiniteSentinel disabled={!hasMore || loadingLibrary || loadingMore} onVisible={loadMore} />

              {loadingMore ? <div className="py-4 text-xs text-slate-600">Loading more…</div> : null}
              {!loadingLibrary && !loadingMore && items.length > 0 && !hasMore ? (
                <div className="py-4 text-xs text-slate-500">That’s everything.</div>
              ) : null}
            </>
          )}
        </>
      </div>

      {/* ✅ Phone layout */}
      <div className="sm:hidden">
        <ProfileLibraryPhone items={items} loading={loadingLibrary} />
      </div>
    </>
  );
}

export default function UserLibraryPage() {
  return (
    <ProfileLayout activeTab="library">
      {({ profile }) => <LibraryBody profileId={profile.id} />}
    </ProfileLayout>
  );
}

function InfiniteSentinel({ onVisible, disabled }: { onVisible: () => void; disabled?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (disabled) return;

    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) onVisible();
      },
      { root: null, rootMargin: "800px", threshold: 0 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [onVisible, disabled]);

  return <div ref={ref} className="h-1 w-full" />;
}
