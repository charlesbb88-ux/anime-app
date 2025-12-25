// pages/[username].tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { openAuthModal } from "../lib/openAuthModal";

import CommentRow from "../components/CommentRow";
import ReviewPostRow from "../components/ReviewPostRow";

type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
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

  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);

  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});
  const [likedByMe, setLikedByMe] = useState<Record<string, boolean>>({});

  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);

  const [reviewsByPostId, setReviewsByPostId] = useState<Record<string, ReviewRow>>(
    {}
  );

  const [animeMetaById, setAnimeMetaById] = useState<Record<string, AnimeMeta>>(
    {}
  );
  const [episodeMetaById, setEpisodeMetaById] = useState<Record<string, EpisodeMeta>>(
    {}
  );
  const [mangaMetaById, setMangaMetaById] = useState<Record<string, MangaMeta>>(
    {}
  );
  const [chapterMetaById, setChapterMetaById] = useState<Record<string, ChapterMeta>>(
    {}
  );

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
        .select("id, username, avatar_url, bio, created_at")
        .eq("username", unameLower)
        .limit(1);

      const row = rows?.[0] ?? null;

      if (cancelled) return;

      if (error || !row) {
        setProfile(null);
        setPosts([]);
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

  // -------------------------------
  // Load posts + meta
  // -------------------------------
  useEffect(() => {
    if (!profile) return;
    const profileId = profile.id;

    let cancelled = false;

    async function loadUserPosts() {
      setIsLoadingPosts(true);

      try {
        const { data: postRows, error: postsError } = await supabase
          .from("posts")
          .select(
            "id, content, created_at, user_id, anime_id, anime_episode_id, manga_id, manga_chapter_id, review_id"
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

        if (currentUser?.id) {
          const { data: mineLikes } = await supabase
            .from("likes")
            .select("post_id")
            .eq("user_id", currentUser.id)
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
            ? supabase
                .from("anime")
                .select("id, slug, title, title_english, image_url")
                .in("id", uniqueAnimeIds)
            : Promise.resolve({ data: [] as any[] }),
          uniqueEpisodeIds.length
            ? supabase
                .from("anime_episodes")
                .select("id, episode_number")
                .in("id", uniqueEpisodeIds)
            : Promise.resolve({ data: [] as any[] }),
          uniqueMangaIds.length
            ? supabase
                .from("manga")
                .select("id, slug, title, title_english, image_url")
                .in("id", uniqueMangaIds)
            : Promise.resolve({ data: [] as any[] }),
          uniqueChapterIds.length
            ? supabase
                .from("manga_chapters")
                .select("id, chapter_number")
                .in("id", uniqueChapterIds)
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
  }, [profile, currentUser?.id]);

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
      const { error } = await supabase
        .from("likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", currentUser.id);

      if (error) return;

      setLikedByMe((prev) => ({ ...prev, [postId]: false }));
      setLikeCounts((prev) => ({
        ...prev,
        [postId]: Math.max(0, (prev[postId] || 1) - 1),
      }));
    } else {
      const { error } = await supabase.from("likes").insert({
        post_id: postId,
        user_id: currentUser.id,
      });

      if (error) return;

      setLikedByMe((prev) => ({ ...prev, [postId]: true }));
      setLikeCounts((prev) => ({
        ...prev,
        [postId]: (prev[postId] || 0) + 1,
      }));
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

    const { error } = await supabase
      .from("posts")
      .update({ content: trimmed })
      .eq("id", post.id)
      .eq("user_id", currentUser.id);

    if (error) return;

    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, content: trimmed } : p))
    );
    setOpenMenuPostId(null);
  }

  async function handleDeletePost(post: Post, e: any) {
    e.stopPropagation();
    if (!currentUser || currentUser.id !== post.user_id) return;

    const ok = window.confirm("Delete this post?");
    if (!ok) return;

    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", post.id)
      .eq("user_id", currentUser.id);

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
            We couldn’t find a profile for{" "}
            <span className="font-mono">@{normalizedUsername}</span>.
          </p>
        </div>
      </main>
    );
  }

  const baseProfilePath = `/${profile.username}`;

  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <header className="mb-6 border-b border-slate-200 pb-5">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={profile.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xl font-semibold text-slate-700">
                  {avatarInitial}
                </span>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">
                    @{profile.username}
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Joined{" "}
                    {new Date(profile.created_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>

                {isOwner && (
                  <Link
                    href="/settings"
                    className="px-3 py-1.5 text-sm rounded-full border border-slate-300 text-slate-700 hover:text-slate-900 hover:border-slate-400 transition"
                  >
                    Edit profile
                  </Link>
                )}
              </div>

              {profile.bio && (
                <p className="mt-3 text-sm text-slate-800 whitespace-pre-line">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>
        </header>

        {/* Tabs */}
        <nav className="mb-6 border-b border-slate-200">
          <div className="flex gap-6 text-sm font-medium">
            <Link
              href={baseProfilePath}
              className={`pb-3 ${
                router.asPath === baseProfilePath
                  ? "border-b-2 border-slate-900 text-slate-900"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Posts
            </Link>

            <Link
              href={`${baseProfilePath}/anime`}
              className={`pb-3 ${
                router.asPath.startsWith(`${baseProfilePath}/anime`)
                  ? "border-b-2 border-slate-900 text-slate-900"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Anime
            </Link>

            <Link
              href={`${baseProfilePath}/journal`}
              className={`pb-3 ${
                router.asPath.startsWith(`${baseProfilePath}/journal`)
                  ? "border-b-2 border-slate-900 text-slate-900"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Journal
            </Link>

            <Link
              href={`${baseProfilePath}/library`}
              className={`pb-3 ${
                router.asPath.startsWith(`${baseProfilePath}/library`)
                  ? "border-b-2 border-slate-900 text-slate-900"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              My Library
            </Link>
          </div>
        </nav>

        {/* Posts feed */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Posts by @{profile.username}
          </h2>

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
                      }
                    }
                  }
                }

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
