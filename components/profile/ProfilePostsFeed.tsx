// components/profile/ProfilePostsFeed.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { openAuthModal } from "@/lib/openAuthModal";

import CommentRow from "@/components/CommentRow";
import ReviewPostRow from "@/components/ReviewPostRow";
import InfiniteSentinel from "@/components/InfiniteSentinel";

import { useUserPosts } from "@/lib/hooks/useUserPosts";
import { derivePostOrigin, type Post as FeedPost } from "@/lib/posts/derivePostOrigin";

const PAGE_SIZE = 20;

type PostAttachmentRow = {
  id: string;
  post_id: string;
  kind: "image" | "gif" | "youtube" | "video";
  url: string;
  meta: any;
  sort_order: number;
  created_at: string;
  width?: number | null;
  height?: number | null;
};

type AttachmentsByPostId = Record<string, PostAttachmentRow[]>;

type Props = {
  profileId: string;
  viewerUserId: string | null;

  displayName: string;
  avatarInitial: string;
  canonicalHandle?: string;
  avatarUrl: string | null;
};

export default function ProfilePostsFeed({
  profileId,
  viewerUserId,
  displayName,
  avatarInitial,
  canonicalHandle,
  avatarUrl,
}: Props) {
  const router = useRouter();

  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);

  const [attachmentsByPostId, setAttachmentsByPostId] = useState<AttachmentsByPostId>({});

  // ✅ infinite scroll state
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursorCreatedAt, setCursorCreatedAt] = useState<string | null>(null);
  const [cursorId, setCursorId] = useState<string | null>(null);

  const {
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
  } = useUserPosts(profileId, viewerUserId);

  // reset pagination whenever profile changes
  useEffect(() => {
    setHasMore(true);
    setLoadingMore(false);
    setCursorCreatedAt(null);
    setCursorId(null);
    setAttachmentsByPostId({});
  }, [profileId]);

  // update cursor after initial load / changes
  useEffect(() => {
    if (!posts || posts.length === 0) {
      setCursorCreatedAt(null);
      setCursorId(null);
      return;
    }
    const last = posts[posts.length - 1] as any;
    setCursorCreatedAt(last?.created_at ?? null);
    setCursorId(last?.id ?? null);
  }, [posts]);

  useEffect(() => {
    if (!posts || posts.length === 0) return;

    // only fetch attachments for posts we haven't loaded yet
    const missing = posts
      .map((p) => p.id)
      .filter((id) => !attachmentsByPostId[id]);

    if (missing.length === 0) return;

    loadAttachmentsForPostIds(missing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts]);

  useEffect(() => {
    if (!openMenuPostId) return;
    function handleClick() {
      setOpenMenuPostId(null);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [openMenuPostId]);

  function openPost(postId: string) {
    router.push(`/posts/${postId}`);
  }

  function openPostFromIcon(postId: string, e: any) {
    e.stopPropagation();
    openPost(postId);
  }

  async function toggleLike(postId: string, e?: any) {
    if (e) e.stopPropagation();

    if (!viewerUserId) {
      openAuthModal();
      return;
    }

    const alreadyLiked = !!likedByMe[postId];

    if (alreadyLiked) {
      const { error } = await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", viewerUserId);
      if (error) return;

      setLikedByMe((prev) => ({ ...prev, [postId]: false }));
      setLikeCounts((prev) => ({
        ...prev,
        [postId]: Math.max(0, (prev[postId] || 1) - 1),
      }));
    } else {
      const { error } = await supabase.from("likes").insert({ post_id: postId, user_id: viewerUserId });
      if (error) return;

      setLikedByMe((prev) => ({ ...prev, [postId]: true }));
      setLikeCounts((prev) => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
    }
  }

  function toggleMenu(postId: string, e: any) {
    e.stopPropagation();
    setOpenMenuPostId((prev) => (prev === postId ? null : postId));
  }

  async function handleEditPost(post: FeedPost, e: any) {
    e.stopPropagation();
    if (!viewerUserId || viewerUserId !== post.user_id) return;

    const next = window.prompt("Edit post:", post.content);
    if (next === null) return;

    const trimmed = next.trim();
    if (!trimmed) return;

    const { error } = await supabase.from("posts").update({ content: trimmed }).eq("id", post.id).eq("user_id", viewerUserId);
    if (error) return;

    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, content: trimmed } : p)));
    setOpenMenuPostId(null);
  }

  async function handleDeletePost(post: FeedPost, e: any) {
    e.stopPropagation();
    if (!viewerUserId || viewerUserId !== post.user_id) return;

    const ok = window.confirm("Delete this post?");
    if (!ok) return;

    const { error } = await supabase.from("posts").delete().eq("id", post.id).eq("user_id", viewerUserId);
    if (error) return;

    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    setOpenMenuPostId(null);
  }

  const findPostById = useMemo(() => {
    const map = new Map(posts.map((p) => [p.id, p]));
    return (id: string) => map.get(id) || null;
  }, [posts]);

  async function loadAttachmentsForPostIds(postIds: string[]) {
    if (!postIds || postIds.length === 0) return;

    const { data: attRows, error: attErr } = await supabase
      .from("post_attachments")
      .select("id, post_id, kind, url, meta, sort_order, created_at, width, height")
      .in("post_id", postIds)
      .order("sort_order", { ascending: true });

    if (attErr) {
      console.error("Error loading attachments:", attErr);
      return;
    }

    setAttachmentsByPostId((prev) => {
      const next = { ...prev };

      (attRows || []).forEach((r: any) => {
        const list = next[r.post_id] ? [...next[r.post_id]] : [];
        list.push(r);
        list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        next[r.post_id] = list;
      });

      return next;
    });
  }

  // ✅ Load more (keyset pagination) — does NOT change PostFeed.tsx
  async function fetchMore() {
    if (loadingMore) return;
    if (!hasMore) return;
    if (!cursorCreatedAt || !cursorId) return;

    setLoadingMore(true);

    try {
      let query = supabase
        .from("posts")
        .select("id, content, content_text, content_json, created_at, user_id, anime_id, anime_episode_id, manga_id, manga_chapter_id, review_id")
        .eq("user_id", profileId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(PAGE_SIZE)
        .or(`created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`);

      const { data, error } = await query;
      if (error) {
        setHasMore(false);
        return;
      }

      const newPosts = (data || []) as any[];

      const newIds = newPosts.map((p) => p.id).filter(Boolean);
      await loadAttachmentsForPostIds(newIds);

      if (newPosts.length === 0) {
        setHasMore(false);
        return;
      }

      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const merged = [...prev];
        for (const p of newPosts) {
          if (!seen.has(p.id)) merged.push(p);
        }
        return merged;
      });

      if (newPosts.length < PAGE_SIZE) setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }

  if (isLoadingPosts) return null;

  if (posts.length === 0) {
    return <p className="text-sm text-slate-500">This user hasn’t posted anything yet.</p>;
  }

  return (
    <div>
      {posts.map((p) => {
        const rowIsOwner = !!viewerUserId && viewerUserId === p.user_id;
        const isMenuOpen = openMenuPostId === p.id;

        const likeCount = likeCounts[p.id] || 0;
        const replyCount = replyCounts[p.id] || 0;
        const liked = !!likedByMe[p.id];

        const { originLabel, originHref, episodeLabel, episodeHref, posterUrl } = derivePostOrigin({
          post: p as FeedPost,
          animeMetaById,
          episodeMetaById,
          mangaMetaById,
          chapterMetaById,
        });

        const review = reviewsByPostId[p.id];

        const atts = attachmentsByPostId[p.id] || [];

        return review ? (
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
            initial={avatarInitial}
            username={canonicalHandle}
            avatarUrl={avatarUrl}
            originLabel={originLabel}
            originHref={originHref}
            episodeLabel={episodeLabel}
            episodeHref={episodeHref}
            posterUrl={posterUrl ?? null}
            href={`/posts/${p.id}`}
            isOwner={rowIsOwner}
            replyCount={replyCount}
            likeCount={likeCount}
            likedByMe={liked}
            onRowClick={openPostFromIcon}
            onReplyClick={openPostFromIcon}
            onToggleLike={toggleLike}
            onEdit={(id, e) => {
              const post = findPostById(id);
              if (post) handleEditPost(post as FeedPost, e);
            }}
            onDelete={(id, e) => {
              const post = findPostById(id);
              if (post) handleDeletePost(post as FeedPost, e);
            }}
            isMenuOpen={isMenuOpen}
            onToggleMenu={toggleMenu}
          />
        ) : (
          <CommentRow
            key={p.id}
            id={p.id}
            userId={p.user_id}
            createdAt={p.created_at}
            content={p.content}

            contentText={(p as any).content_text ?? null}
            contentJson={(p as any).content_json ?? null}
            attachments={atts}

            displayName={displayName}
            initial={avatarInitial}
            username={canonicalHandle}
            avatarUrl={avatarUrl}
            isOwner={rowIsOwner}
            href={`/posts/${p.id}`}
            replyCount={replyCount}
            likeCount={likeCount}
            likedByMe={liked}
            onRowClick={openPostFromIcon}
            onReplyClick={openPostFromIcon}
            onToggleLike={toggleLike}
            onEdit={(id, e) => {
              const post = findPostById(id);
              if (post) handleEditPost(post as FeedPost, e);
            }}
            onDelete={(id, e) => {
              const post = findPostById(id);
              if (post) handleDeletePost(post as FeedPost, e);
            }}
            isMenuOpen={isMenuOpen}
            onToggleMenu={toggleMenu}
            originLabel={originLabel}
            originHref={originHref}
            episodeLabel={episodeLabel}
            episodeHref={episodeHref}
          />
        );
      })}

      <InfiniteSentinel disabled={isLoadingPosts || loadingMore || !hasMore} onVisible={fetchMore} />

      {loadingMore ? (
        <div className="py-3 text-sm text-slate-500">Loading more…</div>
      ) : null}
    </div>
  );
}