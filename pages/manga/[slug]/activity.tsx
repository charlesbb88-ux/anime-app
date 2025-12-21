"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type ActivityItem =
  | {
      id: string;
      kind: "log";
      title: string;
      logged_at: string;
      visibility: "public" | "friends" | "private";
      note: string | null;
      rating: number | null;
      liked: boolean | null;
      review_id: string | null;
    }
  | {
      id: string;
      kind: "review";
      title: string;
      logged_at: string;
      rating: number | null;
      content: string | null;
      contains_spoilers: boolean;
    }
  | {
      id: string;
      kind: "mark";
      type: "watched" | "liked" | "watchlist" | "rating";
      title: string;
      logged_at: string;
      stars?: number | null;
    };

function formatRelativeShort(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay < 30) return `${diffDay}d`;

  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

const MangaSeriesActivityPage: NextPage = () => {
  const router = useRouter();
  const { slug } = router.query as { slug?: string };

  const [loading, setLoading] = useState(true);
  const [pageTitle, setPageTitle] = useState<string>("Your activity");
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (!user || userErr) {
        router.replace("/login");
        return;
      }

      if (!slug) {
        if (mounted) setLoading(false);
        return;
      }

      // lookup manga by slug
      const mangaRes = await supabase
        .from("manga")
        .select("id, title, title_english, title_native, title_preferred")
        .eq("slug", slug)
        .maybeSingle();

      if (!mounted) return;

      if (mangaRes.error || !mangaRes.data?.id) {
        setError("Manga not found.");
        setLoading(false);
        return;
      }

      const manga = mangaRes.data as any;
      const mangaTitle =
        manga?.title_english ||
        manga?.title_preferred ||
        manga?.title_native ||
        manga?.title ||
        "Unknown manga";

      setPageTitle(`Your activity · ${mangaTitle}`);

      const mangaId = manga.id as string;

      const [seriesLogs, seriesReviews, watchedMark, likedMark, watchlistMark, ratingMark] =
        await Promise.all([
          supabase
            .from("manga_series_logs")
            .select("id, logged_at, visibility, note, rating, liked, review_id")
            .eq("user_id", user.id)
            .eq("manga_id", mangaId)
            .order("logged_at", { ascending: false }),

          supabase
            .from("reviews")
            .select("id, created_at, rating, content, contains_spoilers")
            .eq("user_id", user.id)
            .eq("manga_id", mangaId)
            .is("manga_chapter_id", null)
            .order("created_at", { ascending: false }),

          supabase
            .from("user_marks")
            .select("id, created_at")
            .eq("user_id", user.id)
            .eq("kind", "watched")
            .eq("manga_id", mangaId)
            .is("manga_chapter_id", null)
            .is("anime_id", null)
            .is("anime_episode_id", null)
            .maybeSingle(),

          supabase
            .from("user_marks")
            .select("id, created_at")
            .eq("user_id", user.id)
            .eq("kind", "liked")
            .eq("manga_id", mangaId)
            .is("manga_chapter_id", null)
            .is("anime_id", null)
            .is("anime_episode_id", null)
            .maybeSingle(),

          supabase
            .from("user_marks")
            .select("id, created_at")
            .eq("user_id", user.id)
            .eq("kind", "watchlist")
            .eq("manga_id", mangaId)
            .is("manga_chapter_id", null)
            .is("anime_id", null)
            .is("anime_episode_id", null)
            .maybeSingle(),

          supabase
            .from("user_marks")
            .select("id, created_at, stars")
            .eq("user_id", user.id)
            .eq("kind", "rating")
            .eq("manga_id", mangaId)
            .is("manga_chapter_id", null)
            .is("anime_id", null)
            .is("anime_episode_id", null)
            .maybeSingle(),
        ]);

      if (!mounted) return;

      const merged: ActivityItem[] = [];

      if (watchedMark.data?.id) {
        merged.push({
          id: watchedMark.data.id,
          kind: "mark",
          type: "watched",
          title: mangaTitle,
          logged_at: watchedMark.data.created_at,
        });
      }

      if (likedMark.data?.id) {
        merged.push({
          id: likedMark.data.id,
          kind: "mark",
          type: "liked",
          title: mangaTitle,
          logged_at: likedMark.data.created_at,
        });
      }

      if (watchlistMark.data?.id) {
        merged.push({
          id: watchlistMark.data.id,
          kind: "mark",
          type: "watchlist",
          title: mangaTitle,
          logged_at: watchlistMark.data.created_at,
        });
      }

      if (ratingMark.data?.id) {
        merged.push({
          id: ratingMark.data.id,
          kind: "mark",
          type: "rating",
          title: mangaTitle,
          logged_at: ratingMark.data.created_at,
          stars: ratingMark.data.stars ?? null,
        });
      }

      seriesReviews.data?.forEach((row: any) => {
        merged.push({
          id: row.id,
          kind: "review",
          title: mangaTitle,
          logged_at: row.created_at,
          rating: typeof row.rating === "number" ? row.rating : null,
          content: row.content ?? null,
          contains_spoilers: Boolean(row.contains_spoilers),
        });
      });

      seriesLogs.data?.forEach((row: any) => {
        merged.push({
          id: row.id,
          kind: "log",
          title: mangaTitle,
          logged_at: row.logged_at,
          visibility: row.visibility,
          note: row.note ?? null,
          rating: row.rating ?? null,
          liked: row.liked ?? null,
          review_id: row.review_id ?? null,
        });
      });

      merged.sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());

      setItems(merged);
      setLoading(false);
    }

    run();

    return () => {
      mounted = false;
    };
  }, [router, slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
        Loading…
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4">
        <Link href={slug ? `/manga/${slug}` : "/"} className="text-sm text-blue-500 hover:underline">
          ← Back
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{pageTitle}</h1>

      {error ? (
        <div className="text-sm text-red-300">{error}</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-neutral-500">No activity yet.</div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="rounded-md border border-neutral-800 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm font-medium">
                  {item.kind === "mark" ? (
                    item.type === "watched" ? (
                      <>You marked <span className="font-bold text-black">{item.title}</span> as watched</>
                    ) : item.type === "liked" ? (
                      <>You liked <span className="font-bold text-black">{item.title}</span></>
                    ) : item.type === "watchlist" ? (
                      <>You added <span className="font-bold text-black">{item.title}</span> to your watchlist</>
                    ) : (
                      <>You rated <span className="font-bold text-black">{item.title}</span></>
                    )
                  ) : item.kind === "review" ? (
                    <>You reviewed <span className="font-bold text-black">{item.title}</span></>
                  ) : (
                    <>You logged <span className="font-bold text-black">{item.title}</span></>
                  )}
                </div>

                <div className="text-xs text-neutral-500 whitespace-nowrap">
                  {formatRelativeShort(item.logged_at)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};

export default MangaSeriesActivityPage;
