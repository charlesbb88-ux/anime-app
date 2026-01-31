"use client";

import { useEffect, useRef } from "react";

type Props = {
  onVisible: () => void;
  disabled?: boolean;
  rootMargin?: string;
};

export default function InfiniteSentinel({
  onVisible,
  disabled = false,
  rootMargin = "800px 0px",
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (disabled) return;
        const first = entries[0];
        if (first?.isIntersecting) onVisible();
      },
      { root: null, rootMargin, threshold: 0 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [onVisible, disabled, rootMargin]);

  return <div ref={ref} style={{ height: 1 }} />;
}
