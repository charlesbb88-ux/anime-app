"use client";

import React from "react";
import {
  Bold,
  Italic,
  Link2,
  Image as ImageIcon,
  EyeOff,
  Code,
} from "lucide-react";

type Props = {
  value: string;
  setValue: (v: string) => void;

  textareaRef: React.RefObject<HTMLTextAreaElement | null>;

  /** disable buttons (ex: while posting) */
  disabled?: boolean;

  /** optional: hide certain tools */
  showCode?: boolean;
};

function ToolBtn(props: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={props.title}
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        width: 34,
        height: 34,
        borderRadius: 999,
        border: "none",
        background: "transparent",
        cursor: props.disabled ? "default" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: props.disabled ? "#999" : "#555",
        transition: "background 0.12s ease, transform 0.12s ease, color 0.12s ease",
      }}
      onMouseEnter={(e) => {
        if (props.disabled) return;
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.background = "#0000000f";
        e.currentTarget.style.color = "#111";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = props.disabled ? "#999" : "#555";
      }}
    >
      {props.children}
    </button>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 18, background: "#e5e5e5" }} />;
}

export default function ComposerActionRow({
  value,
  setValue,
  textareaRef,
  disabled = false,
  showCode = true,
}: Props) {
  function focusTextarea() {
    textareaRef.current?.focus();
  }

  function getSelection() {
    const el = textareaRef.current;
    if (!el) return { start: 0, end: 0, selected: "" };

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = value.slice(start, end);
    return { start, end, selected };
  }

  function replaceRange(start: number, end: number, insert: string, selectInserted = false) {
    const el = textareaRef.current;

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
    const el = textareaRef.current;
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

  // ---- actions ----
  function actionBold() {
    if (disabled) return;
    wrapSelection("**", "**", "bold");
  }

  function actionItalic() {
    if (disabled) return;
    wrapSelection("*", "*", "italic");
  }

  function actionSpoiler() {
    if (disabled) return;
    // matches your existing spoiler syntax
    wrapSelection("~! ", " !~", "spoiler");
  }

  function actionCode() {
    if (disabled) return;
    const { selected } = getSelection();
    if (selected.trim()) wrapSelection("```\n", "\n```", selected);
    else insertAtCursor("```\ncode\n```\n");
  }

  function actionLink() {
    if (disabled) return;

    const { start, end, selected } = getSelection();
    const text = selected.trim() ? selected.trim() : "link text";
    const url = window.prompt("Paste URL:", "https://");
    if (!url) return;

    replaceRange(start, end, `[${text}](${url.trim()})`, false);
    requestAnimationFrame(() => focusTextarea());
  }

  function actionImage() {
    if (disabled) return;

    const url = window.prompt("Paste image URL:", "https://");
    if (!url) return;

    insertAtCursor(`\n![](${url.trim()})\n`);
    requestAnimationFrame(() => focusTextarea());
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "0.15rem 0.6rem 0.45rem 0.6rem",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <ToolBtn title="Bold" onClick={actionBold} disabled={disabled}>
        <Bold width={18} height={18} strokeWidth={2} />
      </ToolBtn>

      <ToolBtn title="Italic" onClick={actionItalic} disabled={disabled}>
        <Italic width={18} height={18} strokeWidth={2} />
      </ToolBtn>

      <ToolBtn title="Spoiler" onClick={actionSpoiler} disabled={disabled}>
        <EyeOff width={18} height={18} strokeWidth={2} />
      </ToolBtn>

      <Divider />

      <ToolBtn title="Insert link" onClick={actionLink} disabled={disabled}>
        <Link2 width={18} height={18} strokeWidth={2} />
      </ToolBtn>

      <ToolBtn title="Insert image" onClick={actionImage} disabled={disabled}>
        <ImageIcon width={18} height={18} strokeWidth={2} />
      </ToolBtn>

      {showCode ? (
        <>
          <Divider />
          <ToolBtn title="Code block" onClick={actionCode} disabled={disabled}>
            <Code width={18} height={18} strokeWidth={2} />
          </ToolBtn>
        </>
      ) : null}

      <div style={{ flex: 1 }} />
    </div>
  );
}