"use client";

import React from "react";
import { pickEnglishTitle } from "@/lib/pickEnglishTitle";

type Props = {
  titles: Record<string, string | null | undefined>;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
  fallback?: string;
};

export default function EnglishTitle({
  titles,
  className,
  as: Tag = "span",
  fallback = "",
}: Props) {
  const picked = pickEnglishTitle(titles);
  const text = picked?.value ?? fallback;

  return <Tag className={className}>{text}</Tag>;
}
