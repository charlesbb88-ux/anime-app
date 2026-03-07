"use client";

import ReviewPostRow from "./ReviewPostRow";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { openAuthModal } from "../lib/openAuthModal";
import CommentRow from "./CommentRow";
import InfiniteSentinel from "./InfiniteSentinel";
import FeedComposer from "./FeedComposer";
import { insertAttachments, type PendingAttachment } from "@/lib/postAttachments";

type Post = {
  id: string;

  content: string; // legacy
  content_text?: string | null;
  content_json?: any | null;
  content_html?: string | null;

  created_at: string;
  user_id: string;

  anime_id: string | null;
  anime_episode_id: string | null;

  // ⭐ NEW (manga side)
  manga_id: string | null;
  manga_chapter_id: string | null;

  // ✅ review link (posts.review_id → reviews.id)
  review_id: string | null;

  // home-feed RPC fields
  seen_group?: number;
  rank_score?: number;
};

type Like = {
  post_id: string;
  user_id: string;
};

type CommentMeta = {
  post_id: string;
  parent_comment_id: string | null;
};

type Profile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
};

type AnimeMeta = {
  slug: string | null;
  titleEnglish: string | null;
  title: string | null;
  imageUrl: string | null;
};

type EpisodeMeta = {
  episodeNumber: number | null;
};

// ⭐ NEW (manga meta)
type MangaMeta = {
  slug: string | null;
  titleEnglish: string | null;
  title: string | null;

  // ✅ poster support for manga
  imageUrl: string | null;
};

type ChapterMeta = {
  chapterNumber: number | null;
};

type ReviewRow = {
  id: string;
  rating: number | null;
  content: string | null;
  contains_spoilers: boolean | null;
  created_at: string | null;

  // ✅ NEW: snapshot like stored on review
  author_liked: boolean | null;
};

type PostAttachmentRow = {
  id: string;
  post_id: string;
  kind: "image" | "youtube";
  url: string;
  meta: any;
  sort_order: number;
  created_at: string;
};

const TYPO = {
  base: "1rem",
  small: "0.9rem",
};

const INITIAL_LIMIT = 20;
const PAGE_SIZE = 20;

type PostFeedProps = {
  animeId?: string;
  animeEpisodeId?: string;

  // ⭐ NEW (manga pages)
  mangaId?: string;
  mangaChapterId?: string;
};

function ImpressionWrap({
  postId,
  onSeen,
  children,
}: {
  postId: string;
  onSeen?: (postId: string) => void;
  children: React.ReactNode;
}) {
  const rowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!onSeen) return;

    const el = rowRef.current;
    if (!el) return;

    let fired = false;

    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        if (fired) return;

        fired = true;
        onSeen(postId);
        obs.disconnect();
      },
      {
        root: null,
        rootMargin: "0px 0px",
        threshold: 0.01,
      }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [onSeen, postId]);

  return <div ref={rowRef}>{children}</div>;
}

