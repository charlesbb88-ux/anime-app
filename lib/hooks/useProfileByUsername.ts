// lib/hooks/useProfileByUsername.ts
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type Profile = {
    id: string;
    username: string;
    avatar_url: string | null;
    created_at: string;

    backdrop_url: string | null;
    backdrop_pos_x: number | null;
    backdrop_pos_y: number | null;
    backdrop_zoom: number | null;

    about_markdown: string | null;
    about_html: string | null;

    followers_count: number;
    following_count: number;

        pinned_post_id: string | null;
};

export function useProfileByUsername(unameLower: string) {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (!unameLower) return;

        let cancelled = false;

        async function loadProfile() {
            setLoadingProfile(true);
            setNotFound(false);

const { data: row, error } = await supabase
    .from("profiles")
    .select(
        "id, username, avatar_url, created_at, backdrop_url, backdrop_pos_x, backdrop_pos_y, backdrop_zoom, about_markdown, about_html, followers_count, following_count, pinned_post_id"
    )
    .eq("username", unameLower)
    .maybeSingle();

            if (cancelled) return;

            if (error || !row) {
                setProfile(null);
                setNotFound(true);
                setLoadingProfile(false);
                return;
            }

            setProfile(row as Profile);
            setLoadingProfile(false);
        }

        loadProfile();

        return () => {
            cancelled = true;
        };
    }, [unameLower]);

    return { profile, loadingProfile, notFound };
}