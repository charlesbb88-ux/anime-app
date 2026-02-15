// components/profile/ProfileAboutSection.tsx
"use client";

import React from "react";

export default function ProfileAboutSection({ html }: { html: string }) {
  if (!html || html.trim().length === 0) return null;

  return (
    <section className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm text-white/90">
        <div
          className={[
            // typography
            "prose prose-invert max-w-none",
            "prose-a:text-sky-300 prose-a:no-underline hover:prose-a:underline",
            "prose-img:rounded-lg",

            "[&_a]:text-sky-400 [&_a]:underline [&_a:hover]:text-sky-300",

            "[&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2",
            "[&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2",
            "[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-2",
            "[&_h4]:text-sm [&_h4]:font-semibold [&_h4]:mt-2 [&_h4]:mb-2",

            // ✅ IMPORTANT: Tailwind preflight removes list markers.
            // These selector utilities force them back on, even without typography variants.
            "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-3",
            "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3",
            "[&_li]:my-1",
          ].join(" ")}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </section>
  );
}