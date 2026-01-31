"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import CommentRow from "../../components/CommentRow";
import ReviewPostRow from "../../components/ReviewPostRow";
import LeftSidebar from "../../components/LeftSidebar";
import RightSidebar from "../../components/RightSidebar";
import { openAuthModal } from "../../lib/openAuthModal";
import PostContextHeaderLayout from "@/components/PostContextHeaderLayout";
import FeedShell from "@/components/FeedShell";

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

type ReviewRow = {
  id: string;
  rating: number | null;
  contains_spoilers: boolean | null;
  author_liked: boolean | null;

  anime_id: string | null;
  anime_episode_id: string | null;
  manga_id: string | null;
  manga_chapter_id: string | null;
};

type AnimeRow = {
  id: string;
  slug: string | null;
  title: string | null;
  image_url: string | null;
};

type MangaRow = {
  id: string;
  slug: string | null;
  title: string | null;
  image_url: string | null;
};

type Like = {
  post_id: string;
  user_id: string;
};

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_comment_id: string | null;
};

type CommentLike = {
  comment_id: string;
  user_id: string;
};

type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
};

// ---- Layout + typography tokens (MATCH HOME) ----
const LAYOUT = {
  pageMaxWidth: "72rem",
  pagePaddingY: ".2rem",
  pagePaddingX: "1rem",
  columnGap: "1rem",
  mainWidth: "36rem",
  sidebarWidth: "16rem",
};

const TYPO = {
  base: "1rem",
  small: "0.9rem",
};

