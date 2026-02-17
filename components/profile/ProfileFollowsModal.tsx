"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";

type Tab = "followers" | "following";

type Props = {
  open: boolean;
  onClose: () => void;

  profileId: string;
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

export default function ProfileFollowsModal({
  open,
  onClose,
  profileId,
  initialTab,
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);

  const [items, setItems] = useState<MiniProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const lastCursorRef = useRef<{ created_at: string; id: string } | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const panelRef = useRef<HTMLDivElement | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  /* ---------------------------------------------
     Close on outside click (ANYWHERE outside panel)
  ---------------------------------------------- */
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      const panel = panelRef.current;
      if (!panel) return;

      if (!panel.contains(e.target as Node)) {
        onClose();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, onClose]);

  /* ---------- Initial load ---------- */
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

  /* ---------- Infinite scroll ---------- */
  useEffect(() => {
    if (!open) return;
    if (!sentinelRef.current) return;

    const el = sentinelRef.current;

    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (loading || loadingMore || !hasMore) return;
        void loadMore();
      },
      { rootMargin: "200px", threshold: 0.01 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [open, loading, loadingMore, hasMore]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;

    setErrorMsg(null);
    setLoadingMore(true);

    const res = await fetchPage({
      profileId,
      tab,
      cursor: lastCursorRef.current,
    });

    if (res.ok) {
      const existing = new Set(items.map((x) => x.id));
      setItems((prev) => [
        ...prev,
        ...res.items.filter((x) => !existing.has(x.id)),
      ]);

      setHasMore(res.hasMore);
      lastCursorRef.current = res.nextCursor;
    } else {
      setErrorMsg(res.errorMsg);
      setHasMore(false);
    }

    setLoadingMore(false);
  }

  /* ---------- Escape key ---------- */
  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const title = useMemo(
    () => (tab === "followers" ? "Followers" : "Following"),
    [tab]
  );

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center p-3 sm:p-6">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* panel */}
      <div
        ref={panelRef}
        className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl ring-1 ring-black/5 overflow-hidden"
      >
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
            {(["followers", "following"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={[
                  "h-9 px-3 rounded-xl text-sm font-semibold",
                  tab === t
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-800 hover:bg-slate-200",
                ].join(" ")}
              >
                {t === "followers" ? "Followers" : "Following"}
              </button>
            ))}
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
              <div className="p-4 text-sm text-slate-600">None yet.</div>
            ) : (
              <ul className="divide-y divide-slate-200">
                {items.map((p) => (
                  <li key={p.id} className="p-3">
                    <Link
                      href={`/${p.username}`}
                      className="flex items-center gap-3 hover:opacity-90"
                    >
                      <Avatar url={p.avatar_url} username={p.username} />
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        @{p.username}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <div ref={sentinelRef} />

            {loadingMore && (
              <div className="p-3 text-sm text-slate-600">Loading more…</div>
            )}

            {!loading && !errorMsg && items.length > 0 && !hasMore && (
              <div className="p-3 text-xs text-slate-500">That’s everyone.</div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* -----------------------------
   Data loader
------------------------------ */

async function fetchPage(args: {
  profileId: string;
  tab: Tab;
  cursor: { created_at: string; id: string } | null;
}) {
  const { profileId, tab, cursor } = args;

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

  if (cursor) {
    q = q.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},${otherIdCol}.lt.${cursor.id})`
    );
  }

  const { data, error } = await q;
  if (error) return { ok: false as const, errorMsg: "Couldn’t load users." };

  const ids = (data ?? []).map((r: any) => r[otherIdCol]).filter(Boolean);
  if (!ids.length) return { ok: true as const, items: [], hasMore: false, nextCursor: null };

  const { data: profs, error: pErr } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .in("id", ids);

  if (pErr) return { ok: false as const, errorMsg: "Couldn’t load profiles." };

  const map = new Map(profs.map((p: any) => [p.id, p]));
  const ordered = ids.map((id: string) => map.get(id)).filter(Boolean);

  const last = data[data.length - 1] as any;

  return {
    ok: true as const,
    items: ordered,
    hasMore: data.length === PAGE_SIZE,
    nextCursor: last
      ? { created_at: last.created_at, id: last[otherIdCol] }
      : null,
  };
}