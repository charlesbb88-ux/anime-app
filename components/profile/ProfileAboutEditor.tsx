// components/profile/ProfileAboutEditor.tsx
"use client";

import React, { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  initialMarkdown: string;
};

export default function ProfileAboutEditor({ initialMarkdown }: Props) {
  const [value, setValue] = useState(initialMarkdown ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const chars = useMemo(() => value.length, [value]);

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

      setMsg("Saved.");
      setSaving(false);
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to save.");
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-white/90">About (Markdown)</h2>
        <div className="text-xs text-white/60">{chars.toLocaleString()}/20,000</div>
      </div>

      <div className="mt-3 grid gap-3">
        <textarea
          className="min-h-[200px] w-full rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white/90 outline-none focus:border-white/25"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`Write your profile about here.\n\nSupports Markdown: **bold**, *italic*, [links](https://...), and images: ![alt](https://...)`}
        />

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-black disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>

          {msg ? <div className="text-sm text-white/70">{msg}</div> : null}
        </div>

        <div className="text-xs text-white/50">
          Tip: images work like <span className="font-mono">![caption](https://...)</span>
        </div>
      </div>
    </section>
  );
}
