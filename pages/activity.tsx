"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import type { NextPage } from "next";

import { supabase } from "@/lib/supabaseClient";

type ActivityItem = {
  id: string;
  type: "anime_series" | "anime_episode" | "manga_series" | "manga_chapter";
  title: string;
  subLabel?: string;
  rating: number | null;
  note: string | null;
  logged_at: string;
  visibility: "public" | "friends" | "private";
};

const ActivityPage: NextPage = () => {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ActivityItem[]>([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const [
        animeSeries,
        animeEpisodes,
        mangaSeries,
        mangaChapters,
      ] = await Promise.all([
        supabase
          .from("anime_series_logs")
          .select(
            `
            id,
            logged_at,
            rating,
            note,
            visibility,
            anime:anime_id ( title_english )
          `
          )
          .eq("user_id", user.id),

        supabase
          .from("anime_episode_logs")
          .select(
            `
            id,
            logged_at,
            rating,
            note,
            visibility,
            episode:anime_episode_id ( episode_number ),
            anime:anime_id ( title_english )
          `
          )
          .eq("user_id", user.id),

        supabase
          .from("manga_series_logs")
          .select(
            `
            id,
            logged_at,
            rating,
            note,
            visibility,
            manga:manga_id ( title_english )
          `
          )
          .eq("user_id", user.id),

        supabase
          .from("manga_chapter_logs")
          .select(
            `
            id,
            logged_at,
            rating,
            note,
            visibility,
            chapter:manga_chapter_id ( chapter_number ),
            manga:manga_id ( title_english )
          `
          )
          .eq("user_id", user.id),
      ]);

      if (!mounted) return;

      const merged: ActivityItem[] = [];

      animeSeries.data?.forEach((row: any) => {
        merged.push({
          id: row.id,
          type: "anime_series",
          title: row.anime?.title_english ?? "Unknown anime",
          rating: row.rating,
          note: row.note,
          logged_at: row.logged_at,
          visibility: row.visibility,
        });
      });

      animeEpisodes.data?.forEach((row: any) => {
        merged.push({
          id: row.id,
          type: "anime_episode",
          title: row.anime?.title_english ?? "Unknown anime",
          subLabel: `Episode ${row.episode?.episode_number}`,
          rating: row.rating,
          note: row.note,
          logged_at: row.logged_at,
          visibility: row.visibility,
        });
      });

      mangaSeries.data?.forEach((row: any) => {
        merged.push({
          id: row.id,
          type: "manga_series",
          title: row.manga?.title_english ?? "Unknown manga",
          rating: row.rating,
          note: row.note,
          logged_at: row.logged_at,
          visibility: row.visibility,
        });
      });

      mangaChapters.data?.forEach((row: any) => {
        merged.push({
          id: row.id,
          type: "manga_chapter",
          title: row.manga?.title_english ?? "Unknown manga",
          subLabel: `Chapter ${row.chapter?.chapter_number}`,
          rating: row.rating,
          note: row.note,
          logged_at: row.logged_at,
          visibility: row.visibility,
        });
      });

      merged.sort(
        (a, b) =>
          new Date(b.logged_at).getTime() -
          new Date(a.logged_at).getTime()
      );

      setItems(merged);
      setLoading(false);
    }

    load();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
        Loading…
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        Activity
      </h1>

      {items.length === 0 ? (
        <div className="text-sm text-neutral-500">No logs yet.</div>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li
              key={`${item.type}-${item.id}`}
              className="rounded-md border border-neutral-800 p-4"
            >
              <div className="text-sm font-medium">
                {item.title}
                {item.subLabel && (
                  <span className="ml-2 text-neutral-400">
                    · {item.subLabel}
                  </span>
                )}
              </div>

              <div className="mt-1 text-xs text-neutral-500">
                {item.type.replace("_", " ")} ·{" "}
                {new Date(item.logged_at).toLocaleString()}
              </div>

              {item.rating !== null && (
                <div className="mt-2 text-sm">
                  Rating: {item.rating}
                </div>
              )}

              {item.note && (
                <div className="mt-1 text-sm text-neutral-400 line-clamp-2">
                  {item.note}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};

export default ActivityPage;
