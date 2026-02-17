"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Tab = "followers" | "following";

type Props = {
  open: boolean;
  onClose: () => void;

  // The profile being viewed
  profileId: string;

  // Which tab to show when opened
  initialTab: Tab;
};

type MiniProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
};

const PAGE_SIZE = 30;

function Avatar({ url, username }: { url: string | null; username: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="h-10 w-10 rounded-full object-cover ring-1 ring-slate-200 bg-white"
      />
    );
  }
  return (
    <div className="h-10 w-10 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-semibold ring-1 ring-slate-200">
      {username?.charAt(0)?.toUpperCase?.() ?? "?"}
    </div>
  );
}

export default function ProfileFollowsModal({ open, onClose, profileId, initialTab }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);

  // list state
  const [items, setItems] = useState<MiniProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // cursor
  const lastCursorRef = useRef<{ created_at: string; id: string } | null>(null);

  // sentinel for infinite scroll
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // keep tab in sync when you open from different pill
  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  // reset + load first page whenever open/tab/profile changes
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function firstLoad() {
      setErrorMsg(null);
      setItems([]);
      setHasMore(true);
      lastCursorRef.current = null;

      setLoading(true);
      const res = await fetchPage({ profileId, tab, cursor: null });
      if (cancelled) return;

      if (res.ok) {
        setItems(res.items);
        setHasMore(res.hasMore);
        lastCursorRef.current = res.nextCursor;
      } else {
        setErrorMsg(res.errorMsg);
        setHasMore(false);
      }

      setLoading(false);
    }

    firstLoad();

    return () => {
      cancelled = true;
    };
  }, [open, tab, profileId]);

  // infinite scroll observer
  useEffect(() => {
    if (!open) return;
    if (!sentinelRef.current) return;

    const el = sentinelRef.current;

    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (loading || loadingMore) return;
        if (!hasMore) return;

        void loadMore();
      },
      { root: null, rootMargin: "200px", threshold: 0.01 }
    );

    obs.observe(el);

    return () => {
      obs.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasMore, loading, loadingMore, tab, profileId]);

  async function loadMore() {
    if (loadingMore) return;
    if (!hasMore) return;

    setErrorMsg(null);
    setLoadingMore(true);

    const cursor = lastCursorRef.current;

    const res = await fetchPage({ profileId, tab, cursor });

    if (res.ok) {
      // de-dupe by id (just in case)
      const existing = new Set(items.map((x) => x.id));
      const merged = [...items];
      for (const it of res.items) {
        if (!existing.has(it.id)) merged.push(it);
      }
      setItems(merged);

      setHasMore(res.hasMore);
      lastCursorRef.current = res.nextCursor;
    } else {
      setErrorMsg(res.errorMsg);
      setHasMore(false);
    }

    setLoadingMore(false);
  }

  // close on Escape
  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const title = useMemo(() => (tab === "followers" ? "Followers" : "Following"), [tab]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* panel */}
      <div className="absolute inset-0 flex items-start justify-center p-3 sm:p-6">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-xl ring-1 ring-black/5 overflow-hidden">
          {/* header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <div className="text-base font-semibold text-slate-900">{title}</div>
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 rounded-lg hover:bg-slate-100 active:bg-slate-200 flex items-center justify-center"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* tabs */}
          <div className="px-3 pt-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTab("followers")}
                className={[
                  "h-9 px-3 rounded-xl text-sm font-semibold",
                  tab === "followers" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800 hover:bg-slate-200",
                ].join(" ")}
              >
                Followers
              </button>
              <button
                type="button"
                onClick={() => setTab("following")}
                className={[
                  "h-9 px-3 rounded-xl text-sm font-semibold",
                  tab === "following" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800 hover:bg-slate-200",
                ].join(" ")}
              >
                Following
              </button>
            </div>
          </div>

          {/* content */}
          <div className="px-3 pb-3">
            <div className="mt-3 max-h-[70vh] overflow-auto rounded-xl border border-slate-200">
              {loading ? (
                <div className="p-4 text-sm text-slate-600">Loading…</div>
              ) : errorMsg ? (
                <div className="p-4 text-sm text-red-600">{errorMsg}</div>
              ) : items.length === 0 ? (
                <div className="p-4 text-sm text-slate-600">No users yet.</div>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {items.map((p) => (
                    <li key={p.id} className="p-3">
                      <Link href={`/${p.username}`} className="flex items-center gap-3 hover:opacity-90">
                        <Avatar url={p.avatar_url} username={p.username} />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">@{p.username}</div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {/* sentinel */}
              <div ref={sentinelRef} />

              {loadingMore ? <div className="p-3 text-sm text-slate-600">Loading more…</div> : null}
              {!loading && !errorMsg && items.length > 0 && !hasMore ? (
                <div className="p-3 text-xs text-slate-500">That’s everyone.</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

async function fetchPage(args: {
  profileId: string;
  tab: Tab;
  cursor: { created_at: string; id: string } | null;
}): Promise<
  | { ok: true; items: MiniProfile[]; hasMore: boolean; nextCursor: { created_at: string; id: string } | null }
  | { ok: false; errorMsg: string }
> {
  const { profileId, tab, cursor } = args;

  // Decide which direction + which id column is “the other user”
  const isFollowers = tab === "followers";
  const filterCol = isFollowers ? "following_id" : "follower_id";
  const otherIdCol = isFollowers ? "follower_id" : "following_id";

  let q = supabase
    .from("user_follows")
    .select(`${otherIdCol}, created_at`)
    .eq(filterCol, profileId)
    .order("created_at", { ascending: false })
    .order(otherIdCol as any, { ascending: false })
    .limit(PAGE_SIZE);

  // Cursor pagination: created_at desc, otherId desc
  if (cursor) {
    const lastAt = cursor.created_at;
    const lastId = cursor.id;

    // created_at < lastAt OR (created_at = lastAt AND otherIdCol < lastId)
    q = q.or(
      `created_at.lt.${lastAt},and(created_at.eq.${lastAt},${otherIdCol}.lt.${lastId})`
    );
  }

  const { data, error } = await q;

  if (error) return { ok: false, errorMsg: "Couldn’t load users. Try again." };

  const rows = data ?? [];
  const ids = rows.map((r: any) => r[otherIdCol]).filter(Boolean) as string[];

  if (ids.length === 0) {
    return { ok: true, items: [], hasMore: false, nextCursor: null };
  }

  // fetch the profile mini-cards
  const { data: profs, error: pErr } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .in("id", ids);

  if (pErr) return { ok: false, errorMsg: "Couldn’t load profile details. Try again." };

  const map = new Map<string, MiniProfile>();
  for (const p of (profs ?? []) as any[]) {
    map.set(p.id, p);
  }

  const ordered: MiniProfile[] = ids.map((id) => map.get(id)).filter(Boolean) as MiniProfile[];

  const lastRow = rows[rows.length - 1] as any;
  const nextCursor =
    lastRow && lastRow.created_at && lastRow[otherIdCol]
      ? { created_at: lastRow.created_at as string, id: lastRow[otherIdCol] as string }
      : null;

  return {
    ok: true,
    items: ordered,
    hasMore: rows.length === PAGE_SIZE,
    nextCursor,
  };
}