"use client";

import React, { useEffect, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import type { LexicalEditor } from "lexical";
import {
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  COMMAND_PRIORITY_LOW,
  $getSelection,
  $isRangeSelection,
} from "lexical";

import { IconBold, IconItalic, IconPhoto, IconBrandYoutube } from "@tabler/icons-react";

type Props = {
  disabled?: boolean;
  onPickImages?: () => void;
  onAddYouTube?: () => void;

  // ✅ allows usage outside LexicalComposer
  editor?: LexicalEditor | null;
};

const ICON_SIZE = 26;
const ICON_STROKE = 1.8;

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
      onMouseDown={(e) => e.preventDefault()} // keep selection
      onClick={props.onClick}
      className={[
        "h-8 w-8 rounded-md transition",
        "disabled:opacity-50",
        active
          ? "bg-black text-white"
          : "bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-950",
      ].join(" ")}
      aria-pressed={active}
    >
      <span className="inline-flex items-center justify-center w-full h-full">{props.children}</span>
    </button>
  );
}

function ComposerActionRowLexicalBase(props: Props & { editor: LexicalEditor }) {
  const disabled = props.disabled ?? false;
  const editor = props.editor;

  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);

  function refocus() {
    editor.focus();
  }

  useEffect(() => {
    const readFormats = () => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        setIsBold(false);
        setIsItalic(false);
        return;
      }

      setIsBold(selection.hasFormat("bold"));
      setIsItalic(selection.hasFormat("italic"));
    };

    const unsubUpdate = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(readFormats);
    });

    const unsubSel = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        editor.getEditorState().read(readFormats);
        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    editor.getEditorState().read(readFormats);

    return () => {
      unsubUpdate();
      unsubSel();
    };
  }, [editor]);

  return (
    <div className="flex items-center gap-5 border border-slate-200 bg-white rounded-md">
      <ToolBtn
        title="Add media (images, GIFs, videos)"
        disabled={disabled}
        onClick={() => props.onPickImages?.()}
      >
        <IconPhoto size={ICON_SIZE} stroke={ICON_STROKE} />
      </ToolBtn>

      <ToolBtn title="Add YouTube" disabled={disabled} onClick={() => props.onAddYouTube?.()}>
        <IconBrandYoutube size={ICON_SIZE} stroke={ICON_STROKE} />
      </ToolBtn>

      <div className="h-5 w-px bg-slate-200" />

      <ToolBtn
        title="Bold"
        disabled={disabled}
        active={isBold}
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
          refocus();
        }}
      >
        <IconBold size={ICON_SIZE} stroke={ICON_STROKE} />
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
        <IconItalic size={ICON_SIZE} stroke={ICON_STROKE} />
      </ToolBtn>
    </div>
  );
}

/**
 * ✅ Default usage (inside LexicalComposer)
 * Keep using <ComposerActionRowLexical ... /> inside ComposerRichEditor.
 */
export default function ComposerActionRowLexical(props: Props) {
  const [editor] = useLexicalComposerContext();
  return <ComposerActionRowLexicalBase {...props} editor={editor} />;
}

/**
 * ✅ External usage (outside LexicalComposer)
 * Use this in FeedComposer bottom bar.
 */
export function ComposerActionRowLexicalExternal(props: Props) {
  const editor = props.editor;
  if (!editor) return null;
  return <ComposerActionRowLexicalBase {...props} editor={editor} />;
}