export default function PostFeed({
  animeId,
  animeEpisodeId,
  mangaId,
  mangaChapterId,
}: PostFeedProps) {
  const router = useRouter();
  const isGlobal = !animeId && !animeEpisodeId && !mangaId && !mangaChapterId;
  const queuedImpressionIdsRef = useRef<Set<string>>(new Set());
  const seenThisSessionRef = useRef<Set<string>>(new Set());

  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [postContentJson, setPostContentJson] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [posting, setPosting] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  // post.id -> rendered attachments rows
  const [attachmentsByPostId, setAttachmentsByPostId] = useState<
    Record<string, PostAttachmentRow[]>
  >({});

  // post.id -> review row
  const [reviewsByPostId, setReviewsByPostId] = useState<Record<string, ReviewRow>>(
    {}
  );

  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedByMe, setLikedByMe] = useState<Record<string, boolean>>({});
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});

  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);

  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursorSeenGroup, setCursorSeenGroup] = useState<number | null>(null);
  const [cursorScore, setCursorScore] = useState<number | null>(null);
  const [cursorCreatedAt, setCursorCreatedAt] = useState<string | null>(null);
  const [cursorId, setCursorId] = useState<string | null>(null);

  const [usernamesById, setUsernamesById] = useState<Record<string, string>>({});
  const [avatarUrlsById, setAvatarUrlsById] = useState<Record<string, string | null>>(
    {}
  );

  const [currentUserAvatarUrl, setCurrentUserAvatarUrl] = useState<string | null>(
    null
  );
  const [currentUserUsername, setCurrentUserUsername] = useState<string | null>(
    null
  );

  // anime_id → anime meta (slug + titles + image_url)
  const [animeMetaById, setAnimeMetaById] = useState<Record<string, AnimeMeta>>(
    {}
  );

  // anime_episode_id → episode metadata
  const [episodeMetaById, setEpisodeMetaById] = useState<Record<string, EpisodeMeta>>(
    {}
  );

  // ⭐ NEW: manga_id → manga meta
  const [mangaMetaById, setMangaMetaById] = useState<Record<string, MangaMeta>>(
    {}
  );

  // ⭐ NEW: manga_chapter_id → chapter meta
  const [chapterMetaById, setChapterMetaById] = useState<Record<string, ChapterMeta>>(
    {}
  );

  // -------------------------------
  // AUTH LISTENER
  // -------------------------------
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthChecked(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthChecked(true);
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isGlobal || !user?.id) return;

    function handleBeforeUnload() {
      void flushQueuedImpressions();
    }

    function handlePageHide() {
      void flushQueuedImpressions();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        void flushQueuedImpressions();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isGlobal, user?.id]);

  // -------------------------------
  // LOAD CURRENT USER PROFILE
  // -------------------------------
  useEffect(() => {
    if (!user || !user.id) {
      setCurrentUserAvatarUrl(null);
      setCurrentUserUsername(null);
      return;
    }

    async function loadSelfProfile() {
      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url, username")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error loading current user profile:", error);
        setCurrentUserAvatarUrl(null);
        setCurrentUserUsername(null);
        return;
      }

      setCurrentUserAvatarUrl(data?.avatar_url ?? null);
      setCurrentUserUsername(data?.username?.trim() || null);
    }

    loadSelfProfile();
  }, [user]);

  // -------------------------------
  // FETCH FEED
  // -------------------------------
  useEffect(() => {
    if (isGlobal && !authChecked) return;

    fetchFeed("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animeId, animeEpisodeId, mangaId, mangaChapterId, authChecked, user?.id]);

  useEffect(() => {
    if (!isGlobal) return;
    if (!authChecked) return;
    if (!user?.id) return;

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [isGlobal, authChecked, user?.id]);

  // -------------------------------
  // LOAD REVIEWS FOR POSTS (posts.review_id → reviews.id)
  // -------------------------------
  useEffect(() => {
    if (posts.length === 0) {
      setReviewsByPostId({});
      return;
    }

    const pairs = posts
      .filter((p) => !!p.review_id)
      .map((p) => ({ postId: p.id, reviewId: p.review_id as string }));

    if (pairs.length === 0) {
      setReviewsByPostId({});
      return;
    }

    const uniqueReviewIds = Array.from(new Set(pairs.map((x) => x.reviewId)));

    async function loadReviewsById() {
      const { data, error } = await supabase
        .from("reviews")
        // ✅ include author_liked
        .select("id, rating, content, contains_spoilers, created_at, author_liked")
        .in("id", uniqueReviewIds);

      if (error) {
        console.error("Error loading reviews:", error);
        setReviewsByPostId({});
        return;
      }

      const reviewById: Record<string, ReviewRow> = {};
      (data || []).forEach((r: any) => {
        if (!r?.id) return;
        reviewById[r.id] = {
          id: r.id,
          rating: r.rating ?? null,
          content: r.content ?? null,
          contains_spoilers: r.contains_spoilers ?? null,
          created_at: r.created_at ?? null,
          author_liked: r.author_liked ?? null,
        };
      });

      const map: Record<string, ReviewRow> = {};
      pairs.forEach(({ postId, reviewId }) => {
        const found = reviewById[reviewId];
        if (found) map[postId] = found;
      });

      setReviewsByPostId(map);
    }

    loadReviewsById();
  }, [posts]);

  // -------------------------------
  // FETCH likedByMe
  // -------------------------------
  useEffect(() => {
    if (user && user.id) fetchLikedByMe(user.id);
    else setLikedByMe({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // -------------------------------
  // CLOSE MENU ON OUTSIDE CLICK
  // -------------------------------
  useEffect(() => {
    if (!openMenuPostId) return;

    function handleClick() {
      setOpenMenuPostId(null);
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [openMenuPostId]);

  // ============================================================
  // FETCH FEED (GLOBAL / ANIME / EPISODE / MANGA / CHAPTER)
  // ============================================================
  async function fetchFeed(mode: "initial" | "more" = "initial") {
    const isInitial = mode === "initial";

    if (isInitial) {
      setIsLoadingPosts(true);
      setHasMore(true);
      setCursorSeenGroup(null);
      setCursorScore(null);
      setCursorCreatedAt(null);
      setCursorId(null);
      setAttachmentsByPostId({});
    } else {
      if (loadingMore) return;
      if (!hasMore) return;
      if (!cursorCreatedAt || !cursorId) return;
      setLoadingMore(true);
    }

    try {
      const limit = isInitial ? INITIAL_LIMIT : PAGE_SIZE;
      const useHomeFeedRpc = isGlobal;

      let postsData: any[] | null = null;
      let postsError: any = null;

      if (useHomeFeedRpc) {
        const { data, error } = await supabase.rpc("get_home_feed", {
          p_user_id: user?.id ?? null,
          p_limit: limit,
          p_cursor_seen_group: isInitial ? null : cursorSeenGroup,
          p_cursor_score: isInitial ? null : cursorScore,
          p_cursor_created_at: isInitial ? null : cursorCreatedAt,
          p_cursor_id: isInitial ? null : cursorId,
        });

        postsData = data;
        postsError = error;
      } else {
        let query = supabase
          .from("posts")
          .select(
            "id, user_id, content, content_text, content_json, created_at, anime_id, anime_episode_id, manga_id, manga_chapter_id, review_id"
          )
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(limit);

        // filters (same as you already had)
        if (animeEpisodeId) query = query.eq("anime_episode_id", animeEpisodeId);
        else if (animeId) query = query.eq("anime_id", animeId);
        else if (mangaChapterId) query = query.eq("manga_chapter_id", mangaChapterId);
        else if (mangaId) query = query.eq("manga_id", mangaId);

        // ✅ keyset pagination: older than the current cursor
        if (!isInitial && cursorCreatedAt && cursorId) {
          query = query.or(
            `created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`
          );
        }

        const { data, error } = await query;
        postsData = data;
        postsError = error;
      }

      if (postsError) {
        console.error("Error fetching posts:", postsError);
        console.error("PostgREST message:", (postsError as any)?.message);
        console.error("PostgREST details:", (postsError as any)?.details);
        console.error("PostgREST hint:", (postsError as any)?.hint);
        if (isInitial) setPosts([]);
        setHasMore(false);
        return;
      }

      const newPosts = (postsData || []) as Post[];

      if (
        isInitial &&
        useHomeFeedRpc &&
        user?.id &&
        typeof window !== "undefined" &&
        window.innerWidth <= 768
      ) {
        newPosts.slice(0, 4).forEach((p) => recordImpression(p.id));
      }

      // ✅ append / replace, and track exactly which posts were truly added
      let addedPosts: Post[] = [];

      const nextPostList = isInitial
        ? (() => {
          addedPosts = newPosts;
          return newPosts;
        })()
        : (() => {
          const seen = new Set(posts.map((p) => p.id));
          const merged = [...posts];

          for (const p of newPosts) {
            if (!seen.has(p.id)) {
              merged.push(p);
              seen.add(p.id);
              addedPosts.push(p);
            }
          }

          return merged;
        })();

      setPosts(nextPostList);

      // ✅ update cursor from the LAST ROW RETURNED BY THIS FETCH
      const last = newPosts[newPosts.length - 1];
      setCursorSeenGroup(
        useHomeFeedRpc && typeof last?.seen_group === "number" ? last.seen_group : null
      );
      setCursorScore(
        useHomeFeedRpc && typeof last?.rank_score === "number" ? last.rank_score : null
      );
      setCursorCreatedAt(last?.created_at ?? null);
      setCursorId(last?.id ?? null);

      // ✅ if we got fewer than requested, no more pages
      if (newPosts.length < limit) setHasMore(false);

      // ------------------------------------------------------------
      // Now load metadata/likes/comments for the NEWLY ADDED posts only
      // ------------------------------------------------------------
      const newIds = addedPosts.map((p) => p.id);
      const newUserIds = Array.from(new Set(addedPosts.map((p) => p.user_id)));

      // -------------------------------
      // LOAD ATTACHMENTS for new posts
      // -------------------------------
      if (newIds.length > 0) {
        const { data: attRows, error: attErr } = await supabase
          .from("post_attachments")
          .select("id, post_id, kind, url, meta, sort_order, created_at, width, height")
          .in("post_id", newIds)
          .order("sort_order", { ascending: true });

        if (attErr) {
          console.error("Error loading attachments:", attErr);
        } else {
          setAttachmentsByPostId((prev) => {
            const next = isInitial ? {} : { ...prev };
            (attRows || []).forEach((r: any) => {
              const list = next[r.post_id] ? [...next[r.post_id]] : [];
              list.push(r);
              // keep sorted
              list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
              next[r.post_id] = list;
            });
            return next;
          });
        }
      }

      // likes counts for new posts
      if (newIds.length > 0) {
        const { data: likesData, error: likesError } = await supabase
          .from("likes")
          .select("post_id, user_id")
          .in("post_id", newIds);

        if (!likesError) {
          setLikeCounts((prev) => {
            const next = isInitial ? {} : { ...prev };
            newIds.forEach((id) => {
              next[id] = 0;
            });
            (likesData || []).forEach((l: Like) => {
              next[l.post_id] = (next[l.post_id] || 0) + 1;
            });
            return next;
          });
        }

        const { data: commentsData, error: commentsError } = await supabase
          .from("comments")
          .select("post_id, parent_comment_id")
          .in("post_id", newIds);

        if (!commentsError) {
          setReplyCounts((prev) => {
            const next = isInitial ? {} : { ...prev };
            newIds.forEach((id) => {
              next[id] = 0;
            });
            (commentsData || []).forEach((c: CommentMeta) => {
              if (c.parent_comment_id === null) {
                next[c.post_id] = (next[c.post_id] || 0) + 1;
              }
            });
            return next;
          });
        }
      }

      // profiles for new users
      if (newUserIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", newUserIds);

        if (!profilesError) {
          setUsernamesById((prev) => {
            const next = isInitial ? {} : { ...prev };
            (profilesData || []).forEach((profile: Profile) => {
              if (profile.username?.trim()) next[profile.id] = profile.username.trim();
            });
            return next;
          });

          setAvatarUrlsById((prev) => {
            const next = isInitial ? {} : { ...prev };
            (profilesData || []).forEach((profile: Profile) => {
              next[profile.id] = profile.avatar_url ?? null;
            });
            return next;
          });
        }
      }

      // anime meta for new posts only
      const uniqueAnimeIds = Array.from(
        new Set(addedPosts.map((p) => p.anime_id).filter((id): id is string => !!id))
      );

      if (uniqueAnimeIds.length > 0) {
        const { data: animeRows, error: animeError } = await supabase
          .from("anime")
          .select("id, slug, title, title_english, image_url")
          .in("id", uniqueAnimeIds);

        if (!animeError) {
          setAnimeMetaById((prev) => {
            const next = isInitial ? {} : { ...prev };
            (animeRows || []).forEach((row: any) => {
              if (!row.id) return;
              next[row.id] = {
                slug: row.slug ?? null,
                titleEnglish: row.title_english ?? null,
                title: row.title ?? null,
                imageUrl: row.image_url ?? null,
              };
            });
            return next;
          });
        }
      }

      // episode meta for new posts only
      const uniqueEpisodeIds = Array.from(
        new Set(
          addedPosts.map((p) => p.anime_episode_id).filter((id): id is string => !!id)
        )
      );

      if (uniqueEpisodeIds.length > 0) {
        const { data: episodeRows, error: episodeError } = await supabase
          .from("anime_episodes")
          .select("id, episode_number")
          .in("id", uniqueEpisodeIds);

        if (!episodeError) {
          setEpisodeMetaById((prev) => {
            const next = isInitial ? {} : { ...prev };
            (episodeRows || []).forEach((row: any) => {
              if (!row.id) return;
              next[row.id] = {
                episodeNumber:
                  typeof row.episode_number === "number"
                    ? row.episode_number
                    : row.episode_number !== null
                      ? Number(row.episode_number)
                      : null,
              };
            });
            return next;
          });
        }
      }

      // manga meta for new posts only
      const uniqueMangaIds = Array.from(
        new Set(addedPosts.map((p) => p.manga_id).filter((id): id is string => !!id))
      );

      if (uniqueMangaIds.length > 0) {
        const { data: mangaRows, error: mangaError } = await supabase
          .from("manga")
          .select("id, slug, title, title_english, image_url")
          .in("id", uniqueMangaIds);

        if (!mangaError) {
          setMangaMetaById((prev) => {
            const next = isInitial ? {} : { ...prev };
            (mangaRows || []).forEach((row: any) => {
              if (!row.id) return;
              next[row.id] = {
                slug: row.slug ?? null,
                titleEnglish: row.title_english ?? null,
                title: row.title ?? null,
                imageUrl: row.image_url ?? null,
              };
            });
            return next;
          });
        }
      }

      // chapter meta for new posts only
      const uniqueChapterIds = Array.from(
        new Set(
          addedPosts.map((p) => p.manga_chapter_id).filter((id): id is string => !!id)
        )
      );

      if (uniqueChapterIds.length > 0) {
        const { data: chapterRows, error: chapterError } = await supabase
          .from("manga_chapters")
          .select("id, chapter_number")
          .in("id", uniqueChapterIds);

        if (!chapterError) {
          setChapterMetaById((prev) => {
            const next = isInitial ? {} : { ...prev };
            (chapterRows || []).forEach((row: any) => {
              if (!row.id) return;
              next[row.id] = {
                chapterNumber:
                  typeof row.chapter_number === "number"
                    ? row.chapter_number
                    : row.chapter_number !== null
                      ? Number(row.chapter_number)
                      : null,
              };
            });
            return next;
          });
        }
      }
    } finally {
      if (isInitial) {
        setIsLoadingPosts(false);
      } else {
        setLoadingMore(false);
      }

      void flushQueuedImpressions();
    }
  }

  // ============================================================
  // LIKE STATUS
  // ============================================================
  async function fetchLikedByMe(currentUserId: string) {
    const { data, error } = await supabase
      .from("likes")
      .select("post_id")
      .eq("user_id", currentUserId);

    if (error) {
      console.error("Error fetching likedByMe:", error);
      return;
    }

    const map: Record<string, boolean> = {};
    (data || []).forEach((row: any) => {
      map[row.post_id] = true;
    });

    setLikedByMe(map);
  }

  // ============================================================
  // CREATE NEW POST
  // ============================================================
  async function handlePost() {
    if (!user) return;

    const trimmed = postContent.trim();
    if (!trimmed && pendingAttachments.length === 0) return;

    // block if already posting
    if (posting) return;

    // if anything is uploading, don’t allow another click
    const hasUploading = pendingAttachments.some((a: any) => a?.status === "uploading");
    if (hasUploading) return;

    setPosting(true);

    try {
      const payload: any = {
        user_id: user.id,
        content_text: trimmed || null,
        content_json: postContentJson,
        content: trimmed || "",
      };

      if (animeId) payload.anime_id = animeId;
      if (animeEpisodeId) payload.anime_episode_id = animeEpisodeId;
      if (mangaId) payload.manga_id = mangaId;
      if (mangaChapterId) payload.manga_chapter_id = mangaChapterId;

      const { data: created, error: insertErr } = await supabase
        .from("posts")
        .insert(payload)
        .select("id")
        .single();

      if (insertErr) throw insertErr;

      const postId = created.id as string;

      // ✅ upload + insert post_attachments rows
      if (pendingAttachments.length > 0) {
        // Mark all queued (clears stale error state when retrying)
        setPendingAttachments((prev) =>
          prev.map((a) => {
            if (a.kind === "youtube") {
              return {
                ...a,
                status: a.status === "uploading" ? "uploading" : "queued",
                error: null,
              };
            }

            // image
            return {
              ...a,
              status: a.status === "uploading" ? "uploading" : "queued",
              error: null,
            };
          })
        );

        await insertAttachments({
          supabase,
          postId,
          userId: user.id,
          attachments: pendingAttachments,

          // ✅ status updates by index
          onStatus: (index, patch) => {
            setPendingAttachments((prev) =>
              prev.map((a, i) => (i === index ? { ...a, ...patch } : a))
            );
          },
        });
      }

      // ✅ success: clear composer
      setPendingAttachments([]);
      setPostContent("");
      setPostContentJson(null);

      await fetchFeed("initial");
      if (user?.id) fetchLikedByMe(user.id);
    } catch (e: any) {
      console.error("Post failed:", e);

      // Keep pending list for retry; failed items are marked "error"
      window.alert(
        e?.message
          ? `Post failed: ${e.message}`
          : "Post failed. Your attachments are still here — press Post again to retry."
      );
    } finally {
      setPosting(false);
    }
  }
  // ============================================================
  // LIKE / UNLIKE
  // ============================================================
  async function toggleLike(postId: string, e?: any) {
    if (e) e.stopPropagation();

    if (!user) {
      openAuthModal();
      return;
    }

    const alreadyLiked = likedByMe[postId];

    if (alreadyLiked) {
      const { error } = await supabase
        .from("likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error unliking:", error);
        return;
      }

      setLikedByMe((prev) => ({ ...prev, [postId]: false }));
      setLikeCounts((prev) => ({
        ...prev,
        [postId]: Math.max(0, (prev[postId] || 1) - 1),
      }));
    } else {
      const { error } = await supabase.from("likes").insert({
        post_id: postId,
        user_id: user.id,
      });

      if (error) {
        console.error("Error liking:", error);
        return;
      }

      setLikedByMe((prev) => ({ ...prev, [postId]: true }));
      setLikeCounts((prev) => ({
        ...prev,
        [postId]: (prev[postId] || 0) + 1,
      }));
    }
  }

  // ============================================================
  // RECORD IMPRESSION (not used yet)
  // ============================================================
  function recordImpression(postId: string) {
    if (!isGlobal) return;
    if (!user?.id) return;
    if (seenThisSessionRef.current.has(postId)) return;

    seenThisSessionRef.current.add(postId);
    queuedImpressionIdsRef.current.add(postId);
  }

  async function flushQueuedImpressions() {
    const ids = Array.from(queuedImpressionIdsRef.current);
    if (ids.length === 0) return;
    if (!user?.id) return;

    queuedImpressionIdsRef.current.clear();

    const nowIso = new Date().toISOString();

    const rows = ids.map((postId) => ({
      user_id: user.id,
      post_id: postId,
      last_seen_at: nowIso,
    }));

    const { error } = await supabase
      .from("post_impressions")
      .upsert(rows, { onConflict: "user_id,post_id" });

    if (error) {
      console.error("Error flushing queued impressions:", error);
    }
  }

  // ============================================================
  // OPEN POST
  // ============================================================
  async function openPost(postId: string) {
    if (user?.id) {
      const { error } = await supabase.from("post_clicks").insert({
        post_id: postId,
        user_id: user.id,
      });

      if (error) {
        console.error("Error inserting post click:", error);
      }
    }

    router.push(`/posts/${postId}`);
  }

  function openPostFromIcon(postId: string, e: any) {
    e.stopPropagation();
    openPost(postId);
  }

  // ============================================================
  // MENU
  // ============================================================
  function toggleMenu(postId: string, e: any) {
    e.stopPropagation();
    setOpenMenuPostId((prev) => (prev === postId ? null : postId));
  }

  // ============================================================
  // EDIT / DELETE
  // ============================================================
  async function handleEditPost(post: Post, e: any) {
    e.stopPropagation();
    if (!user || user.id !== post.user_id) return;

    const next = window.prompt("Edit post:", post.content);
    if (next === null) return;

    const trimmed = next.trim();
    if (!trimmed) return;

    const { error } = await supabase
      .from("posts")
      .update({ content: trimmed })
      .eq("id", post.id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error updating post:", error);
      return;
    }

    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, content: trimmed } : p))
    );

    setOpenMenuPostId(null);
  }

  async function handleDeletePost(post: Post, e: any) {
    e.stopPropagation();
    if (!user || user.id !== post.user_id) return;

    const ok = window.confirm("Delete this post?");
    if (!ok) return;

    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", post.id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting post:", error);
      return;
    }

    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    setOpenMenuPostId(null);
  }

  // ============================================================
  // DISPLAY HELPERS
  // ============================================================
  function getHandle(userId: string): string | null {
    const username = usernamesById[userId];
    return username?.trim() || null;
  }

  function getDisplayName(userId: string) {
    const h = getHandle(userId);
    return h ? `@${h}` : `User-${userId.slice(0, 4)}`;
  }

  function getInitialFromUser(userObj: any) {
    const email: string = userObj?.email || "";
    const c = email.trim()[0];
    return c ? c.toUpperCase() : "U";
  }

  function getInitialFromUserId(userId: string) {
    const h = getHandle(userId);
    return h ? h.charAt(0).toUpperCase() : getDisplayName(userId)[0];
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <>
      <FeedComposer
        user={user}
        postContent={postContent}
        setPostContent={setPostContent}
        setPostContentJson={setPostContentJson}
        pendingAttachments={pendingAttachments}
        setPendingAttachments={setPendingAttachments}
        posting={posting}
        onPost={handlePost}
        animeId={animeId}
        animeEpisodeId={animeEpisodeId}
        mangaId={mangaId}
        mangaChapterId={mangaChapterId}
        currentUserAvatarUrl={currentUserAvatarUrl}
        currentUserUsername={currentUserUsername}
        typoBase={TYPO.base}
        typoSmall={TYPO.small}
      />
      {/* FEED */}
      <div>
        {isLoadingPosts ? null : posts.length === 0 ? (
          <p
            style={{
              fontSize: TYPO.base,
              color: "#555",

              // ✅ remove the gap + default <p> margins
              margin: 0,

              // ✅ keep your box styling
              border: "1px solid #000",
              padding: "0.9rem 1rem",
              background: "#fff",
            }}
          >
            No posts yet.
          </p>
        ) : (
          <>
            {posts.map((p) => {
              if (p.content_html) {
                console.log("HAS HTML", p.id, p.content_html.slice(0, 120));
              } else {
                console.log("NO HTML", p.id);
              }
              if (p.content_json) {
                console.log("JSON TYPE", typeof p.content_json);
                const s = typeof p.content_json === "string" ? p.content_json : JSON.stringify(p.content_json);
                console.log("JSON PREVIEW", p.id, s.slice(0, 250));
              } else {
                console.log("NO JSON", p.id);
              }

              console.log("ATT COUNT", p.id, (attachmentsByPostId[p.id] || []).length);
              const isOwner = user && user.id === p.user_id;
              const isMenuOpen = openMenuPostId === p.id;
              const likeCount = likeCounts[p.id] || 0;
              const liked = !!likedByMe[p.id];
              const replyCount = replyCounts[p.id] || 0;

              const handle = getHandle(p.user_id);
              const displayName = getDisplayName(p.user_id);
              const initial = getInitialFromUserId(p.user_id);

              const avatarUrl =
                avatarUrlsById[p.user_id] !== undefined
                  ? avatarUrlsById[p.user_id] || undefined
                  : undefined;

              // Pills + poster
              let originLabel: string | undefined;
              let originHref: string | undefined;
              let episodeLabel: string | undefined;
              let episodeHref: string | undefined;
              let posterUrl: string | null | undefined;

              // -------------------
              // ANIME pills
              // -------------------
              if (p.anime_id) {
                const meta = animeMetaById[p.anime_id];
                if (meta) {
                  const english = meta.titleEnglish?.trim();
                  originLabel =
                    english && english.length > 0 ? english : meta.title || undefined;

                  if (meta.slug) originHref = `/anime/${meta.slug}`;
                  posterUrl = meta.imageUrl ?? null;

                  if (p.anime_episode_id) {
                    const epMeta = episodeMetaById[p.anime_episode_id];

                    if (epMeta && epMeta.episodeNumber != null) {
                      episodeLabel = `Ep ${epMeta.episodeNumber}`;
                      if (meta.slug) {
                        episodeHref = `/anime/${meta.slug}/episode/${epMeta.episodeNumber}`;
                      }
                    } else {
                      const asNum = Number(p.anime_episode_id);
                      if (!Number.isNaN(asNum) && Number.isFinite(asNum)) {
                        episodeLabel = `Ep ${asNum}`;
                        if (meta.slug) {
                          episodeHref = `/anime/${meta.slug}/episode/${asNum}`;
                        }
                      }
                    }
                  }
                }
              }

              // -------------------
              // MANGA pills (only if NOT an anime post)
              // -------------------
              if (!p.anime_id && p.manga_id) {
                const meta = mangaMetaById[p.manga_id];
                if (meta) {
                  const english = meta.titleEnglish?.trim();
                  originLabel =
                    english && english.length > 0 ? english : meta.title || undefined;

                  if (meta.slug) originHref = `/manga/${meta.slug}`;
                  posterUrl = meta.imageUrl ?? null;

                  if (p.manga_chapter_id) {
                    const chMeta = chapterMetaById[p.manga_chapter_id];

                    if (chMeta && chMeta.chapterNumber != null) {
                      episodeLabel = `Ch ${chMeta.chapterNumber}`;
                      if (meta.slug) {
                        episodeHref = `/manga/${meta.slug}/chapter/${chMeta.chapterNumber}`;
                      }
                    } else {
                      const asNum = Number(p.manga_chapter_id);
                      if (!Number.isNaN(asNum) && Number.isFinite(asNum)) {
                        episodeLabel = `Ch ${asNum}`;
                        if (meta.slug) {
                          episodeHref = `/manga/${meta.slug}/chapter/${asNum}`;
                        }
                      }
                    }
                  }
                }
              }

              const review = reviewsByPostId[p.id];
              const atts = attachmentsByPostId[p.id] || [];

              return review ? (
                <ImpressionWrap postId={p.id} onSeen={recordImpression}>
                  <ReviewPostRow
                    key={p.id}
                    postId={p.id}
                    reviewId={review.id}
                    userId={p.user_id}
                    createdAt={p.created_at}
                    content={(review.content ?? p.content) as string}
                    contentText={p.content_text ?? null}
                    contentJson={p.content_json ?? null}
                    attachments={atts}
                    rating={review.rating}
                    containsSpoilers={!!review.contains_spoilers}
                    authorLiked={!!review.author_liked}
                    displayName={displayName}
                    initial={initial}
                    username={handle ?? undefined}
                    avatarUrl={avatarUrl ?? null}
                    originLabel={originLabel}
                    originHref={originHref}
                    episodeLabel={episodeLabel}
                    episodeHref={episodeHref}
                    posterUrl={posterUrl ?? null}
                    href={`/posts/${p.id}`}
                    isOwner={!!isOwner}
                    replyCount={replyCount}
                    likeCount={likeCount}
                    likedByMe={liked}
                    onRowClick={openPostFromIcon}
                    onReplyClick={openPostFromIcon}
                    onToggleLike={toggleLike}
                    onEdit={(id, e) => {
                      const post = posts.find((x) => x.id === id);
                      if (post) handleEditPost(post, e);
                    }}
                    onDelete={(id, e) => {
                      const post = posts.find((x) => x.id === id);
                      if (post) handleDeletePost(post, e);
                    }}
                    isMenuOpen={isMenuOpen}
                    onToggleMenu={toggleMenu}
                  />
                </ImpressionWrap>
              ) : (
                <ImpressionWrap postId={p.id} onSeen={recordImpression}>
                  <CommentRow
                    key={p.id}
                    id={p.id}
                    userId={p.user_id}
                    createdAt={p.created_at}
                    content={p.content}
                    contentText={p.content_text ?? null}
                    contentJson={p.content_json ?? null}
                    attachments={atts}
                    displayName={displayName}
                    initial={initial}
                    username={handle ?? undefined}
                    avatarUrl={avatarUrl}
                    isOwner={!!isOwner}
                    href={`/posts/${p.id}`}
                    replyCount={replyCount}
                    likeCount={likeCount}
                    likedByMe={liked}
                    onRowClick={openPostFromIcon}
                    onReplyClick={openPostFromIcon}
                    onToggleLike={toggleLike}
                    onEdit={(id, e) => {
                      const post = posts.find((x) => x.id === id);
                      if (post) handleEditPost(post, e);
                    }}
                    onDelete={(id, e) => {
                      const post = posts.find((x) => x.id === id);
                      if (post) handleDeletePost(post, e);
                    }}
                    isMenuOpen={isMenuOpen}
                    onToggleMenu={toggleMenu}
                    originLabel={originLabel}
                    originHref={originHref}
                    episodeLabel={episodeLabel}
                    episodeHref={episodeHref}
                  />
                </ImpressionWrap>
              );
            })}

            <InfiniteSentinel
              disabled={isLoadingPosts || loadingMore || !hasMore}
              onVisible={() => fetchFeed("more")}
            />

            {loadingMore && (
              <div style={{ padding: "0.75rem 0", fontSize: TYPO.small, color: "#666" }}>
                Loading more…
              </div>
            )}
          </>
        )
        }
      </div>
    </>
  );
}
