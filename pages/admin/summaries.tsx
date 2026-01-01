// pages/admin/summaries.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

type Item = {
  id: string;
  chapter_id: string;
  user_id: string;
  content: string;
  contains_spoilers: boolean;
  upvotes: number;
  created_at: string;
  updated_at: string | null;
  status: string | null;
  hidden_at: string | null;
  hidden_reason: string | null;

  // ✅ new
  reviewed_at: string | null;

  // ✅ enriched by the API
  chapter_number: number | null;
  manga_id: string | null;
  manga_slug: string | null;
  manga_title: string | null;
};

type ApiResp = {
  items: Item[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function fmtDate(s?: string | null) {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

function shortUuid(id: string) {
  if (!id) return "";
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

function chapterHref(slug: string, chapterNumber: number) {
  // keep decimals if they exist in DB (e.g. 78.1)
  return `/manga/${slug}/chapter/${String(chapterNumber)}`;
}

export default function AdminSummariesPage() {
  const router = useRouter();
  const key = typeof router.query.key === "string" ? router.query.key : "";

  const [status, setStatus] = useState<string>("all");

  // ✅ new reviewed filter
  const [reviewed, setReviewed] = useState<"unseen" | "seen" | "all">("unseen");

  const [chapterId, setChapterId] = useState<string>("");
  const [q, setQ] = useState<string>("");

  const [page, setPage] = useState<number>(1);
  const pageSize = 20;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ApiResp | null>(null);

  const canLoad = useMemo(() => Boolean(key), [key]);

  async function load() {
    if (!canLoad) return;

    setLoading(true);
    setErr(null);

    const params = new URLSearchParams();
    params.set("key", key);
    params.set("status", status);
    params.set("reviewed", reviewed); // ✅
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (chapterId.trim()) params.set("chapterId", chapterId.trim());
    if (q.trim()) params.set("q", q.trim());

    try {
      const r = await fetch(`/api/admin/summaries/list?${params.toString()}`);
      const j = await r.json();

      if (!r.ok) {
        setErr(j?.error ?? "Failed to load.");
        setData(null);
      } else {
        setData(j as ApiResp);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!router.isReady) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, canLoad, status, reviewed, page]);

  useEffect(() => {
    // When filters change, reset to page 1
    setPage(1);
  }, [status, reviewed]);

  async function setStatusFor(id: string, next: "active" | "hidden") {
    if (!key) return;

    try {
      const r = await fetch(`/api/admin/summaries/set-status?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: next }),
      });

      const j = await r.json();
      if (!r.ok) {
        alert(j?.error ?? "Failed.");
        return;
      }

      await load();
    } catch (e: any) {
      alert(e?.message ?? "Failed.");
    }
  }

  // ✅ mark seen/unseen
  async function setReviewedFor(id: string, next: boolean) {
    if (!key) return;

    try {
      const r = await fetch(`/api/admin/summaries/set-status?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, reviewed: next }),
      });

      const j = await r.json();
      if (!r.ok) {
        alert(j?.error ?? "Failed.");
        return;
      }

      await load();
    } catch (e: any) {
      alert(e?.message ?? "Failed.");
    }
  }

  if (!key) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-bold">Community summaries</h1>
        <p className="mt-2 text-sm text-gray-500">
          Missing admin key. Use <code className="rounded bg-gray-100 px-1">?key=...</code>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Community summaries</h1>
          <p className="mt-1 text-sm text-gray-500">Hide / restore summaries by status.</p>
        </div>

        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Back home
        </Link>
      </div>

      <div className="mt-6 rounded-lg border bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Status</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="active">active</option>
              <option value="hidden">hidden</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Reviewed</label>
            <select
              value={reviewed}
              onChange={(e) => {
                setReviewed(e.target.value as any);
                setPage(1);
              }}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="unseen">Unseen</option>
              <option value="seen">Seen</option>
              <option value="all">All</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Chapter ID</label>
            <input
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value)}
              placeholder="uuid..."
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Search content</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="type to filter..."
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            onClick={() => {
              setPage(1);
              load();
            }}
            className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
            disabled={loading}
          >
            {loading ? "Loading…" : "Apply filters"}
          </button>

          <div className="text-sm text-gray-600">
            {data ? (
              <>
                <span className="font-semibold">{data.total}</span> total
              </>
            ) : (
              "—"
            )}
          </div>
        </div>

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      </div>

      <div className="mt-6 flex items-center justify-end gap-2 text-sm">
        <button
          className="rounded border px-3 py-1 disabled:opacity-40"
          disabled={loading || (data?.page ?? 1) <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Prev
        </button>
        <div className="px-2">
          Page {data?.page ?? page} / {data?.totalPages ?? 1}
        </div>
        <button
          className="rounded border px-3 py-1 disabled:opacity-40"
          disabled={loading || (data?.page ?? 1) >= (data?.totalPages ?? 1)}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border bg-white">
        <div className="grid grid-cols-12 gap-0 border-b bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-600">
          <div className="col-span-1">Status</div>
          <div className="col-span-1">Upvotes</div>
          <div className="col-span-3">Chapter</div>
          <div className="col-span-2">User</div>
          <div className="col-span-4">Content</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        {(data?.items ?? []).map((it) => {
          const isHidden = (it.status ?? "active") === "hidden";

          const title = it.manga_title ?? "Unknown manga";
          const slug = it.manga_slug ?? "";
          const chNum = it.chapter_number;

          const canJump = Boolean(slug) && typeof chNum === "number";
          const isSeen = Boolean(it.reviewed_at);

          return (
            <div key={it.id} className="grid grid-cols-12 gap-0 px-4 py-4">
              <div className="col-span-1">
                <div className="flex flex-col gap-2">
                  <span
                    className={`inline-flex w-fit rounded-full px-2 py-1 text-xs font-semibold ${
                      isHidden ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                    }`}
                  >
                    {it.status ?? "active"}
                  </span>

                  <span
                    className={`inline-flex w-fit rounded-full px-2 py-1 text-xs font-semibold ${
                      isSeen ? "bg-gray-200 text-gray-700" : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {isSeen ? "seen" : "unseen"}
                  </span>
                </div>
              </div>

              <div className="col-span-1 text-sm">{it.upvotes ?? 0}</div>

              <div className="col-span-3">
                <div className="text-sm font-semibold text-gray-900">{title}</div>
                <div className="mt-0.5 text-xs text-gray-600">
                  Chapter{" "}
                  {typeof chNum === "number" ? (
                    <span className="font-semibold">{String(chNum)}</span>
                  ) : (
                    <span className="font-semibold">?</span>
                  )}{" "}
                  <span className="text-gray-400">•</span>{" "}
                  <span title={it.chapter_id}>{shortUuid(it.chapter_id)}</span>
                  {canJump && (
                    <>
                      {" "}
                      <span className="text-gray-400">•</span>{" "}
                      <a
                        href={chapterHref(slug, chNum as number)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Jump
                      </a>
                    </>
                  )}
                </div>
              </div>

              <div className="col-span-2">
                <div className="text-xs text-gray-700" title={it.user_id}>
                  {shortUuid(it.user_id)}
                </div>
              </div>

              <div className="col-span-4">
                <div className="whitespace-pre-wrap text-sm text-gray-900">{it.content}</div>
                <div className="mt-2 text-xs text-gray-500">Created: {fmtDate(it.created_at)}</div>
              </div>

              <div className="col-span-1 flex justify-end">
                <div className="flex flex-col items-end gap-2">
                  {isHidden ? (
                    <button
                      onClick={() => setStatusFor(it.id, "active")}
                      className="rounded-md bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-500"
                    >
                      Restore
                    </button>
                  ) : (
                    <button
                      onClick={() => setStatusFor(it.id, "hidden")}
                      className="rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500"
                    >
                      Hide
                    </button>
                  )}

                  <button
                    onClick={() => setReviewedFor(it.id, !isSeen)}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    {isSeen ? "Mark unseen" : "Mark seen"}
                  </button>

                  {isSeen && (
                    <div className="text-[10px] text-gray-500">Seen: {fmtDate(it.reviewed_at)}</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {(data?.items?.length ?? 0) === 0 && (
          <div className="px-4 py-10 text-center text-sm text-gray-500">
            {loading ? "Loading…" : "No summaries found for these filters."}
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-gray-500">
        Tip: bookmark this page once you’ve accessed it with your admin key.
      </p>
    </div>
  );
}
