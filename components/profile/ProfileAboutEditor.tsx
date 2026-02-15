// components/profile/ProfileAboutEditor.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { renderProfileAboutToHtml } from "@/lib/markdown/renderProfileAbout";

type Props = {
  initialMarkdown: string;
  onSaved?: (args: { about_markdown: string; about_html: string }) => void;
};

type ModalKind = "link" | "image" | "youtube" | "webm";

function clampLen(s: string, max: number) {
  if (s.length <= max) return s;
  return s.slice(0, max);
}

export default function ProfileAboutEditor({ initialMarkdown, onSaved }: Props) {
  const [value, setValue] = useState(initialMarkdown ?? "");
  const [saving, setSaving] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const saveMsgTimerRef = useRef<any>(null);

  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // ----- Preview state -----
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewReqIdRef = useRef(0);

  // ----- Modal state -----
  const [modal, setModal] = useState<{
    open: boolean;
    kind: ModalKind;
    url: string;
    text: string; // used for link text / image alt
  } | null>(null);

  useEffect(() => {
    setValue(initialMarkdown ?? "");
  }, [initialMarkdown]);

  const chars = useMemo(() => value.length, [value]);

  // -----------------------------
  // Selection helpers
  // -----------------------------
  function focusTextarea() {
    taRef.current?.focus();
  }

  function getSelection() {
    const el = taRef.current;
    if (!el) return { start: 0, end: 0, selected: "" };

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = value.slice(start, end);
    return { start, end, selected };
  }

  function replaceRange(start: number, end: number, insert: string, selectInserted = false) {
    const el = taRef.current;

    const before = value.slice(0, start);
    const after = value.slice(end);
    const next = before + insert + after;

    setValue(next);

    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + insert.length;
      if (selectInserted) el.setSelectionRange(start, pos);
      else el.setSelectionRange(pos, pos);
    });
  }

  function wrapSelection(prefix: string, suffix: string, placeholder = "") {
    const el = taRef.current;
    if (!el) return;

    const { start, end, selected } = getSelection();
    const inner = selected.length > 0 ? selected : placeholder;
    replaceRange(start, end, `${prefix}${inner}${suffix}`, true);

    requestAnimationFrame(() => {
      el.focus();
      const selStart = start + prefix.length;
      const selEnd = selStart + inner.length;
      el.setSelectionRange(selStart, selEnd);
    });
  }

  function insertAtCursor(text: string) {
    const { start, end } = getSelection();
    replaceRange(start, end, text, false);
  }

  // -----------------------------
  // Toolbar actions
  // -----------------------------
  function actionBold() {
    wrapSelection("**", "**", "bold");
  }
  function actionItalic() {
    wrapSelection("*", "*", "italic");
  }
  function actionStrike() {
    wrapSelection("~~", "~~", "strike");
  }
  function actionSpoiler() {
    wrapSelection("~! ", " !~", "spoiler text");
  }
  function actionHeading() {
    // If selection exists, make it a heading line; otherwise insert a heading line.
    const { start, end, selected } = getSelection();
    if (selected.trim()) {
      const lines = selected.split("\n");
      const headed = lines.map((l) => (l.trim().length ? `## ${l.replace(/^#+\s*/, "")}` : l)).join("\n");
      replaceRange(start, end, headed, true);
    } else {
      insertAtCursor("## Heading\n");
    }
  }
  function actionCode() {
    const { selected } = getSelection();
    if (selected.trim()) wrapSelection("```\n", "\n```", selected);
    else insertAtCursor("```\ncode\n```\n");
  }
  function actionCenter() {
    const { selected } = getSelection();
    if (selected.trim()) wrapSelection("[center]\n", "\n[/center]", selected);
    else insertAtCursor("[center]\ncentered text\n[/center]\n");
  }
  function actionUl() {
    const { start, end, selected } = getSelection();
    if (!selected.trim()) {
      insertAtCursor("- item\n- item\n");
      return;
    }
    const listed = selected
      .split("\n")
      .map((l) => (l.trim().length ? `- ${l.replace(/^-+\s*/, "")}` : l))
      .join("\n");
    replaceRange(start, end, listed, true);
  }
  function actionOl() {
    const { start, end, selected } = getSelection();
    if (!selected.trim()) {
      insertAtCursor("1. item\n2. item\n");
      return;
    }
    const lines = selected.split("\n");
    let n = 1;
    const listed = lines
      .map((l) => {
        if (!l.trim().length) return l;
        const clean = l.replace(/^\d+\.\s*/, "");
        const out = `${n}. ${clean}`;
        n += 1;
        return out;
      })
      .join("\n");
    replaceRange(start, end, listed, true);
  }

  // -----------------------------
  // Toolbar actions (modal)
  // -----------------------------
  function openModal(kind: ModalKind) {
    const { selected } = getSelection();

    setModal({
      open: true,
      kind,
      url: "",
      text:
        kind === "link"
          ? selected.trim() ? selected.trim() : "link text"
          : kind === "image"
            ? selected.trim() ? selected.trim() : "image"
            : "",
    });
  }

  function closeModal() {
    setModal(null);
    requestAnimationFrame(() => focusTextarea());
  }

  function confirmModal() {
    if (!modal) return;

    const url = modal.url.trim();
    const text = modal.text.trim();
    if (!url) return;

    if (modal.kind === "link") {
      const { selected, start, end } = getSelection();
      const linkText = selected.trim() ? selected.trim() : (text || "link");
      replaceRange(start, end, `[${linkText}](${url})`, false);
      closeModal();
      return;
    }

    if (modal.kind === "image") {
      const { start, end } = getSelection();
      const alt = text || "image";
      replaceRange(start, end, `![${alt}](${url})`, false);
      closeModal();
      return;
    }

    if (modal.kind === "youtube") {
      insertAtCursor(`\n[youtube](${url})\n`);
      closeModal();
      return;
    }

    if (modal.kind === "webm") {
      insertAtCursor(`\n[webm](${url})\n`);
      closeModal();
      return;
    }
  }

  // -----------------------------
  // Live Preview (debounced)
  // -----------------------------
  useEffect(() => {
    let cancelled = false;
    const reqId = ++previewReqIdRef.current;

    setPreviewLoading(true);

    const t = setTimeout(() => {
      (async () => {
        try {
          const html = await renderProfileAboutToHtml(value);
          if (cancelled) return;
          if (reqId !== previewReqIdRef.current) return;
          setPreviewHtml(html);
        } catch {
          if (cancelled) return;
          if (reqId !== previewReqIdRef.current) return;
          setPreviewHtml("<p>Preview failed to render.</p>");
        } finally {
          if (!cancelled && reqId === previewReqIdRef.current) setPreviewLoading(false);
        }
      })();
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value]);

  // -----------------------------
  // Save
  // -----------------------------
  async function save() {
    setMsg(null);
    setSaving(true);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;

      if (!token) {
        setMsg("You must be logged in.");
        setSaving(false);
        return;
      }

      const r = await fetch("/api/profile/about", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ about_markdown: value }),
      });

      const j = await r.json();
      if (!r.ok || !j?.ok) {
        setMsg(j?.error || "Failed to save.");
        setSaving(false);
        return;
      }

      onSaved?.({
        about_markdown: j.about_markdown ?? value,
        about_html: j.about_html ?? previewHtml ?? "",
      });

      setMsg("Saved.");
      if (saveMsgTimerRef.current) clearTimeout(saveMsgTimerRef.current);
      saveMsgTimerRef.current = setTimeout(() => setMsg(null), 2000);

      setSaving(false);
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to save.");
      setSaving(false);
    }
  }

  // -----------------------------
  // UI helpers
  // -----------------------------
  function ToolBtn(props: { title: string; onClick: () => void; children: React.ReactNode }) {
    return (
      <button
        type="button"
        title={props.title}
        onClick={props.onClick}
        className="h-8 w-8 rounded-md border border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-200 active:scale-[0.98] transition"
      >
        <span className="inline-flex items-center justify-center w-full h-full">{props.children}</span>
      </button>
    );
  }

  const modalTitle =
    modal?.kind === "link"
      ? "Insert Link"
      : modal?.kind === "image"
        ? "Insert Image"
        : modal?.kind === "youtube"
          ? "Insert YouTube"
          : modal?.kind === "webm"
            ? "Insert WebM"
            : "Insert";

  const urlPlaceholder =
    modal?.kind === "link"
      ? "https://example.com"
      : modal?.kind === "image"
        ? "https://example.com/image.png"
        : modal?.kind === "youtube"
          ? "https://www.youtube.com/watch?v=..."
          : "https://example.com/video.webm";

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">About</h2>
        <div className="text-xs text-slate-500">{chars.toLocaleString()}/20,000</div>
      </div>

      {/* Toolbar */}
      <div className="mt-3 flex flex-wrap items-center gap-1 rounded-xs border-2 border-black bg-white px-2 py-2">
        <ToolBtn title="Bold" onClick={actionBold}>
          <span className="font-black">B</span>
        </ToolBtn>
        <ToolBtn title="Italic" onClick={actionItalic}>
          <span className="italic font-semibold">I</span>
        </ToolBtn>
        <ToolBtn title="Strikethrough" onClick={actionStrike}>
          <span className="line-through font-semibold">S</span>
        </ToolBtn>
        <ToolBtn title="Spoiler" onClick={actionSpoiler}>
          🙈
        </ToolBtn>

        <div className="mx-1 h-5 w-px bg-slate-200" />

        <ToolBtn title="Link" onClick={() => openModal("link")}>
          🔗
        </ToolBtn>
        <ToolBtn title="Image" onClick={() => openModal("image")}>
          🖼️
        </ToolBtn>
        <ToolBtn title="YouTube" onClick={() => openModal("youtube")}>
          ▶️
        </ToolBtn>
        <ToolBtn title="WebM" onClick={() => openModal("webm")}>
          🎞️
        </ToolBtn>

        <div className="mx-1 h-5 w-px bg-slate-200" />

        <ToolBtn title="Ordered List" onClick={actionOl}>
          1.
        </ToolBtn>
        <ToolBtn title="Unordered List" onClick={actionUl}>
          •
        </ToolBtn>
        <ToolBtn title="Header" onClick={actionHeading}>
          H
        </ToolBtn>
        <ToolBtn title="Center" onClick={actionCenter}>
          ≡
        </ToolBtn>
        <ToolBtn title="Code" onClick={actionCode}>
          <span className="font-mono font-semibold">{"</>"}</span>
        </ToolBtn>
      </div>

      {/* Editor + Preview */}
      <div className="mt-3 grid gap-4">
        <textarea
          ref={taRef}
          className="min-h-[220px] w-full rounded-xs border-2 border-black bg-white p-3 text-sm text-slate-900 outline-none focus:border-blue-500"
          value={value}
          onChange={(e) => setValue(clampLen(e.target.value, 20000))}
          placeholder="A little about yourself…"
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-sm bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>

          {msg ? (
            <span className="inline-flex items-center rounded-full border border-black bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
              {msg}
            </span>
          ) : null}
        </div>

        {/* Preview */}
        <div className="rounded-xs border-2 border-black bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</div>
            {previewLoading ? <div className="text-xs text-slate-400">Rendering…</div> : null}
          </div>

          <div
            className={[
              "mt-3 text-sm text-slate-900",
              "prose max-w-none",
              "prose-a:text-blue-600 prose-a:underline hover:prose-a:text-blue-700",
              "prose-img:rounded-lg",

              "[&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-700",

              "[&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2",
              "[&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2",
              "[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-2",
              "[&_h4]:text-sm [&_h4]:font-semibold [&_h4]:mt-2 [&_h4]:mb-2",

              // ✅ force list markers back on (Tailwind base removes them)
              "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-3",
              "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3",
              "[&_li]:my-1",
            ].join(" ")}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      </div>

      {/* Modal */}
      {modal?.open ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">{modalTitle}</h3>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="mt-3 grid gap-3">
              {modal.kind === "link" || modal.kind === "image" ? (
                <label className="grid gap-1">
                  <span className="text-xs text-slate-500">
                    {modal.kind === "link" ? "Text" : "Alt text"}
                  </span>
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                    value={modal.text}
                    onChange={(e) => setModal({ ...modal, text: e.target.value })}
                    placeholder={modal.kind === "link" ? "link text" : "image"}
                  />
                </label>
              ) : null}

              <label className="grid gap-1">
                <span className="text-xs text-slate-500">URL</span>
                <input
                  autoFocus
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                  value={modal.url}
                  onChange={(e) => setModal({ ...modal, url: e.target.value })}
                  placeholder={urlPlaceholder}
                />
              </label>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmModal}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Insert
                </button>
              </div>

              <div className="text-[11px] text-slate-500">
                Tip: everything updates instantly in the preview below.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}