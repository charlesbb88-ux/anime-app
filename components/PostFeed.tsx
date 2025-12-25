"use client";

import ReviewPostRow from "./ReviewPostRow";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { openAuthModal } from "../lib/openAuthModal";
import CommentRow from "./CommentRow";

type Post = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;

  anime_id: string | null;
  anime_episode_id: string | null;

  // ⭐ NEW (manga side)
  manga_id: string | null;
  manga_chapter_id: string | null;

  // ✅ review link (posts.review_id → reviews.id)
  review_id: string | null;
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

const TYPO = {
  base: "1rem",
  small: "0.9rem",
};

type PostFeedProps = {
  animeId?: string;
  animeEpisodeId?: string;

  // ⭐ NEW (manga pages)
  mangaId?: string;
  mangaChapterId?: string;
};

export default function PostFeed({
  animeId,
  animeEpisodeId,
  mangaId,
  mangaChapterId,
}: PostFeedProps) {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [postContent, setPostContent] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [posting, setPosting] = useState(false);

  // post.id -> review row
  const [reviewsByPostId, setReviewsByPostId] = useState<Record<string, ReviewRow>>(
    {}
  );

  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedByMe, setLikedByMe] = useState<Record<string, boolean>>({});
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});

  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);

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
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

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
    fetchFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animeId, animeEpisodeId, mangaId, mangaChapterId]);

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
  async function fetchFeed() {
    setIsLoadingPosts(true);

    try {
      let query = supabase
        .from("posts")
        .select(
          "id, content, created_at, user_id, anime_id, anime_episode_id, manga_id, manga_chapter_id, review_id"
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (animeEpisodeId) {
        query = query.eq("anime_episode_id", animeEpisodeId);
      } else if (animeId) {
        query = query.eq("anime_id", animeId);
      } else if (mangaChapterId) {
        query = query.eq("manga_chapter_id", mangaChapterId);
      } else if (mangaId) {
        query = query.eq("manga_id", mangaId);
      }

      const [
        { data: postsData, error: postsError },
        { data: likesData, error: likesError },
        { data: commentsData, error: commentsError },
      ] = await Promise.all([
        query,
        supabase.from("likes").select("post_id, user_id"),
        supabase.from("comments").select("post_id, parent_comment_id"),
      ]);

      let postList: Post[] = [];

      if (postsError) {
        console.error("Error fetching posts:", postsError);
      } else {
        postList = (postsData || []) as Post[];
        setPosts(postList);
      }

      if (!likesError) {
        const counts: Record<string, number> = {};
        (likesData || []).forEach((l: Like) => {
          counts[l.post_id] = (counts[l.post_id] || 0) + 1;
        });
        setLikeCounts(counts);
      }

      if (!commentsError) {
        const replyMap: Record<string, number> = {};
        (commentsData || []).forEach((c: CommentMeta) => {
          if (c.parent_comment_id === null) {
            replyMap[c.post_id] = (replyMap[c.post_id] || 0) + 1;
          }
        });
        setReplyCounts(replyMap);
      }

      if (postList.length > 0) {
        // USER PROFILES
        const uniqueUserIds = Array.from(new Set(postList.map((p) => p.user_id)));

        if (uniqueUserIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("id, username, avatar_url")
            .in("id", uniqueUserIds);

          if (profilesError) {
            console.error("Error fetching profiles:", profilesError);
          } else {
            const nameMap: Record<string, string> = {};
            const avatarMap: Record<string, string | null> = {};

            (profilesData || []).forEach((profile: Profile) => {
              if (profile.username?.trim()) {
                nameMap[profile.id] = profile.username.trim();
              }
              avatarMap[profile.id] = profile.avatar_url ?? null;
            });

            setUsernamesById(nameMap);
            setAvatarUrlsById(avatarMap);
          }
        }

        // ANIME META
        const uniqueAnimeIds = Array.from(
          new Set(postList.map((p) => p.anime_id).filter((id): id is string => !!id))
        );

        if (uniqueAnimeIds.length > 0) {
          const { data: animeRows, error: animeError } = await supabase
            .from("anime")
            .select("id, slug, title, title_english, image_url")
            .in("id", uniqueAnimeIds);

          if (animeError) {
            console.error("Error fetching anime metadata:", animeError);
            setAnimeMetaById({});
          } else {
            const metaMap: Record<string, AnimeMeta> = {};
            (animeRows || []).forEach((row: any) => {
              if (!row.id) return;
              metaMap[row.id] = {
                slug: row.slug ?? null,
                titleEnglish: row.title_english ?? null,
                title: row.title ?? null,
                imageUrl: row.image_url ?? null,
              };
            });
            setAnimeMetaById(metaMap);
          }
        } else {
          setAnimeMetaById({});
        }

        // EPISODE META
        const uniqueEpisodeIds = Array.from(
          new Set(
            postList
              .map((p) => p.anime_episode_id)
              .filter((id): id is string => !!id)
          )
        );

        if (uniqueEpisodeIds.length > 0) {
          const { data: episodeRows, error: episodeError } = await supabase
            .from("anime_episodes")
            .select("id, episode_number")
            .in("id", uniqueEpisodeIds);

          if (episodeError) {
            console.error("Error fetching episode metadata:", episodeError);
            setEpisodeMetaById({});
          } else {
            const epMap: Record<string, EpisodeMeta> = {};
            (episodeRows || []).forEach((row: any) => {
              if (!row.id) return;
              epMap[row.id] = {
                episodeNumber:
                  typeof row.episode_number === "number"
                    ? row.episode_number
                    : row.episode_number !== null
                    ? Number(row.episode_number)
                    : null,
              };
            });
            setEpisodeMetaById(epMap);
          }
        } else {
          setEpisodeMetaById({});
        }

        // MANGA META
        const uniqueMangaIds = Array.from(
          new Set(postList.map((p) => p.manga_id).filter((id): id is string => !!id))
        );

        if (uniqueMangaIds.length > 0) {
          const { data: mangaRows, error: mangaError } = await supabase
            .from("manga")
            .select("id, slug, title, title_english, image_url")
            .in("id", uniqueMangaIds);

          if (mangaError) {
            console.error("Error fetching manga metadata:", mangaError);
            setMangaMetaById({});
          } else {
            const mMap: Record<string, MangaMeta> = {};
            (mangaRows || []).forEach((row: any) => {
              if (!row.id) return;
              mMap[row.id] = {
                slug: row.slug ?? null,
                titleEnglish: row.title_english ?? null,
                title: row.title ?? null,
                imageUrl: row.image_url ?? null,
              };
            });
            setMangaMetaById(mMap);
          }
        } else {
          setMangaMetaById({});
        }

        // CHAPTER META
        const uniqueChapterIds = Array.from(
          new Set(
            postList
              .map((p) => p.manga_chapter_id)
              .filter((id): id is string => !!id)
          )
        );

        if (uniqueChapterIds.length > 0) {
          const { data: chapterRows, error: chapterError } = await supabase
            .from("manga_chapters")
            .select("id, chapter_number")
            .in("id", uniqueChapterIds);

          if (chapterError) {
            console.error("Error fetching chapter metadata:", chapterError);
            setChapterMetaById({});
          } else {
            const chMap: Record<string, ChapterMeta> = {};
            (chapterRows || []).forEach((row: any) => {
              if (!row.id) return;
              chMap[row.id] = {
                chapterNumber:
                  typeof row.chapter_number === "number"
                    ? row.chapter_number
                    : row.chapter_number !== null
                    ? Number(row.chapter_number)
                    : null,
              };
            });
            setChapterMetaById(chMap);
          }
        } else {
          setChapterMetaById({});
        }
      } else {
        setUsernamesById({});
        setAvatarUrlsById({});
        setAnimeMetaById({});
        setEpisodeMetaById({});
        setMangaMetaById({});
        setChapterMetaById({});
      }
    } finally {
      setIsLoadingPosts(false);
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
    if (!trimmed) return;

    setPosting(true);

    const payload: any = {
      content: trimmed,
      user_id: user.id,
    };

    if (animeId) payload.anime_id = animeId;
    if (animeEpisodeId) payload.anime_episode_id = animeEpisodeId;

    if (mangaId) payload.manga_id = mangaId;
    if (mangaChapterId) payload.manga_chapter_id = mangaChapterId;

    const { error } = await supabase.from("posts").insert(payload);

    setPosting(false);

    if (error) {
      console.error("Error creating post:", error);
      return;
    }

    setPostContent("");
    await fetchFeed();

    if (user?.id) fetchLikedByMe(user.id);
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
  // OPEN POST
  // ============================================================
  function openPost(postId: string) {
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

  const currentUserInitial = getInitialFromUser(user);

  const composerAvatarNode = (
    <div
      style={{
        width: 46,
        height: 46,
        borderRadius: "999px",
        background: "#e5e5e5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: TYPO.base,
        fontWeight: 600,
        color: "#333",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {currentUserAvatarUrl ? (
        <img
          src={currentUserAvatarUrl}
          alt="Your avatar"
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            objectFit: "cover",
          }}
        />
      ) : (
        currentUserInitial
      )}
    </div>
  );

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <>
      {/* Composer only when logged in */}
      {user && (
        <div
          style={{
            border: "1px solid #00000011",
            borderRadius: 0,
            background: "#ffffff",
            marginBottom: 0,
            borderBottom: "none",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.7rem",
              padding: "0.6rem 0.8rem 0.3rem 0.8rem",
            }}
          >
            {currentUserUsername ? (
              <Link
                href={`/${currentUserUsername}`}
                style={{ display: "inline-block", textDecoration: "none" }}
              >
                {composerAvatarNode}
              </Link>
            ) : (
              composerAvatarNode
            )}

            <div style={{ flex: 1 }}>
              <textarea
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder={
                  animeEpisodeId
                    ? "Talk about this episode…"
                    : animeId
                    ? "Talk about this anime…"
                    : mangaChapterId
                    ? "Talk about this chapter…"
                    : mangaId
                    ? "Talk about this manga…"
                    : "What's happening?"
                }
                style={{
                  width: "100%",
                  border: "none",
                  outline: "none",
                  resize: "none",
                  minHeight: "2.8rem",
                  fontSize: "1.05rem",
                  fontFamily: "inherit",
                  padding: 0,
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              padding: "0 0.8rem 0.5rem 0.8rem",
            }}
          >
            <button
              onClick={handlePost}
              disabled={posting || !postContent.trim()}
              style={{
                padding: "0.4rem 1.2rem",
                borderRadius: "999px",
                border: "none",
                background: posting || !postContent.trim() ? "#999" : "#000",
                color: "#fff",
                cursor: posting || !postContent.trim() ? "default" : "pointer",
                fontSize: TYPO.small,
                fontWeight: 500,
              }}
            >
              {posting ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      )}

      {/* FEED */}
      <div>
        {isLoadingPosts ? null : posts.length === 0 ? (
          <p
            style={{
              fontSize: TYPO.base,
              color: "#555",
              marginTop: "1rem",
            }}
          >
            No posts yet.
          </p>
        ) : (
          posts.map((p) => {
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
                // ✅ NEW: pass snapshot heart state to ReviewPostRow
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
            ) : (
              <CommentRow
                key={p.id}
                id={p.id}
                userId={p.user_id}
                createdAt={p.created_at}
                content={p.content}
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
            );
          })
        )}
      </div>
    </>
  );
}
