// pages/[username].tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { openAuthModal } from "../lib/openAuthModal";

import CommentRow from "../components/CommentRow";
import ReviewPostRow from "../components/ReviewPostRow";

import { useUserPosts } from "../lib/hooks/useUserPosts";
import ProfileMediaHeaderLayout from "@/components/layouts/ProfileMediaHeaderLayout";

type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;

  // ✅ NEW: backdrop data (must match your DB column names)
  backdrop_url: string | null;
  backdrop_pos_x: number | null;
  backdrop_pos_y: number | null;
  backdrop_zoom: number | null;
};

type Post = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;

  anime_id: string | null;
  anime_episode_id: string | null;

  manga_id: string | null;
  manga_chapter_id: string | null;

  review_id: string | null;
};

function getFirstQueryParam(param: string | string[] | undefined) {
  if (typeof param === "string") return param;
  if (Array.isArray(param)) return param[0] ?? "";
  return "";
}

export default function UserProfilePage() {
  const router = useRouter();
  const rawUsername = getFirstQueryParam(router.query.username as any);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);

  const normalizedUsername = useMemo(() => {
    return (rawUsername?.trim?.() ?? "").trim();
  }, [rawUsername]);

  const unameLower = useMemo(() => {
    const u = normalizedUsername.trim();
    return u ? u.toLowerCase() : "";
  }, [normalizedUsername]);

  const canonicalHandle = useMemo(() => {
    return profile?.username?.trim()?.toLowerCase() || undefined;
  }, [profile?.username]);

  const displayName = useMemo(() => {
    return profile?.username ? `@${profile.username}` : "@user";
  }, [profile?.username]);

  const avatarInitial = useMemo(() => {
    const u = profile?.username?.trim();
    return u && u.length > 0 ? u.charAt(0).toUpperCase() : "?";
  }, [profile?.username]);

  const isOwner = useMemo(() => {
    if (!currentUser?.id) return false;
    if (!profile?.id) return false;
    return currentUser.id === profile.id;
  }, [currentUser?.id, profile?.id]);

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
  } = useUserPosts(profile?.id ?? null, currentUser?.id ?? null);

  // -------------------------------
  // Auth
  // -------------------------------
  useEffect(() => {
    let cancelled = false;

    supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      if (error) setCurrentUser(null);
      else setCurrentUser(data.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (cancelled) return;
      setCurrentUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  // -------------------------------
  // Load profile
  // -------------------------------
  useEffect(() => {
    if (!unameLower) return;

    let cancelled = false;

    async function loadProfile() {
      setLoadingProfile(true);
      setNotFound(false);

      const { data: rows, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, bio, created_at, backdrop_url, backdrop_pos_x, backdrop_pos_y, backdrop_zoom")
        .eq("username", unameLower)
        .limit(1);

      const row = rows?.[0] ?? null;

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

    if (!currentUser) {
      openAuthModal();
      return;
    }

    const alreadyLiked = !!likedByMe[postId];

    if (alreadyLiked) {
      const { error } = await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", currentUser.id);
      if (error) return;

      setLikedByMe((prev) => ({ ...prev, [postId]: false }));
      setLikeCounts((prev) => ({
        ...prev,
        [postId]: Math.max(0, (prev[postId] || 1) - 1),
      }));
    } else {
      const { error } = await supabase.from("likes").insert({ post_id: postId, user_id: currentUser.id });
      if (error) return;

      setLikedByMe((prev) => ({ ...prev, [postId]: true }));
      setLikeCounts((prev) => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
    }
  }

  function toggleMenu(postId: string, e: any) {
    e.stopPropagation();
    setOpenMenuPostId((prev) => (prev === postId ? null : postId));
  }

  async function handleEditPost(post: Post, e: any) {
    e.stopPropagation();
    if (!currentUser || currentUser.id !== post.user_id) return;

    const next = window.prompt("Edit post:", post.content);
    if (next === null) return;

    const trimmed = next.trim();
    if (!trimmed) return;

    const { error } = await supabase.from("posts").update({ content: trimmed }).eq("id", post.id).eq("user_id", currentUser.id);
    if (error) return;

    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, content: trimmed } : p)));
    setOpenMenuPostId(null);
  }

  async function handleDeletePost(post: Post, e: any) {
    e.stopPropagation();
    if (!currentUser || currentUser.id !== post.user_id) return;

    const ok = window.confirm("Delete this post?");
    if (!ok) return;

    const { error } = await supabase.from("posts").delete().eq("id", post.id).eq("user_id", currentUser.id);
    if (error) return;

    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    setOpenMenuPostId(null);
  }

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
            We couldn’t find a profile for <span className="font-mono">@{normalizedUsername}</span>.
          </p>
        </div>
      </main>
    );
  }

  const baseProfilePath = `/${profile.username}`;

  return (
    <main className="min-h-screen">
      <ProfileMediaHeaderLayout
        backdropUrl={profile.backdrop_url}
        backdropPosX={profile.backdrop_pos_x}
        backdropPosY={profile.backdrop_pos_y}
        backdropZoom={profile.backdrop_zoom}
        title={undefined}
        username={profile.username}
        avatarUrl={profile.avatar_url}
        bio={profile.bio}
        rightPinned={
          isOwner ? (
            <Link
              href="/settings"
              className="px-3 py-1.5 text-sm rounded-full border border-white/30 text-white hover:border-white/60 hover:bg-white/10 transition"
            >
              Edit profile
            </Link>
          ) : null
        }
        reserveRightClassName="pr-[160px]"
        activeTab="posts"
      />

      {/* ✅ Everything below stays your normal feed width */}
      <div className="max-w-3xl mx-auto px-4 pb-8">
        {/* Posts feed */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Posts by @{profile.username}</h2>

          {isLoadingPosts ? null : posts.length === 0 ? (
            <p className="text-sm text-slate-500">This user hasn’t posted anything yet.</p>
          ) : (
            <div>
              {posts.map((p) => {
                const rowIsOwner = !!currentUser && currentUser.id === p.user_id;
                const isMenuOpen = openMenuPostId === p.id;

                const likeCount = likeCounts[p.id] || 0;
                const replyCount = replyCounts[p.id] || 0;
                const liked = !!likedByMe[p.id];

                let originLabel: string | undefined;
                let originHref: string | undefined;
                let episodeLabel: string | undefined;
                let episodeHref: string | undefined;
                let posterUrl: string | null | undefined;

                if (p.anime_id) {
                  const meta = animeMetaById[p.anime_id];
                  if (meta) {
                    const english = meta.titleEnglish?.trim();
                    originLabel = english && english.length > 0 ? english : meta.title || undefined;

                    if (meta.slug) originHref = `/anime/${meta.slug}`;
                    posterUrl = meta.imageUrl ?? null;

                    if (p.anime_episode_id) {
                      const epMeta = episodeMetaById[p.anime_episode_id];
                      if (epMeta && epMeta.episodeNumber != null) {
                        episodeLabel = `Ep ${epMeta.episodeNumber}`;
                        if (meta.slug) episodeHref = `/anime/${meta.slug}/episode/${epMeta.episodeNumber}`;
                      }
                    }
                  }
                }

                if (!p.anime_id && p.manga_id) {
                  const meta = mangaMetaById[p.manga_id];
                  if (meta) {
                    const english = meta.titleEnglish?.trim();
                    originLabel = english && english.length > 0 ? english : meta.title || undefined;

                    if (meta.slug) originHref = `/manga/${meta.slug}`;
                    posterUrl = meta.imageUrl ?? null;

                    if (p.manga_chapter_id) {
                      const chMeta = chapterMetaById[p.manga_chapter_id];
                      if (chMeta && chMeta.chapterNumber != null) {
                        episodeLabel = `Ch ${chMeta.chapterNumber}`;
                        if (meta.slug) episodeHref = `/manga/${meta.slug}/chapter/${chMeta.chapterNumber}`;
                      }
                    }
                  }
                }

                const review = reviewsByPostId[p.id];

                return review ? (
                  <ReviewPostRow
                    key={p.id}
                    postId={p.id}
                    reviewId={review.id}
                    userId={p.user_id}
                    createdAt={p.created_at}
                    content={(review.content ?? p.content) as string}
                    rating={review.rating}
                    containsSpoilers={!!review.contains_spoilers}
                    authorLiked={!!review.author_liked}
                    displayName={displayName}
                    initial={avatarInitial}
                    username={canonicalHandle}
                    avatarUrl={profile.avatar_url}
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
                ) : (
                  <CommentRow
                    key={p.id}
                    id={p.id}
                    userId={p.user_id}
                    createdAt={p.created_at}
                    content={p.content}
                    displayName={displayName}
                    initial={avatarInitial}
                    username={canonicalHandle}
                    avatarUrl={profile.avatar_url}
                    isOwner={rowIsOwner}
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
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
