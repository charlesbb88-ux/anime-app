"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { openAuthModal } from "@/lib/openAuthModal";

type Props = {
    children: React.ReactNode;
    exemptSelector?: string; // optional: allow some elements to bypass auth
};

export default function AuthGate({ children, exemptSelector }: Props) {
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            setUser(data.user ?? null);
        });

        const { data: listener } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setUser(session?.user ?? null);
            }
        );

        return () => listener?.subscription.unsubscribe();
    }, []);

    const intercept = (e: React.SyntheticEvent) => {
        if (user) return;

        // Optional bypass support
        if (exemptSelector) {
            const target = e.target as HTMLElement;
            if (target.closest(exemptSelector)) return;
        }

        e.preventDefault();
        e.stopPropagation();

        // Block other click handlers
        // @ts-ignore
        if (typeof e.nativeEvent?.stopImmediatePropagation === "function") {
            // @ts-ignore
            e.nativeEvent.stopImmediatePropagation();
        }

        openAuthModal();
    };

    return (
        <div
            style={{ display: "contents" }}
            onClickCapture={intercept}
            onMouseDownCapture={intercept}
        >
            {children}
        </div>
    );
}
