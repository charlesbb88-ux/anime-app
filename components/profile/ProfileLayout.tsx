"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import ProfileTopNav from "./ProfileTopNav";

type Profile = {
    id: string;
    username: string;
    avatar_url: string | null;
    bio: string | null;
};

type Props = {
    children:
    | React.ReactNode
    | ((args: { profile: Profile }) => React.ReactNode);

    activeTab?: "anime" | "watchlist" | "posts" | "journal" | "library" | "activity";
    maxWidthClassName?: string;
};

function getFirstQueryParam(param: string | string[] | undefined) {
    if (typeof param === "string") return param;
    if (Array.isArray(param)) return param[0] ?? "";
    return "";
}

export default function ProfileLayout({
    children,
    activeTab,
    maxWidthClassName = "max-w-6xl",
}: Props) {
    const router = useRouter();
    const rawUsername = getFirstQueryParam(router.query.username as any);

    const [profile, setProfile] = useState<Profile | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [notFound, setNotFound] = useState(false);

    const normalizedUsername = useMemo(() => {
        return (rawUsername?.trim?.() ?? "").trim();
    }, [rawUsername]);

    const unameLower = useMemo(() => {
        const u = normalizedUsername.trim();
        return u ? u.toLowerCase() : "";
    }, [normalizedUsername]);

    useEffect(() => {
        if (!unameLower) return;

        let cancelled = false;

        async function loadProfile() {
            setLoadingProfile(true);
            setNotFound(false);

            const { data, error } = await supabase
                .from("profiles")
                .select("id, username, avatar_url, bio")
                .eq("username", unameLower)
                .maybeSingle();

            if (cancelled) return;

            if (error || !data) {
                setProfile(null);
                setNotFound(true);
                setLoadingProfile(false);
                return;
            }

            setProfile(data as Profile);
            setLoadingProfile(false);
        }

        loadProfile();

        return () => {
            cancelled = true;
        };
    }, [unameLower]);

    if (loadingProfile) {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <p className="text-slate-600">Loading…</p>
            </main>
        );
    }

    if (notFound || !profile) {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <div className="bg-white shadow-sm rounded-xl px-6 py-5">
                    <p className="text-lg font-semibold text-slate-800 mb-2">User not found</p>
                    <p className="text-sm text-slate-500">
                        We couldn’t find a profile for{" "}
                        <span className="font-mono">@{normalizedUsername}</span>.
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen">
            <div className={`${maxWidthClassName} mx-auto px-4 py-8`}>
                <ProfileTopNav
                    username={profile.username}
                    avatarUrl={profile.avatar_url}
                    bio={profile.bio}
                />

                {/* Page-specific content goes here */}
                {typeof children === "function" ? children({ profile }) : children}
            </div>
        </main>
    );
}