export default function PostPage() {
  const router = useRouter();
  const { id } = router.query;

  const [user, setUser] = useState<any>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [loadingPost, setLoadingPost] = useState(true);

  // review visuals (only for review posts)
  const [reviewRow, setReviewRow] = useState<ReviewRow | null>(null);
  const [reviewAnime, setReviewAnime] = useState<AnimeRow | null>(null);
  const [reviewManga, setReviewManga] = useState<MangaRow | null>(null);
  const [episodeNum, setEpisodeNum] = useState<number | null>(null);
  const [chapterNum, setChapterNum] = useState<number | null>(null);

  // post likes
  const [likeCount, setLikeCount] = useState(0);
  const [likedByMe, setLikedByMe] = useState(false);

  // root comments
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);

  // reply composer (root comment)
  const [rootCommentInput, setRootCommentInput] = useState("");
  const [addingRootComment, setAddingRootComment] = useState(false);
  const [replyActive, setReplyActive] = useState(false);
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // menus
  const [openMenuPost, setOpenMenuPost] = useState<boolean>(false);
  const [openMenuCommentId, setOpenMenuCommentId] = useState<string | null>(
    null
  );

  // per-comment likes + reply counts
  const [commentLikeCounts, setCommentLikeCounts] = useState<
    Record<string, number>
  >({});
  const [commentLikedByMe, setCommentLikedByMe] = useState<
    Record<string, boolean>
  >({});
  const [commentReplyCounts, setCommentReplyCounts] = useState<
    Record<string, number>
  >({});

  // user_id → username map for post author + root comments
  const [usernamesById, setUsernamesById] = useState<Record<string, string>>(
    {}
  );

  // user_id → avatar_url map
  const [avatarUrlsById, setAvatarUrlsById] = useState<
    Record<string, string | null>
  >({});

  // current user avatar + username for reply composer
  const [currentUserAvatarUrl, setCurrentUserAvatarUrl] = useState<
    string | null
  >(null);
  const [currentUserUsername, setCurrentUserUsername] = useState<string | null>(
    null
  );

  // ---------- auth ----------
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  // load current user's avatar + username for reply composer
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
      const uname =
        data?.username && data.username.trim()
          ? data.username.trim()
          : null;
      setCurrentUserUsername(uname);
    }

    loadSelfProfile();
  }, [user]);

  // ---------- close menus on outside click ----------
  useEffect(() => {
    if (!openMenuPost && !openMenuCommentId) return;

    function handleClick() {
      setOpenMenuPost(false);
      setOpenMenuCommentId(null);
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [openMenuPost, openMenuCommentId]);

  // ---------- load post + likes + comments ----------
  useEffect(() => {
    if (!id) return;
    const postId = id as string;

    loadPost(postId);
    loadLikes(postId);
    loadComments(postId);
  }, [id, user]);

  async function loadPost(postId: string) {
    setLoadingPost(true);

    const { data, error } = await supabase
      .from("posts")
      .select(
        "id, content, created_at, user_id, anime_id, anime_episode_id, manga_id, manga_chapter_id, review_id"
      )
      .eq("id", postId)
      .single();

    if (error) {
      console.error("Error fetching post:", error);
      setPost(null);
      setReviewRow(null);
      setReviewAnime(null);
      setReviewManga(null);
      setLoadingPost(false);
      return;
    }

    const p = data as Post;
    setPost(p);
    setEpisodeNum(null);
    setChapterNum(null);

    // ✅ load review visuals if this post is a review post
    if (p.review_id) {
      // 1) fetch review row
      const { data: r, error: rErr } = await supabase
        .from("reviews")
        .select(
          "id, rating, contains_spoilers, author_liked, anime_id, anime_episode_id, manga_id, manga_chapter_id"
        )
        .eq("id", p.review_id)
        .single();

      if (rErr) {
        console.error("Error fetching review:", rErr);
        setReviewRow(null);
        setReviewAnime(null);
        setReviewManga(null);
        setLoadingPost(false);
        return;
      }

      const rr = r as ReviewRow;
      setReviewRow(rr);

      const episodeId = rr.anime_episode_id ?? p.anime_episode_id;
      const chapterId = rr.manga_chapter_id ?? p.manga_chapter_id;

      // ✅ fetch human episode number
      if (episodeId) {
        const { data: ep, error: epErr } = await supabase
          .from("anime_episodes")
          .select("episode_number")
          .eq("id", episodeId)
          .single();

        if (epErr) {
          console.error("Error fetching episode_number:", epErr);
          setEpisodeNum(null);
        } else {
          const n =
            typeof ep?.episode_number === "number"
              ? ep.episode_number
              : ep?.episode_number != null
                ? Number(ep.episode_number)
                : null;

          setEpisodeNum(Number.isFinite(n as any) ? (n as number) : null);
        }
      }

      // ✅ fetch human chapter number
      if (chapterId) {
        const { data: ch, error: chErr } = await supabase
          .from("manga_chapters")
          .select("chapter_number")
          .eq("id", chapterId)
          .single();

        if (chErr) {
          console.error("Error fetching chapter_number:", chErr);
          setChapterNum(null);
        } else {
          const n =
            typeof ch?.chapter_number === "number"
              ? ch.chapter_number
              : ch?.chapter_number != null
                ? Number(ch.chapter_number)
                : null;

          setChapterNum(Number.isFinite(n as any) ? (n as number) : null);
        }
      }

      // 2) fetch origin row for poster/title/link
      // prefer review.*_id; fallback to post.*_id
      const animeId = rr.anime_id ?? p.anime_id;
      const mangaId = rr.manga_id ?? p.manga_id;

      // reset both first
      setReviewAnime(null);
      setReviewManga(null);

      if (animeId) {
        const { data: a, error: aErr } = await supabase
          .from("anime")
          .select("id, slug, title, image_url")
          .eq("id", animeId)
          .single();

        if (aErr) {
          console.error("Error fetching anime:", aErr);
          setReviewAnime(null);
        } else {
          setReviewAnime(a as AnimeRow);
        }
      } else if (mangaId) {
        const { data: m, error: mErr } = await supabase
          .from("manga")
          .select("id, slug, title, image_url")
          .eq("id", mangaId)
          .single();

        if (mErr) {
          console.error("Error fetching manga:", mErr);
          setReviewManga(null);
        } else {
          setReviewManga(m as MangaRow);
        }
      } else {
        // neither anime nor manga linked
        setReviewAnime(null);
        setReviewManga(null);
      }
    } else {
      // not a review post
      setReviewRow(null);
      setReviewAnime(null);
      setReviewManga(null);
    }

    setLoadingPost(false);
  }

  async function loadLikes(postId: string) {
    const { data, error } = await supabase
      .from("likes")
      .select("post_id, user_id")
      .eq("post_id", postId);

    if (error) {
      console.error("Error fetching likes:", error);
      return;
    }

    const likes = (data || []) as Like[];
    setLikeCount(likes.length);
    setLikedByMe(user ? likes.some((l) => l.user_id === user.id) : false);
  }

  async function loadComments(postId: string) {
    setCommentsLoading(true);

    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    setCommentsLoading(false);

    if (error) {
      console.error("Error fetching comments:", error);
      return;
    }

    const all = (data || []) as Comment[];

    const roots = all.filter((c) => c.parent_comment_id === null);
    setComments(roots);

    // reply counts
    const replyMap: Record<string, number> = {};
    all.forEach((c) => {
      if (c.parent_comment_id) {
        replyMap[c.parent_comment_id] =
          (replyMap[c.parent_comment_id] || 0) + 1;
      }
    });
    setCommentReplyCounts(replyMap);

    const rootIds = roots.map((c) => c.id);
    if (rootIds.length === 0) {
      setCommentLikeCounts({});
      setCommentLikedByMe({});
      return;
    }

    // comment likes for root comments
    const { data: likeRows, error: likesError } = await supabase
      .from("comment_likes")
      .select("comment_id, user_id")
      .in("comment_id", rootIds);

    if (likesError) {
      console.error("Error fetching comment likes:", likesError);
      return;
    }

    const counts: Record<string, number> = {};
    const likedByMeMap: Record<string, boolean> = {};

    (likeRows || []).forEach((row: CommentLike) => {
      counts[row.comment_id] = (counts[row.comment_id] || 0) + 1;
      if (user && row.user_id === user.id) {
        likedByMeMap[row.comment_id] = true;
      }
    });

    setCommentLikeCounts(counts);
    setCommentLikedByMe(likedByMeMap);
  }

  // ---------- load usernames + avatar_url for post author + root comments ----------
  useEffect(() => {
    const loadProfiles = async () => {
      const ids = new Set<string>();

      if (post?.user_id) {
        ids.add(post.user_id);
      }

      comments.forEach((c) => {
        if (c.user_id) ids.add(c.user_id);
      });

      if (ids.size === 0) {
        setUsernamesById({});
        setAvatarUrlsById({});
        return;
      }

      const userIds = Array.from(ids);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", userIds);

      if (error) {
        console.error("Error fetching profiles:", error);
        return;
      }

      const usernameMap: Record<string, string> = {};
      const avatarMap: Record<string, string | null> = {};

      (data || []).forEach((row: Profile) => {
        if (!row.id) return;

        if (row.username) {
          usernameMap[row.id] = row.username;
        }
        avatarMap[row.id] = row.avatar_url ?? null;
      });

      setUsernamesById(usernameMap);
      setAvatarUrlsById(avatarMap);
    };

    if (!post && comments.length === 0) {
      setUsernamesById({});
      setAvatarUrlsById({});
      return;
    }

    loadProfiles();
  }, [post, comments]);

  // ---------- textarea auto grow ----------
  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    const maxHeight = 20 * 24; // ~20 lines
    const newHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${newHeight}px`;

    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }

  // ---------- POST LIKE ----------
  async function handleTogglePostLike(id: string, e: any) {
    e.stopPropagation();

    if (!user) {
      openAuthModal();
      return;
    }

    if (!post || id !== post.id) return;

    if (likedByMe) {
      const { error } = await supabase
        .from("likes")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error unliking:", error);
        return;
      }

      setLikedByMe(false);
      setLikeCount((prev) => Math.max(0, prev - 1));
    } else {
      const { error } = await supabase.from("likes").insert({
        post_id: post.id,
        user_id: user.id,
      });

      if (error) {
        console.error("Error liking:", error);
        return;
      }

      setLikedByMe(true);
      setLikeCount((prev) => prev + 1);
    }
  }

  // ---------- COMMENT LIKE ----------
  async function toggleCommentLike(commentId: string, e?: any) {
    if (e) e.stopPropagation();

    if (!user) {
      openAuthModal();
      return;
    }

    const alreadyLiked = commentLikedByMe[commentId];

    if (alreadyLiked) {
      const { error } = await supabase
        .from("comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error unliking comment:", error);
        return;
      }

      setCommentLikedByMe((prev) => ({ ...prev, [commentId]: false }));
      setCommentLikeCounts((prev) => ({
        ...prev,
        [commentId]: Math.max(0, (prev[commentId] || 1) - 1),
      }));
    } else {
      const { error } = await supabase.from("comment_likes").insert({
        comment_id: commentId,
        user_id: user.id,
      });

      if (error) {
        console.error("Error liking comment:", error);
        return;
      }

      setCommentLikedByMe((prev) => ({ ...prev, [commentId]: true }));
      setCommentLikeCounts((prev) => ({
        ...prev,
        [commentId]: (prev[commentId] || 0) + 1,
      }));
    }
  }

  // ---------- ADD ROOT COMMENT ----------
  async function handleAddRootComment() {
    if (!user || !post) return;

    const text = rootCommentInput.trim();
    if (!text) return;

    setAddingRootComment(true);

    const { error } = await supabase.from("comments").insert({
      post_id: post.id,
      user_id: user.id,
      content: text,
      parent_comment_id: null,
    });

    setAddingRootComment(false);

    if (error) {
      console.error("Error adding comment:", error);
      return;
    }

    setRootCommentInput("");
    setReplyActive(false);

    if (replyTextareaRef.current) {
      replyTextareaRef.current.style.height = "24px";
      replyTextareaRef.current.style.overflowY = "hidden";
    }

    loadComments(post.id);
  }

  // ---------- POST EDIT + DELETE ----------
  async function handleEditPostRow(id: string, e: any) {
    e.stopPropagation();
    if (!user || !post || id !== post.id || user.id !== post.user_id) return;

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

    setPost((prev) => (prev ? { ...prev, content: trimmed } : prev));
    setOpenMenuPost(false);
  }

  async function handleDeletePostRow(id: string, e: any) {
    e.stopPropagation();
    if (!user || !post || id !== post.id || user.id !== post.user_id) return;

    if (!window.confirm("Delete this post?")) return;

    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", post.id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting post:", error);
      return;
    }

    router.push("/");
  }

  // ---------- COMMENT EDIT + DELETE ----------
  async function handleEditComment(id: string, e: any) {
    e.stopPropagation();
    if (!user) return;

    const c = comments.find((cm) => cm.id === id);
    if (!c || user.id !== c.user_id) return;

    const next = window.prompt("Edit comment:", c.content);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed) return;

    const { error } = await supabase
      .from("comments")
      .update({ content: trimmed })
      .eq("id", c.id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error updating comment:", error);
      return;
    }

    setComments((prev) =>
      prev.map((cm) => (cm.id === c.id ? { ...cm, content: trimmed } : cm))
    );
    setOpenMenuCommentId(null);
  }

  async function handleDeleteComment(id: string, e: any) {
    e.stopPropagation();
    if (!user) return;

    const c = comments.find((cm) => cm.id === id);
    if (!c || user.id !== c.user_id) return;

    if (!window.confirm("Delete this comment?")) return;

    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", c.id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting comment:", error);
      return;
    }

    setOpenMenuCommentId(null);
    if (post) loadComments(post.id);
  }

  // ---------- menu helpers ----------
  function handleTogglePostMenu(_id: string, e: any) {
    e.stopPropagation();
    setOpenMenuPost((prev) => !prev);
    setOpenMenuCommentId(null);
  }

  function toggleCommentMenu(commentId: string, e: any) {
    e.stopPropagation();
    setOpenMenuCommentId((prev) => (prev === commentId ? null : commentId));
    setOpenMenuPost(false);
  }

  // ---------- navigation helpers ----------
  function openCommentFromIcon(commentId: string, e: any) {
    e.stopPropagation();
    router.push(`/comments/${commentId}`);
  }

  function handleReplyClick(commentId: string, e: any) {
    openCommentFromIcon(commentId, e);
  }

  // main post "Reply" → focus composer
  function handlePostReplyClick(_id: string, e: any) {
    e.stopPropagation();
    setReplyActive(true);
    if (replyTextareaRef.current) {
      replyTextareaRef.current.focus();
      replyTextareaRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }

  // ---------- display helpers ----------
  function getHandle(userId: string): string | null {
    const username = usernamesById[userId];
    if (username && username.trim()) return username.trim();
    return null;
  }

  function getAvatarUrl(userId: string): string | undefined {
    const url = avatarUrlsById[userId];
    return url ?? undefined;
  }

  function getDisplayName(userId: string): string {
    const handle = getHandle(userId);
    if (handle) return `@${handle}`;
    return `User-${userId.slice(0, 4)}`;
  }

  function getInitial(userId: string): string {
    const handle = getHandle(userId);
    if (handle) return handle.charAt(0).toUpperCase();
    return getDisplayName(userId).charAt(0).toUpperCase();
  }

  function getInitialFromUser(userObj: any) {
    if (!userObj) return "U";
    const email: string = userObj.email || "";
    const c = email.trim()[0];
    if (c) return c.toUpperCase();
    return "U";
  }

  const postAuthorHandle = post ? getHandle(post.user_id) : null;
  const postAuthorName = post ? getDisplayName(post.user_id) : "User-0000";
  const postAuthorInitial = post ? getInitial(post.user_id) : "U";
  const postAuthorAvatarUrl = post ? getAvatarUrl(post.user_id) : undefined;
  const isPostOwner = user && post && user.id === post.user_id;
  const rootReplyCount = comments.length;
  const currentUserInitial = getInitialFromUser(user);

  const replyDisabled = addingRootComment || !rootCommentInput.trim();
  const isCollapsed = !replyActive && !rootCommentInput.trim();

  const originTitle = reviewAnime?.title ?? reviewManga?.title ?? "";
  const originPoster = reviewAnime?.image_url ?? reviewManga?.image_url ?? null;

  const originHref =
    reviewAnime?.slug
      ? `/anime/${reviewAnime.slug}`
      : reviewAnime?.id
        ? `/anime/${reviewAnime.id}`
        : reviewManga?.slug
          ? `/manga/${reviewManga.slug}`
          : reviewManga?.id
            ? `/manga/${reviewManga.id}`
            : undefined;

  // ---- manga chapter parity (ReviewPostRow now supports it) ----
  const chapterId = reviewRow?.manga_chapter_id ?? post?.manga_chapter_id;

  const chapterLabel = chapterNum != null ? `Ch ${chapterNum}` : undefined;

  const chapterHref =
    reviewManga?.slug && chapterNum != null
      ? `/manga/${reviewManga.slug}/chapter/${chapterNum}`
      : undefined;
  function handleRootInputChange(e: any) {
    setRootCommentInput(e.target.value);
    if (replyTextareaRef.current) autoGrow(replyTextareaRef.current);
  }

  function handleReplyBlur() {
    if (!rootCommentInput.trim()) {
      setReplyActive(false);
      if (replyTextareaRef.current) {
        replyTextareaRef.current.style.height = "24px";
        replyTextareaRef.current.style.overflowY = "hidden";
      }
    }
  }

  const composerAvatarNode = (
    <div
      style={{
        width: 45,
        height: 45,
        borderRadius: "999px",
        background: "#e5e5e5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "0.95rem",
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
            display: "block",
          }}
        />
      ) : (
        currentUserInitial
      )}
    </div>
  );

  // ✅ this is your existing page content (unchanged),
  // just moved into a reusable block so we can wrap it.
  const pageBody = (
    <div
      className="postPageWrap"
      style={{
        maxWidth: LAYOUT.pageMaxWidth,
        margin: "0 auto",
        padding: `${LAYOUT.pagePaddingY} ${LAYOUT.pagePaddingX}`,
      }}
    >
      {/* ONE FLEX ROW: left | center | right — same as Home */}
      <div
        className="postLayoutRow"
        style={{
          display: "flex",
          justifyContent: "center",
          gap: LAYOUT.columnGap,
        }}
      >
        {/* LEFT SIDEBAR (sticky) */}
        <aside
          className="postSidebar"
          style={{
            flex: `0 0 ${LAYOUT.sidebarWidth}`,
            maxWidth: LAYOUT.sidebarWidth,
            position: "sticky",
            top: "1.5rem",
            alignSelf: "flex-start",
            height: "fit-content",
          }}
        >
          <LeftSidebar />
        </aside>

        {/* CENTER COLUMN – post + replies */}
        <main
          className="postMain"
          style={{
            flex: `0 0 ${LAYOUT.mainWidth}`,
            maxWidth: LAYOUT.mainWidth,
          }}
        >
          {loadingPost ? (
            <p style={{ marginTop: "1rem" }}>Loading post…</p>
          ) : !post ? (
            <p style={{ marginTop: "1rem" }}>Post not found.</p>
          ) : (
            <>
              {/* MAIN POST */}
              <FeedShell>
                <div className="mobileMainPostBorders">
                  {post.review_id ? (
                    <ReviewPostRow
                      postId={post.id}
                      reviewId={post.review_id}
                      userId={post.user_id}
                      createdAt={post.created_at}
                      content={post.content}
                      rating={reviewRow?.rating ?? null}
                      containsSpoilers={!!reviewRow?.contains_spoilers}
                      authorLiked={!!reviewRow?.author_liked}
                      displayName={postAuthorName}
                      username={postAuthorHandle ?? undefined}
                      avatarUrl={postAuthorAvatarUrl ?? null}
                      initial={postAuthorInitial}
                      originLabel={originTitle}
                      originHref={originHref}
                      episodeLabel={episodeNum != null ? `Ep ${episodeNum}` : undefined}
                      episodeHref={
                        reviewAnime?.slug && episodeNum != null
                          ? `/anime/${reviewAnime.slug}/episode/${episodeNum}`
                          : undefined
                      }
                      chapterLabel={chapterLabel}
                      chapterHref={chapterHref}
                      posterUrl={originPoster}
                      href={`/posts/${post.id}`}
                      isMain
                      isOwner={!!isPostOwner}
                      replyCount={rootReplyCount}
                      likeCount={likeCount}
                      likedByMe={likedByMe}
                      onReplyClick={handlePostReplyClick}
                      onToggleLike={handleTogglePostLike}
                      onEdit={handleEditPostRow}
                      onDelete={handleDeletePostRow}
                      isMenuOpen={openMenuPost}
                      onToggleMenu={handleTogglePostMenu}
                      disableHoverHighlight
                    />
                  ) : (
                    <CommentRow
                      id={post.id}
                      userId={post.user_id}
                      createdAt={post.created_at}
                      content={post.content}
                      displayName={postAuthorName}
                      initial={postAuthorInitial}
                      username={postAuthorHandle ?? undefined}
                      avatarUrl={postAuthorAvatarUrl}
                      isMain
                      isOwner={!!isPostOwner}
                      replyCount={rootReplyCount}
                      likeCount={likeCount}
                      likedByMe={likedByMe}
                      onReplyClick={handlePostReplyClick}
                      onToggleLike={handleTogglePostLike}
                      onEdit={handleEditPostRow}
                      onDelete={handleDeletePostRow}
                      isMenuOpen={openMenuPost}
                      onToggleMenu={handleTogglePostMenu}
                      disableHoverHighlight
                    />
                  )}
                </div>
              </FeedShell>

              {/* REPLY COMPOSER */}
              <div style={{ marginTop: "0.75rem" }}></div>
              <FeedShell>
                {user ? (
                  <div>
                    <div
                      style={{
                        border: "1px solid #000000",
                        borderRadius: 0,
                        background: "#ffffff",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: replyActive ? "flex-start" : "center",
                          gap: "0.6rem",
                          padding: replyActive
                            ? "0.5rem 0.75rem 0.3rem 0.75rem"
                            : "0.35rem 0.75rem",
                        }}
                      >
                        {currentUserUsername ? (
                          <Link
                            href={`/${currentUserUsername}`}
                            style={{
                              display: "inline-block",
                              textDecoration: "none",
                            }}
                          >
                            {composerAvatarNode}
                          </Link>
                        ) : (
                          composerAvatarNode
                        )}

                        <div style={{ flex: 1 }}>
                          <textarea
                            id="root-reply-input"
                            ref={replyTextareaRef}
                            value={rootCommentInput}
                            onChange={handleRootInputChange}
                            onFocus={() => setReplyActive(true)}
                            onBlur={handleReplyBlur}
                            placeholder={!replyActive ? "Post your reply" : ""}
                            rows={1}
                            style={{
                              width: "100%",
                              border: "none",
                              outline: "none",
                              resize: "none",
                              background: "transparent",
                              padding: isCollapsed ? "0" : "0.6rem 0",
                              height: isCollapsed ? "26px" : "auto",
                              minHeight: isCollapsed ? "26px" : "36px",
                              fontSize: "1rem",
                              fontFamily: "inherit",
                              lineHeight: isCollapsed ? "30px" : 1.5,
                              overflowY: "hidden",
                            }}
                          />
                        </div>

                        {isCollapsed && (
                          <button
                            onClick={handleAddRootComment}
                            disabled={replyDisabled}
                            style={{
                              padding: "0.4rem 0.95rem",
                              borderRadius: "999px",
                              border: "none",
                              background: replyDisabled ? "#a0a0a0" : "#000",
                              color: "#fff",
                              cursor: replyDisabled ? "default" : "pointer",
                              fontSize: "0.9rem",
                              fontWeight: 500,
                            }}
                          >
                            Reply
                          </button>
                        )}
                      </div>

                      {!isCollapsed && (
                        <div
                          style={{
                            padding: "0 0.75rem 0.45rem 0.75rem",
                            display: "flex",
                            justifyContent: "flex-end",
                          }}
                        >
                          <button
                            onClick={handleAddRootComment}
                            disabled={replyDisabled}
                            style={{
                              padding: "0.4rem 0.95rem",
                              borderRadius: "999px",
                              border: "none",
                              background: replyDisabled ? "#a0a0a0" : "#000",
                              color: "#fff",
                              cursor: replyDisabled ? "default" : "pointer",
                              fontSize: "0.9rem",
                              fontWeight: 500,
                            }}
                          >
                            {addingRootComment ? "Replying…" : "Reply"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p
                    style={{
                      color: "#666",
                      background: "#fff",
                      border: "1px solid #000000",
                      borderTop: "2px solid #000000", // overrides just the top
                    }}
                  >
                    Log in to reply.
                  </p>

                )}

                {/* REPLIES LIST */}
                {/* REPLIES LIST */}
                <section className="mobileRepliesBottomBorder" style={{ marginTop: 0 }}>
                  {commentsLoading ? (
                    <p>Loading replies…</p>
                  ) : comments.length === 0 ? (
                    <p
                      style={{
                        color: "#666",
                        background: "#fff",
                        border: "1px solid #000000",
                        borderTop: "1px solid #000000", // overrides just the top
                      }}
                    >
                      No replies yet.
                    </p>
                  ) : (
                    <div>
                      {comments.map((c) => {
                        const isOwner = user && user.id === c.user_id;
                        const handle = getHandle(c.user_id);
                        const name = getDisplayName(c.user_id);
                        const initial = getInitial(c.user_id);
                        const avatarUrl = getAvatarUrl(c.user_id);

                        const replyCount = commentReplyCounts[c.id] || 0;
                        const cLikeCount = commentLikeCounts[c.id] || 0;
                        const cLiked = !!commentLikedByMe[c.id];
                        const menuOpen = openMenuCommentId === c.id;

                        return (
                          <CommentRow
                            key={c.id}
                            id={c.id}
                            userId={c.user_id}
                            createdAt={c.created_at}
                            content={c.content}
                            displayName={name}
                            initial={initial}
                            username={handle ?? undefined}
                            avatarUrl={avatarUrl}
                            isOwner={!!isOwner}
                            href={`/comments/${c.id}`}
                            replyCount={replyCount}
                            likeCount={cLikeCount}
                            likedByMe={cLiked}
                            onReplyClick={handleReplyClick}
                            onToggleLike={toggleCommentLike}
                            onEdit={handleEditComment}
                            onDelete={handleDeleteComment}
                            isMenuOpen={menuOpen}
                            onToggleMenu={toggleCommentMenu}
                          />
                        );
                      })}
                    </div>
                  )}
                </section>
              </FeedShell>
            </>
          )}
        </main>

        {/* RIGHT SIDEBAR (sticky) */}
        <aside
          className="postSidebar"
          style={{
            flex: `0 0 ${LAYOUT.sidebarWidth}`,
            maxWidth: LAYOUT.sidebarWidth,
            position: "sticky",
            top: "1.5rem",
            alignSelf: "flex-start",
            height: "fit-content",
          }}
        >
          <RightSidebar />
        </aside>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      {/* ✅ Wrap only when we actually have a post to provide context */}
      {post ? (
        <PostContextHeaderLayout post={post} review={reviewRow}>
          {pageBody}
        </PostContextHeaderLayout>
      ) : (
        pageBody
      )}

      <style jsx global>{`
  @media (max-width: 768px) {
    .postSidebar {
      display: none !important;
    }

    .postMain {
      flex: 1 1 auto !important;
      max-width: 100% !important;
    }

    .postLayoutRow {
      justify-content: flex-start !important;
    }

    /* remove page padding on phones so content is edge-to-edge */
    .postPageWrap {
      padding-left: 0 !important;
      padding-right: 0 !important;
    }

    .mobileMainPostBorders {
  border-top: 1px solid #000 !important;
  border-bottom: 1px solid #000 !important;
}

.mobileRepliesBottomBorder {
  border-bottom: 1px solid #000 !important;
}

  }
`}</style>
    </div>
  );
}
(PostPage as any).hideHeader = true;
