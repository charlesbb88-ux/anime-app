// components/composer/RichPostRenderer.tsx
"use client";

import React, { useMemo } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";

import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";

type Props = {
  json: any | null;
  fallbackText?: string | null;

  // match your current text styling behavior
  fontSize?: string; // e.g. "1rem"
  fontWeight?: number; // e.g. 400
  lineHeight?: number; // e.g. 1.5
};

function normalizeEditorState(json: any): string | null {
  if (!json) return null;

  // if DB returns it as already-stringified JSON
  if (typeof json === "string") return json;

  // if DB returns object, stringify it
  if (typeof json === "object") {
    try {
      return JSON.stringify(json);
    } catch {
      return null;
    }
  }

  return null;
}

export default function RichPostRenderer({
  json,
  fallbackText,
  fontSize = "1rem",
  fontWeight = 400,
  lineHeight = 1.5,
}: Props) {
  const editorState = useMemo(() => normalizeEditorState(json), [json]);
  const hasEditorState = !!editorState;

  // If no editorState, just render your old plain text exactly like before
  if (!hasEditorState) {
    return (
      <p
        style={{
          margin: 0,
          fontSize,
          fontWeight,
          lineHeight,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {fallbackText ?? ""}
      </p>
    );
  }

  const initialConfig = useMemo(
    () => ({
      namespace: "RichPostRenderer",
      editable: false,
      nodes: [LinkNode, ListNode, ListItemNode],
      theme: {
        paragraph: "m-0",
        text: {
          bold: "font-semibold",
          italic: "italic",
          underline: "underline",
          strikethrough: "line-through",
          code: "font-mono text-[0.95em] bg-neutral-100 px-1 py-[1px] rounded",
        },
        list: {
          ul: "list-disc pl-6 my-2",
          ol: "list-decimal pl-6 my-2",
          listitem: "my-1",
        },
        link: "text-blue-600 underline hover:text-blue-800",
      },
      onError(error: Error) {
        // eslint-disable-next-line no-console
        console.error(error);
      },
      editorState, // ✅ hydrate from normalized string
    }),
    [editorState]
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <RichTextPlugin
        contentEditable={
          <ContentEditable
            className="outline-none whitespace-pre-wrap break-words"
            style={{
              fontSize,
              fontWeight,
              lineHeight,
              fontFamily: "inherit",
              color: "#111",
              background: "transparent",
              // since editable: false, this is just extra safety
              pointerEvents: "none",
            }}
          />
        }
        placeholder={null}
        ErrorBoundary={LexicalErrorBoundary}
      />
      {/* harmless even in read-only; keeps Lexical happy */}
      <HistoryPlugin />
    </LexicalComposer>
  );
}