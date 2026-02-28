// lib/hooks/useUserPosts.ts

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Post = {
  id: string;
  content: string;
  content_text?: string | null;
  content_json?: any | null;

  created_at: string;
  user_id: string;

  anime_id: string | null;
  anime_episode_id: string | null;

  manga_id: string | null;
  manga_chapter_id: string | null;

  review_id: string | null;
};

type LikeRow = { post_id: string; user_id: string };
type CommentMeta = { post_id: string; parent_comment_id: string | null };

type AnimeMeta = {
  slug: string | null;
  titleEnglish: string | null;
  title: string | null;
  imageUrl: string | null;
};
type EpisodeMeta = { episodeNumber: number | null };

type MangaMeta = {
  slug: string | null;
  titleEnglish: string | null;
  title: string | null;
  imageUrl: string | null;
};
type ChapterMeta = { chapterNumber: number | null };

type ReviewRow = {
  id: string;
  rating: number | null;
  content: string | null;
  contains_spoilers: boolean | null;
  created_at: string | null;
  author_liked: boolean | null;
};

export function useUserPosts(profileId: string | null, currentUserId: string | null) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);

  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});
  const [likedByMe, setLikedByMe] = useState<Record<string, boolean>>({});

  const [reviewsByPostId, setReviewsByPostId] = useState<Record<string, ReviewRow>>(
    {}
  );

  const [animeMetaById, setAnimeMetaById] = useState<Record<string, AnimeMeta>>(
    {}
  );
  const [episodeMetaById, setEpisodeMetaById] = useState<
    Record<string, EpisodeMeta>
  >({});
  const [mangaMetaById, setMangaMetaById] = useState<Record<string, MangaMeta>>(
    {}
  );
  const [chapterMetaById, setChapterMetaById] = useState<
    Record<string, ChapterMeta>
  >({});

  useEffect(() => {
    if (!profileId) return;

    let cancelled = false;

    async function loadUserPosts() {
      setIsLoadingPosts(true);

      try {
const { data: postRows, error: postsError } = await supabase
  .from("posts")
  .select(
    "id, content, content_text, content_json, created_at, user_id, anime_id, anime_episode_id, manga_id, manga_chapter_id, review_id"
  )
  .eq("user_id", profileId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (cancelled) return;

        if (postsError) {
          setPosts([]);
          setLikeCounts({});
          setReplyCounts({});
          setLikedByMe({});
          setReviewsByPostId({});
          setAnimeMetaById({});
          setEpisodeMetaById({});
          setMangaMetaById({});
          setChapterMetaById({});
          return;
        }

        const postList = (postRows || []) as Post[];
        setPosts(postList);

        if (postList.length === 0) {
          setLikeCounts({});
          setReplyCounts({});
          setLikedByMe({});
          setReviewsByPostId({});
          setAnimeMetaById({});
          setEpisodeMetaById({});
          setMangaMetaById({});
          setChapterMetaById({});
          return;
        }

        const postIds = postList.map((p) => p.id);

        const [{ data: likesData }, { data: commentsData }] = await Promise.all([
          supabase.from("likes").select("post_id, user_id").in("post_id", postIds),
          supabase
            .from("comments")
            .select("post_id, parent_comment_id")
            .in("post_id", postIds),
        ]);

        if (cancelled) return;

        const likeMap: Record<string, number> = {};
        (likesData || []).forEach((l: LikeRow) => {
          likeMap[l.post_id] = (likeMap[l.post_id] || 0) + 1;
        });
        setLikeCounts(likeMap);

        const replyMap: Record<string, number> = {};
        (commentsData || []).forEach((c: CommentMeta) => {
          if (c.parent_comment_id === null) {
            replyMap[c.post_id] = (replyMap[c.post_id] || 0) + 1;
          }
        });
        setReplyCounts(replyMap);

        if (currentUserId) {
          const { data: mineLikes } = await supabase
            .from("likes")
            .select("post_id")
            .eq("user_id", currentUserId)
            .in("post_id", postIds);

          if (!cancelled) {
            const mine: Record<string, boolean> = {};
            (mineLikes || []).forEach((r: any) => {
              if (r?.post_id) mine[r.post_id] = true;
            });
            setLikedByMe(mine);
          }
        } else {
          setLikedByMe({});
        }

        const pairs = postList
          .filter((p) => !!p.review_id)
          .map((p) => ({ postId: p.id, reviewId: p.review_id as string }));

        if (pairs.length === 0) {
          setReviewsByPostId({});
        } else {
          const uniqueReviewIds = Array.from(new Set(pairs.map((x) => x.reviewId)));

const { data: reviewRows } = await supabase
  .from("reviews")
  .select("id, rating, content, contains_spoilers, created_at, author_liked")
  .in("id", uniqueReviewIds);

          if (!cancelled) {
            const byId: Record<string, ReviewRow> = {};
            (reviewRows || []).forEach((r: any) => {
              if (!r?.id) return;
byId[r.id] = {
  id: r.id,
  rating: r.rating ?? null,
  content: r.content ?? null,
  contains_spoilers: r.contains_spoilers ?? null,
  created_at: r.created_at ?? null,
  author_liked: r.author_liked ?? null,
};
            });

            const byPost: Record<string, ReviewRow> = {};
            pairs.forEach(({ postId, reviewId }) => {
              const found = byId[reviewId];
              if (found) byPost[postId] = found;
            });

            setReviewsByPostId(byPost);
          }
        }

        const uniqueAnimeIds = Array.from(
          new Set(postList.map((p) => p.anime_id).filter((id): id is string => !!id))
        );
        const uniqueEpisodeIds = Array.from(
          new Set(
            postList
              .map((p) => p.anime_episode_id)
              .filter((id): id is string => !!id)
          )
        );
        const uniqueMangaIds = Array.from(
          new Set(postList.map((p) => p.manga_id).filter((id): id is string => !!id))
        );
        const uniqueChapterIds = Array.from(
          new Set(
            postList
              .map((p) => p.manga_chapter_id)
              .filter((id): id is string => !!id)
          )
        );

        const [animeRes, episodeRes, mangaRes, chapterRes] = await Promise.all([
          uniqueAnimeIds.length
            ? supabase.from("anime").select("id, slug, title, title_english, image_url").in("id", uniqueAnimeIds)
            : Promise.resolve({ data: [] as any[] }),
          uniqueEpisodeIds.length
            ? supabase.from("anime_episodes").select("id, episode_number").in("id", uniqueEpisodeIds)
            : Promise.resolve({ data: [] as any[] }),
          uniqueMangaIds.length
            ? supabase.from("manga").select("id, slug, title, title_english, image_url").in("id", uniqueMangaIds)
            : Promise.resolve({ data: [] as any[] }),
          uniqueChapterIds.length
            ? supabase.from("manga_chapters").select("id, chapter_number").in("id", uniqueChapterIds)
            : Promise.resolve({ data: [] as any[] }),
        ]);

        if (cancelled) return;

        const aMap: Record<string, AnimeMeta> = {};
        (animeRes.data || []).forEach((row: any) => {
          if (!row?.id) return;
          aMap[row.id] = {
            slug: row.slug ?? null,
            titleEnglish: row.title_english ?? null,
            title: row.title ?? null,
            imageUrl: row.image_url ?? null,
          };
        });
        setAnimeMetaById(aMap);

        const eMap: Record<string, EpisodeMeta> = {};
        (episodeRes.data || []).forEach((row: any) => {
          if (!row?.id) return;
          eMap[row.id] = {
            episodeNumber:
              typeof row.episode_number === "number"
                ? row.episode_number
                : row.episode_number !== null
                ? Number(row.episode_number)
                : null,
          };
        });
        setEpisodeMetaById(eMap);

        const mMap: Record<string, MangaMeta> = {};
        (mangaRes.data || []).forEach((row: any) => {
          if (!row?.id) return;
          mMap[row.id] = {
            slug: row.slug ?? null,
            titleEnglish: row.title_english ?? null,
            title: row.title ?? null,
            imageUrl: row.image_url ?? null,
          };
        });
        setMangaMetaById(mMap);

        const cMap: Record<string, ChapterMeta> = {};
        (chapterRes.data || []).forEach((row: any) => {
          if (!row?.id) return;
          cMap[row.id] = {
            chapterNumber:
              typeof row.chapter_number === "number"
                ? row.chapter_number
                : row.chapter_number !== null
                ? Number(row.chapter_number)
                : null,
          };
        });
        setChapterMetaById(cMap);
      } finally {
        if (!cancelled) setIsLoadingPosts(false);
      }
    }

    loadUserPosts();

    return () => {
      cancelled = true;
    };
  }, [profileId, currentUserId]);

  return {
    posts,
    setPosts,
    isLoadingPosts,
    likeCounts,
    setLikeCounts,
    replyCounts,
    likedByMe,
    setLikedByMe,
    reviewsByPostId,
    animeMetaById,
    episodeMetaById,
    mangaMetaById,
    chapterMetaById,
  };
}

// ✅ also default-export it so either import style works
export default useUserPosts;
