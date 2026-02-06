"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  chapterId: string;

  // lets the PAGE render the top summary in its own synopsis area
  onTopSummary?: (s: { content: string; contains_spoilers: boolean } | null) => void;

  // icon mode (used when a community summary exists)
  mode?: "default" | "icon";

  // optional wrapper spacing override (phone-only usage)
  className?: string;
};

type ChapterSummaryRow = {
  id: string;
  user_id: string;
  content: string;
  contains_spoilers: boolean;
  upvotes: number;
  created_at: string;
};

const MAX_CHARS = 500;

function ComposerPanel({
  text,
  setText,
  spoilers,
  setSpoilers,
  remaining,
  saving,
  err,
  ok,
  onClose,
  onSave,
  noTopMargin,
}: {
  text: string;
  setText: (next: string) => void;
  spoilers: boolean;
  setSpoilers: (next: boolean) => void;
  remaining: number;
  saving: boolean;
  err: string | null;
  ok: string | null;
  onClose: () => void;
  onSave: () => void;
  noTopMargin?: boolean;
}) {
  return (
    <div
      className={[
        noTopMargin ? "" : "mt-2",
        "rounded-md border border-neutral-800 bg-neutral-950 p-2 sm:p-3 shadow-lg",
      ].join(" ")}
    >
      {err && <p className="mb-2 text-xs text-red-300">{err}</p>}
      {ok && <p className="mb-2 text-xs text-green-300">{ok}</p>}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
        rows={4}
        placeholder="Write a short, high-level summary..."
        className={[
          "w-full resize-none rounded-md border border-neutral-800 bg-black",
          "px-2 py-1.5 sm:px-3 sm:py-2",
          // iOS: prevent zoom by ensuring >= 16px on phone
          "text-base sm:text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none",
          "min-h-[108px] sm:min-h-[132px]",
        ].join(" ")}
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-neutral-300">
          <input
            type="checkbox"
            checked={spoilers}
            onChange={(e) => setSpoilers(e.target.checked)}
            className="h-4 w-4"
          />
          Contains spoilers
        </label>

        <div className="text-xs text-neutral-500">{remaining} left</div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-neutral-800 bg-black px-2.5 py-1 text-xs font-medium text-neutral-200 hover:bg-neutral-900 sm:px-3 sm:py-1.5"
          disabled={saving}
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-60 sm:px-3 sm:py-1.5"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

export default function MangaChapterSummary({
  chapterId,
  onTopSummary,
  mode = "default",
  className,
}: Props) {
  const [summary, setSummary] = useState<ChapterSummaryRow | null>(null); // top summary (global)
  const [loading, setLoading] = useState(true);

  // "my summary"
  const [mySummary, setMySummary] = useState<ChapterSummaryRow | null>(null);

  // composer
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [spoilers, setSpoilers] = useState(false);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const remaining = useMemo(() => MAX_CHARS - text.length, [text.length]);

  async function loadTop() {
    const { data, error } = await supabase
      .from("manga_chapter_summaries")
      .select("id, user_id, content, contains_spoilers, upvotes, created_at")
      .eq("chapter_id", chapterId)
      .eq("status", "active")
      .order("upvotes", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error) {
      setSummary(data);

      if (onTopSummary) {
        if (data) {
          onTopSummary({
            content: data.content,
            contains_spoilers: Boolean(data.contains_spoilers),
          });
        } else {
          onTopSummary(null);
        }
      }
    }
  }

  async function loadMySummary(uid: string) {
    const { data, error } = await supabase
      .from("manga_chapter_summaries")
      .select("id, user_id, content, contains_spoilers, upvotes, created_at")
      .eq("chapter_id", chapterId)
      .eq("user_id", uid)
      .limit(1)
      .maybeSingle();

    if (!error) setMySummary(data);
    else setMySummary(null);

    return { data, error };
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErr(null);
      setOk(null);

      const { data: authRes } = await supabase.auth.getUser();
      const uid = authRes?.user?.id ?? null;

      await loadTop();

      if (uid) {
        await loadMySummary(uid);
      } else if (!cancelled) {
        setMySummary(null);
      }

      if (!cancelled) setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeComposer();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Phone-only: lock body scroll when sheet is open
  useEffect(() => {
    if (!open) return;

    const isPhone =
      typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;

    if (!isPhone) return;

    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = (document.body.style as any).touchAction;

    document.body.style.overflow = "hidden";
    (document.body.style as any).touchAction = "none";

    return () => {
      document.body.style.overflow = prevOverflow;
      (document.body.style as any).touchAction = prevTouchAction ?? "";
    };
  }, [open]);

  async function openComposer() {
    setErr(null);
    setOk(null);

    const { data: authRes, error: authErr } = await supabase.auth.getUser();
    const uid = authRes?.user?.id ?? null;

    if (authErr || !uid) {
      setErr("You must be logged in to add a summary.");
      setOpen(true);
      return;
    }

    const { data } = await loadMySummary(uid);

    if (data) {
      setText(data.content ?? "");
      setSpoilers(Boolean(data.contains_spoilers));
    } else {
      setText("");
      setSpoilers(false);
    }

    setOpen(true);
  }

  async function onSave() {
    setErr(null);
    setOk(null);

    const trimmed = text.trim();
    if (!trimmed) {
      setErr("Write a short summary first.");
      return;
    }
    if (trimmed.length > MAX_CHARS) {
      setErr(`Keep it under ${MAX_CHARS} characters.`);
      return;
    }

    const { data: authRes, error: authErr } = await supabase.auth.getUser();
    const uid = authRes?.user?.id ?? null;
    if (authErr || !uid) {
      setErr("You must be logged in to add a summary.");
      return;
    }

    setSaving(true);
    try {
      let mine = mySummary;
      if (!mine) {
        const { data } = await loadMySummary(uid);
        mine = data ?? null;
      }

      if (mine?.id) {
        const { error: updateErr } = await supabase
          .from("manga_chapter_summaries")
          .update({
            content: trimmed,
            contains_spoilers: spoilers,
          })
          .eq("id", mine.id);

        if (updateErr) {
          setErr(updateErr.message ?? "Failed to update summary.");
          return;
        }

        setOk("Summary updated.");
      } else {
        const { error: insertErr } = await supabase.from("manga_chapter_summaries").insert({
          chapter_id: chapterId,
          user_id: uid,
          content: trimmed,
          contains_spoilers: spoilers,
        });

        if (insertErr) {
          const code = (insertErr as any)?.code;
          if (code === "23505") {
            await loadMySummary(uid);
            setErr("You already have a summary for this chapter. Edit it instead.");
            return;
          }
          setErr(insertErr.message ?? "Failed to save summary.");
          return;
        }

        setOk("Summary submitted.");
      }

      await loadMySummary(uid);
      await loadTop();

      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  function closeComposer() {
    setOpen(false);
    setErr(null);
    setOk(null);
  }

  if (loading) return null;

  const hoverLabel = mySummary ? "Edit summary" : "Add summary";
  const Icon = mySummary ? Pencil : Plus;

  if (mode === "icon") {
    if (!summary) return null;

    return (
      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => {
            if (open) closeComposer();
            else openComposer();
          }}
          title={hoverLabel}
          aria-label={hoverLabel}
          className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-neutral-700 bg-neutral-900 text-neutral-100 hover:bg-neutral-800"
        >
          <Icon className="h-3.5 w-3.5" />
        </button>

        {/* Desktop popover (sm+) */}
        {open && (
          <div className="hidden sm:block">
            <div className="absolute right-0 top-7 z-[60] w-[360px] max-w-[min(360px,calc(100vw-24px))]">
              <ComposerPanel
                noTopMargin
                text={text}
                setText={(next) => {
                  setText(next);
                  setErr(null);
                  setOk(null);
                }}
                spoilers={spoilers}
                setSpoilers={(next) => {
                  setSpoilers(next);
                  setErr(null);
                  setOk(null);
                }}
                remaining={remaining}
                saving={saving}
                err={err}
                ok={ok}
                onClose={closeComposer}
                onSave={onSave}
              />
            </div>
          </div>
        )}

        {/* Phone sheet (below sm) */}
        {open && (
          <div className="sm:hidden">
            <div
              className="fixed inset-0 z-[9999] bg-black/60"
              onPointerDown={closeComposer}
              aria-hidden="true"
            />

            <div className="fixed inset-0 z-[10000] flex items-end p-3">
              <div
                className={[
                  "w-full rounded-xl border border-neutral-800 bg-neutral-950 shadow-2xl",
                  "max-h-[80vh] overflow-auto overscroll-contain",
                ].join(" ")}
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
              >
                <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
                  <div className="text-xs font-semibold text-neutral-200">
                    {mySummary ? "Edit your summary" : "Add your summary"}
                  </div>
                  <button
                    type="button"
                    onClick={closeComposer}
                    className="rounded-md border border-neutral-800 bg-black px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-900"
                  >
                    Close
                  </button>
                </div>

                <div className="p-3">
                  <ComposerPanel
                    noTopMargin
                    text={text}
                    setText={(next) => {
                      setText(next);
                      setErr(null);
                      setOk(null);
                    }}
                    spoilers={spoilers}
                    setSpoilers={(next) => {
                      setSpoilers(next);
                      setErr(null);
                      setOk(null);
                    }}
                    remaining={remaining}
                    saving={saving}
                    err={err}
                    ok={ok}
                    onClose={closeComposer}
                    onSave={onSave}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // DEFAULT MODE (unchanged)
  return (
    <div
      className={[
        className ?? "mt-6",
        "rounded-md border border-neutral-800 bg-black p-2 sm:p-2.5",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-xs text-neutral-100">
          {summary
            ? "A community summary exists. Use the button to edit yours."
            : "No community summary yet. Be the first to add one."}
        </p>

        <button
          type="button"
          onClick={() => {
            if (open) closeComposer();
            else openComposer();
          }}
          className="flex-shrink-0 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-medium text-neutral-100 hover:bg-neutral-800 sm:px-3 sm:py-1.5"
          title={hoverLabel}
          aria-label={hoverLabel}
        >
          {open ? "Close" : hoverLabel}
        </button>
      </div>

      {open ? (
        <ComposerPanel
          text={text}
          setText={(next) => {
            setText(next);
            setErr(null);
            setOk(null);
          }}
          spoilers={spoilers}
          setSpoilers={(next) => {
            setSpoilers(next);
            setErr(null);
            setOk(null);
          }}
          remaining={remaining}
          saving={saving}
          err={err}
          ok={ok}
          onClose={closeComposer}
          onSave={onSave}
        />
      ) : null}
    </div>
  );
}
