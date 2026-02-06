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

    // prevents repeated fires while the sentinel remains intersecting
    const inflightRef = useRef(false);

    useEffect(() => {
        if (disabled) return;

        const el = ref.current;
        if (!el) return;

        inflightRef.current = false;

        const obs = new IntersectionObserver(
            (entries) => {
                const first = entries[0];
                if (!first?.isIntersecting) {
                    // once it leaves view, allow the next trigger
                    inflightRef.current = false;
                    return;
                }

                if (inflightRef.current) return;
                inflightRef.current = true;

                onVisible();
            },
            {
                root: null,
                rootMargin,
                // tiny threshold tends to behave better on mobile Safari than 0
                threshold: 0.01,
            }
        );

        // iOS Safari can be finicky if you observe immediately during layout churn
        const raf = requestAnimationFrame(() => {
            if (!el) return;
            obs.observe(el);
        });

        return () => {
            cancelAnimationFrame(raf);
            obs.disconnect();
        };
    }, [onVisible, disabled, rootMargin]);

    return (
        <div
            ref={ref}
            style={{
                width: "100%",
                height: 1,
                marginTop: -1,   // cancels the 1px height visually
                padding: 0,
                border: 0,
            }}
        />
    );
}
