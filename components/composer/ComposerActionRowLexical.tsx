"use client";

import React, { useEffect, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  COMMAND_PRIORITY_LOW,
  $getSelection,
  $isRangeSelection,
} from "lexical";
import { TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";

type Props = {
  disabled?: boolean;
  showCode?: boolean;
};

function ToolBtn(props: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
}) {
  const active = !!props.active;

  return (
    <button
      type="button"
      title={props.title}
      disabled={props.disabled}
      onMouseDown={(e) => {
        // ✅ keep focus/selection in editor
        e.preventDefault();
      }}
      onClick={props.onClick}
      className={[
        "h-8 w-8 rounded-md border transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100",
        active
          ? "bg-black text-white border-black"
          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-950",
      ].join(" ")}
      aria-pressed={active}
    >
      <span className="inline-flex items-center justify-center w-full h-full">
        {props.children}
      </span>
    </button>
  );
}

export default function ComposerActionRowLexical({ disabled = false }: Props) {
  const [editor] = useLexicalComposerContext();

  // active marks
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isCode, setIsCode] = useState(false);

  function refocus() {
    editor.focus();
  }

  function toggleLink() {
    const url = window.prompt("Paste link URL:");
    if (!url) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
      refocus();
      return;
    }
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, url.trim());
    refocus();
  }

  // ✅ Keep toolbar state synced with current selection AND any editor updates
  useEffect(() => {
    const readFormats = () => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        setIsBold(false);
        setIsItalic(false);
        setIsUnderline(false);
        setIsStrikethrough(false);
        setIsCode(false);
        return;
      }

      setIsBold(selection.hasFormat("bold"));
      setIsItalic(selection.hasFormat("italic"));
      setIsUnderline(selection.hasFormat("underline"));
      setIsStrikethrough(selection.hasFormat("strikethrough"));
      setIsCode(selection.hasFormat("code"));
    };

    // Fires after FORMAT_TEXT_COMMAND updates editor state (even if selection didn't move)
    const unsubUpdate = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(readFormats);
    });

    // Still useful when you click around / change selection
    const unsubSel = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        editor.getEditorState().read(readFormats);
        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    // prime initial state once
    editor.getEditorState().read(readFormats);

    return () => {
      unsubUpdate();
      unsubSel();
    };
  }, [editor]);

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-xs border-2 border-black bg-white px-2 py-2">
      <ToolBtn
        title="Bold"
        disabled={disabled}
        active={isBold}
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
          refocus();
        }}
      >
        <span className="font-black">B</span>
      </ToolBtn>

      <ToolBtn
        title="Italic"
        disabled={disabled}
        active={isItalic}
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic");
          refocus();
        }}
      >
        <span className="italic font-semibold">I</span>
      </ToolBtn>

      <ToolBtn
        title="Underline"
        disabled={disabled}
        active={isUnderline}
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline");
          refocus();
        }}
      >
        <span className="underline font-semibold">U</span>
      </ToolBtn>

      <ToolBtn
        title="Strikethrough"
        disabled={disabled}
        active={isStrikethrough}
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough");
          refocus();
        }}
      >
        <span className="line-through font-semibold">S</span>
      </ToolBtn>

      <ToolBtn
        title="Code"
        disabled={disabled}
        active={isCode}
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code");
          refocus();
        }}
      >
        <span className="font-mono text-[0.9em]">{`</>`}</span>
      </ToolBtn>

      <div className="mx-1 h-5 w-px bg-slate-200" />

      <ToolBtn title="Link" disabled={disabled} onClick={toggleLink}>
        🔗
      </ToolBtn>

      <div className="mx-1 h-5 w-px bg-slate-200" />

      <ToolBtn
        title="Bulleted list"
        disabled={disabled}
        onClick={() => {
          editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
          refocus();
        }}
      >
        •
      </ToolBtn>

      <ToolBtn
        title="Numbered list"
        disabled={disabled}
        onClick={() => {
          editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
          refocus();
        }}
      >
        1.
      </ToolBtn>

      <ToolBtn
        title="Remove list"
        disabled={disabled}
        onClick={() => {
          editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
          refocus();
        }}
      >
        ⨯
      </ToolBtn>
    </div>
  );
}