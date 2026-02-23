"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
    $getRoot,
    $createParagraphNode,
    $createTextNode,
    type LexicalEditor,
} from "lexical";

type Props = {
    valueText: string;
    setValueText: (v: string) => void;
    placeholder: string;
    active: boolean;
    onFocus: () => void;
    onBlur: () => void;
    typoBase: string;
    toolbar?: React.ReactNode;
    onEditorReady?: (editor: any) => void;

    // ✅ ADD
    setValueJson?: (json: any) => void;
};

function EditorReadyPlugin({
    onEditorReady,
}: {
    onEditorReady?: (editor: LexicalEditor) => void;
}) {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        onEditorReady?.(editor);
    }, [editor, onEditorReady]);

    return null;
}

/** Keeps Lexical editor content in sync with an external plain-text value. */
function SyncExternalTextPlugin({ valueText }: { valueText: string }) {
    const [editor] = useLexicalComposerContext();
    const lastAppliedRef = useRef<string>(valueText);

    useEffect(() => {
        if (valueText === lastAppliedRef.current) return;
        lastAppliedRef.current = valueText;

        editor.update(() => {
            const root = $getRoot();
            const current = root.getTextContent();
            if (current === valueText) return;

            root.clear();
            const p = $createParagraphNode();
            if (valueText) p.append($createTextNode(valueText));
            root.append(p);
        });
    }, [editor, valueText]);

    return null;
}

export default function ComposerRichEditor({
    valueText,
    setValueText,
    placeholder,
    active,
    onFocus,
    onBlur,
    typoBase,
    toolbar,
    onEditorReady,
    setValueJson,
}: Props) {
    const initialConfig = useMemo(
        () => ({
            namespace: "ComposerRichEditor",
            onError(error: Error) {
                // eslint-disable-next-line no-console
                console.error(error);
            },
            theme: {
                paragraph: "m-0",
                text: {
                    bold: "font-semibold",
                    italic: "italic",
                    underline: "underline",
                    strikethrough: "line-through",
                    code: "font-mono text-[0.95em] bg-neutral-100 px-1 py-[1px] rounded",
                },
            },
            editorState: () => {
                const root = $getRoot();
                if (root.getChildrenSize() === 0) {
                    const p = $createParagraphNode();
                    if (valueText) p.append($createTextNode(valueText));
                    root.append(p);
                }
            },
        }),
        // seed once; sync happens via plugin
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    const collapsed = !active;

    return (
        <LexicalComposer initialConfig={initialConfig}>
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    minHeight: collapsed ? 26 : 36,
                }}
                className={typoBase}
            >
                <RichTextPlugin
                    contentEditable={
                        <ContentEditable
                            className="outline-none whitespace-pre-wrap break-words bg-transparent"
                            spellCheck
                            onFocus={onFocus}
                            onBlur={onBlur}
                            style={{
                                fontSize: "1.05rem",
                                fontFamily: "inherit",
                                color: "#111",

                                height: collapsed ? 26 : "auto",
                                minHeight: collapsed ? 26 : 36,
                                lineHeight: collapsed ? "30px" : "1.5",

                                padding: collapsed ? 0 : "0.6rem 0",
                                overflow: "hidden",
                            }}
                        />
                    }
                    placeholder={
                        <div
                            style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                right: 0,
                                height: collapsed ? 26 : "auto",
                                lineHeight: collapsed ? "30px" : "1.5",
                                color: "#9ca3af",
                                fontSize: "1.05rem",
                                fontFamily: "inherit",
                                pointerEvents: "none",
                                userSelect: "none",
                                padding: collapsed ? 0 : "0.6rem 0",
                            }}
                        >
                            {placeholder}
                        </div>
                    }
                    ErrorBoundary={({ children }) => <>{children}</>}
                />

                <HistoryPlugin />

                <OnChangePlugin
                    onChange={(editorState) => {
                        // ✅ 1) send JSON to parent (no need to "read")
                        if (setValueJson) {
                            setValueJson(editorState.toJSON());
                        }

                        // ✅ 2) keep your plain text shadow
                        editorState.read(() => {
                            const text = $getRoot().getTextContent();
                            setValueText(text);
                        });
                    }}
                />

                <SyncExternalTextPlugin valueText={valueText} />
                <EditorReadyPlugin onEditorReady={onEditorReady} />

                {toolbar ? (
                    <div
                        style={{ marginTop: 0 }}
                        onMouseDown={(e) => {
                            // ✅ Keep focus in the editor when clicking toolbar buttons.
                            // Prevents the editor blur that collapses the composer while empty.
                            e.preventDefault();
                        }}
                    >
                        {toolbar}
                    </div>
                ) : null}
            </div>
        </LexicalComposer>
    );
}