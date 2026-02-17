// components/discover/DiscoverSection.tsx
"use client";

import React from "react";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export default function DiscoverSection({ title, subtitle, children }: Props) {
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <div className="text-lg font-semibold text-slate-900">{title}</div>
          {subtitle ? <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div> : null}
        </div>
      </div>

      {children}
    </section>
  );
}