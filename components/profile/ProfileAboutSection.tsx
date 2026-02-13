// components/profile/ProfileAboutSection.tsx
"use client";

import React from "react";

export default function ProfileAboutSection({ html }: { html: string }) {
  if (!html || html.trim().length === 0) return null;

  return (
    <section className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm text-white/90">
        <div
          className="prose prose-invert max-w-none prose-a:text-sky-300 prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg"
          // html is already sanitized server-side and stored
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </section>
  );
}
