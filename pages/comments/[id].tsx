// pages/comments/[id].tsx (or wherever your CommentPage lives)
"use client";

import React, { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import ActionRow from "../../components/ActionRow";
import { supabase } from "../../lib/supabaseClient";
import CommentRow from "../../components/CommentRow";
import ReviewPostRow from "../../components/ReviewPostRow";
import LeftSidebar from "../../components/LeftSidebar";
import RightSidebar from "../../components/RightSidebar";
import { openAuthModal } from "../../lib/openAuthModal";
import PostContextHeaderLayout from "@/components/PostContextHeaderLayout";
import FeedShell from "@/components/FeedShell";
import RichPostRenderer from "@/components/composer/RichPostRenderer";
import PostAttachments from "@/components/composer/PostAttachments";

/* ---------------------- types ---------------------- */

type Post = {
  id: string;
  content: string;

  content_text?: string | null;
  content_json?: any | null;

  created_at: string;
  user_id: string;

  // ✅ match PostPage so PostContextHeaderLayout can render consistently
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

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;

  content_text?: string | null;
  content_json?: any | null;

  attachments?: any[];

  created_at: string;
  parent_comment_id: string | null;
};

type CommentLike = {
  comment_id: string;
  user_id: string;
};

type PostLike = {
  post_id: string;
  user_id: string;
};

type Profile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
};

/* ---------------------- layout tokens (MATCH POST PAGE) ---------------------- */

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

/* ---------------------- helpers ---------------------- */

function formatRelativeTime(dateString: string) {
  const target = new Date(dateString).getTime();
  if (Number.isNaN(target)) return "";

  const now = Date.now();
  const diff = Math.max(0, now - target);

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return `${seconds || 1}s`;
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  if (weeks < 4) return `${weeks}w`;
  if (months < 12) return `${months}mo`;
  return `${years}y`;
}

/* ---------------------- ThreadRow (top section) ---------------------- */

type ThreadRowProps = {
  id: string;
  userId: string;
  createdAt: string;
  content: string;

  contentText?: string | null;
  contentJson?: any | null;
  attachments?: any[];

  displayName: string; // already includes @ when handle exists
  initial: string;
  username?: string; // canonical handle without @
  avatarUrl?: string;

  isMain?: boolean;
  isOwner?: boolean;
  replyCount?: number;
  likeCount?: number;
  likedByMe?: boolean;

  href?: string;

  showConnectorAbove?: boolean;
  showConnectorBelow?: boolean;

  onReplyClick?: (id: string, e: any) => void;
  onToggleLike?: (id: string, e: any) => void;
  onShareClick?: (id: string, e: any) => void;
  onEdit?: (id: string, e: any) => void;
  onDelete?: (id: string, e: any) => void;
  isMenuOpen?: boolean;
  onToggleMenu?: (id: string, e: any) => void;

  onRowClick?: (id: string, e: any) => void;
};

function ThreadRow(props: ThreadRowProps) {
  const router = useRouter();

  const {
    id,
    createdAt,
    content,
    contentText = null,
    contentJson = null,
    attachments = [],
    displayName,
    initial,
    username,
    avatarUrl,
    isMain = false,
    isOwner = false,
    replyCount = 0,
    likeCount = 0,
    likedByMe = false,
    href,
    showConnectorAbove = false,
    showConnectorBelow = false,
    onReplyClick,
    onToggleLike,
    onShareClick,
    onEdit,
    onDelete,
    isMenuOpen,
    onToggleMenu,
    onRowClick,
  } = props;

  const iconSize = isMain ? 22 : 20;
  const avatarCircleSize = isMain ? 52 : 45;
  const avatarWrapperSize = 52;

  const nameFontSize = isMain ? "1.05rem" : "0.95rem";
  const contentFontSize = isMain ? "1.1rem" : "1rem";

  const isClickable = !!(href || onRowClick);
  const [isHovered, setIsHovered] = useState(false);

  function handleRowClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!isClickable) return;
    if (onRowClick) {
      onRowClick(id, e);
      return;
    }
    if (href) router.push(href);
  }

  const avatarBubble = (
    <div
      style={{
        width: avatarCircleSize,
        height: avatarCircleSize,
        borderRadius: "999px",
        background: "#e5e5e5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: isMain ? "1rem" : "0.95rem",
        fontWeight: 600,
        color: "#333",
        flexShrink: 0,
        position: "relative",
        overflow: "hidden",
        zIndex: 1,
      }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={displayName}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        initial
      )}
    </div>
  );

  const avatarWithOptionalLink = username ? (
    <Link
      href={`/${username}`}
      onClick={(e) => e.stopPropagation()}
      style={{ display: "inline-flex" }}
    >
      {avatarBubble}
    </Link>
  ) : (
    avatarBubble
  );

  const body = (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: "0.75rem",
        padding: "0.7rem 0.8rem 0.3rem 0.8rem",
      }}
    >
      {/* avatar + vertical connector */}
      <div
        style={{
          position: "relative",
          width: avatarWrapperSize,
          display: "flex",
          justifyContent: "center",
          alignSelf: "stretch",
          marginRight: "0.4rem",
        }}
      >
        {(showConnectorAbove || showConnectorBelow) && (
          <div
            style={{
              position: "absolute",
              top: showConnectorAbove ? -36 : avatarCircleSize / 2,
              bottom: showConnectorBelow ? -36 : `calc(100% - ${avatarCircleSize / 2}px)`,
              left: "50%",
              transform: "translateX(-50%)",
              borderLeft: "1px solid #e0e0e0",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        )}

        {avatarWithOptionalLink}
      </div>

      {/* text */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            marginBottom: "0.15rem",
          }}
        >
          {username ? (
            <Link
              href={`/${username}`}
              onClick={(e) => e.stopPropagation()}
              style={{
                fontSize: nameFontSize,
                fontWeight: 500,
                color: "#333",
                textDecoration: "none",
              }}
            >
              {displayName}
            </Link>
          ) : (
            <span
              style={{
                fontSize: nameFontSize,
                fontWeight: 500,
                color: "#333",
              }}
            >
              {displayName}
            </span>
          )}

          <span
            style={{
              color: "#777",
              fontSize: "0.8rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 3,
                height: 3,
                borderRadius: "999px",
                backgroundColor: "#999",
              }}
            />
            {formatRelativeTime(createdAt)}
          </span>
        </div>

        <div
          style={{
            margin: 0,
            fontSize: contentFontSize,
            fontWeight: 400,
            lineHeight: 1.5,
            wordBreak: "break-word",
          }}
        >
          <RichPostRenderer
            json={contentJson}
            fallbackText={contentText ?? content}
          />

          {!!attachments?.length && (
            <div style={{ marginTop: "0.5rem" }}>
              <PostAttachments items={attachments as any} />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: "relative",
        border: "none",
        background: isClickable && isHovered ? "#f7f9fb" : "#ffffff",
        cursor: isClickable ? "pointer" : "default",
        transition: "background 0.12s ease",
      }}
      onClick={handleRowClick}
      onMouseEnter={() => {
        if (isClickable) setIsHovered(true);
      }}
      onMouseLeave={() => {
        if (isClickable) setIsHovered(false);
      }}
    >
      {/* owner menu */}
      {isOwner && onToggleMenu && (
        <div
          style={{
            position: "absolute",
            top: "0.55rem",
            right: "0.5rem",
            zIndex: 10,
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu(id, e);
            }}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: "0 0.3rem",
              fontSize: "1.1rem",
              lineHeight: 1,
              color: "#555",
            }}
          >
            ⋯
          </button>

          {isMenuOpen && (
            <div
              style={{
                position: "absolute",
                top: "1.5rem",
                right: 0,
                background: "#fff",
                border: "1px solid #ddd",
                borderRadius: "4px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                minWidth: "130px",
                zIndex: 20,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(id, e);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "0.4rem 0.7rem",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    color: "#333",
                  }}
                >
                  Edit
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(id, e);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "0.4rem 0.7rem",
                    borderTop: "1px solid #eee",
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    color: "#b00000",
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {body}

      <ActionRow
        variant={isMain ? "main" : "feed"}
        iconSize={iconSize}
        replyCount={replyCount}
        likeCount={likeCount}
        likedByMe={likedByMe}
        onReply={(e: React.MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          onReplyClick?.(id, e);
        }}
        onLike={(e: React.MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          onToggleLike?.(id, e);
        }}
        sharePath={`/posts/${id}`}
      />
    </div>
  );
}

/* ---------------------- page ---------------------- */

export default function CommentPage() {
  const router = useRouter();
  const { id } = router.query;

  const [user, setUser] = useState<any>(null);

  const [post, setPost] = useState<Post | null>(null);
  const [reviewRow, setReviewRow] = useState<ReviewRow | null>(null);

  const [postAttachments, setPostAttachments] = useState<any[]>([]);

  // ✅ extra bits so the root review post looks like PostPage
  const [reviewAnime, setReviewAnime] = useState<AnimeRow | null>(null);
  const [reviewManga, setReviewManga] = useState<MangaRow | null>(null);
  const [episodeNum, setEpisodeNum] = useState<number | null>(null);
  const [chapterNum, setChapterNum] = useState<number | null>(null);

  const [mainComment, setMainComment] = useState<Comment | null>(null);
  const [ancestors, setAncestors] = useState<Comment[]>([]);
  const [replies, setReplies] = useState<Comment[]>([]);

  const [loading, setLoading] = useState(true);
  const [repliesLoading, setRepliesLoading] = useState(true);

  const [replyInput, setReplyInput] = useState("");
  const [addingReply, setAddingReply] = useState(false);
  const [replyActive, setReplyActive] = useState(false);
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [openMenuCommentId, setOpenMenuCommentId] = useState<string | null>(
    null
  );

  const [commentLikeCounts, setCommentLikeCounts] = useState<
    Record<string, number>
  >({});
  const [commentLikedByMe, setCommentLikedByMe] = useState<
    Record<string, boolean>
  >({});
  const [commentReplyCounts, setCommentReplyCounts] = useState<
    Record<string, number>
  >({});

  const [postLikeCount, setPostLikeCount] = useState(0);
  const [postLikedByMe, setPostLikedByMe] = useState(false);
  const [postReplyCount, setPostReplyCount] = useState(0);

  const [usernamesById, setUsernamesById] = useState<Record<string, string>>(
    {}
  );
  const [avatarUrlsById, setAvatarUrlsById] = useState<
    Record<string, string | null>
  >({});

  const [currentUserAvatarUrl, setCurrentUserAvatarUrl] = useState<
    string | null
  >(null);
  const [currentUserUsername, setCurrentUserUsername] = useState<string | null>(
    null
  );

  /* ---------- auth ---------- */

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
        data?.username && data.username.trim() ? data.username.trim() : null;
      setCurrentUserUsername(uname);
    }

    loadSelfProfile();
  }, [user]);

  /* ---------- close menu on outside click ---------- */

  useEffect(() => {
    if (!openMenuCommentId) return;

    function handleDocumentClick() {
      setOpenMenuCommentId(null);
    }

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, [openMenuCommentId]);

  /* ---------- load context ---------- */

  useEffect(() => {
    if (!id) return;
    const commentId = id as string;
    loadCommentAndContext(commentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  async function loadCommentAndContext(commentId: string) {
    setLoading(true);

    // reset review visuals each load
    setReviewAnime(null);
    setReviewManga(null);
    setEpisodeNum(null);
    setChapterNum(null);

    // main comment
    const { data: commentData, error: commentError } = await supabase
      .from("comments")
      .select("id, post_id, user_id, content, content_text, content_json, created_at, parent_comment_id")
      .eq("id", commentId)
      .single();

    if (commentError || !commentData) {
      console.error("Error loading comment:", commentError);
      setLoading(false);
      return;
    }

    const main = commentData as Comment;
    setMainComment(main);

    // post (✅ select the same fields as PostPage so layout/backdrop matches)
    const { data: postData, error: postError } = await supabase
      .from("posts")
      .select(
        "id, content, created_at, user_id, anime_id, anime_episode_id, manga_id, manga_chapter_id, review_id"
      )
      .eq("id", main.post_id)
      .single();

    if (postError || !postData) {
      console.error("Error loading post:", postError);
      setPost(null);
      setReviewRow(null);
      setLoading(false);
      return;
    }

    const postRecord = postData as Post;
    setPost(postRecord);

    // ✅ root post attachments (top portion)
    const { data: pAtt, error: pAttErr } = await supabase
      .from("post_attachments")
      .select("id, kind, url, meta, sort_order, width, height")
      .eq("post_id", postRecord.id)
      .order("sort_order", { ascending: true });

    if (pAttErr) console.error("Error loading post attachments:", pAttErr);
    setPostAttachments(pAtt ?? []);

    // review row + origin media + ep/ch labels (only if post is a review post)
    if (postRecord.review_id) {
      const { data: r, error: rErr } = await supabase
        .from("reviews")
        .select(
          "id, rating, contains_spoilers, author_liked, anime_id, anime_episode_id, manga_id, manga_chapter_id"
        )
        .eq("id", postRecord.review_id)
        .single();

      if (rErr || !r) {
        console.error("Error loading review row:", rErr);
        setReviewRow(null);
      } else {
        const rr = r as ReviewRow;
        setReviewRow(rr);

        const effectiveAnimeId = rr.anime_id ?? postRecord.anime_id;
        const effectiveMangaId = rr.manga_id ?? postRecord.manga_id;

        const effectiveEpisodeId =
          rr.anime_episode_id ?? postRecord.anime_episode_id;
        const effectiveChapterId =
          rr.manga_chapter_id ?? postRecord.manga_chapter_id;

        // origin anime/manga (poster/title/slug)
        if (effectiveAnimeId) {
          const { data: a, error: aErr } = await supabase
            .from("anime")
            .select("id, slug, title, image_url")
            .eq("id", effectiveAnimeId)
            .single();

          if (aErr) {
            console.error("Error loading review anime:", aErr);
          } else {
            setReviewAnime(a as AnimeRow);
          }
        } else if (effectiveMangaId) {
          const { data: m, error: mErr } = await supabase
            .from("manga")
            .select("id, slug, title, image_url")
            .eq("id", effectiveMangaId)
            .single();

          if (mErr) {
            console.error("Error loading review manga:", mErr);
          } else {
            setReviewManga(m as MangaRow);
          }
        }

        // episode number (optional)
        if (effectiveEpisodeId) {
          const { data: ep, error: epErr } = await supabase
            .from("anime_episodes")
            .select("episode_number")
            .eq("id", effectiveEpisodeId)
            .single();

          if (epErr) {
            console.error("Error loading episode_number:", epErr);
          } else {
            const nRaw = (ep as any)?.episode_number;
            const n =
              typeof nRaw === "number"
                ? nRaw
                : nRaw != null
                  ? Number(nRaw)
                  : null;
            setEpisodeNum(Number.isFinite(n as any) ? (n as number) : null);
          }
        }

        // chapter number (optional)
        if (effectiveChapterId) {
          const { data: ch, error: chErr } = await supabase
            .from("manga_chapters")
            .select("chapter_number")
            .eq("id", effectiveChapterId)
            .single();

          if (chErr) {
            console.error("Error loading chapter_number:", chErr);
          } else {
            const nRaw = (ch as any)?.chapter_number;
            const n =
              typeof nRaw === "number"
                ? nRaw
                : nRaw != null
                  ? Number(nRaw)
                  : null;
            setChapterNum(Number.isFinite(n as any) ? (n as number) : null);
          }
        }
      }
    } else {
      setReviewRow(null);
    }

    // post likes
    const { data: postLikes, error: postLikesError } = await supabase
      .from("likes")
      .select("post_id, user_id")
      .eq("post_id", postRecord.id);

    if (postLikesError) {
      console.error("Error loading post likes:", postLikesError);
      setPostLikeCount(0);
      setPostLikedByMe(false);
    } else {
      const likes = (postLikes || []) as PostLike[];
      setPostLikeCount(likes.length);
      setPostLikedByMe(user ? likes.some((l) => l.user_id === user.id) : false);
    }

    // post reply count (root-level comments)
    const { data: postComments, error: postCommentsError } = await supabase
      .from("comments")
      .select("id")
      .eq("post_id", postRecord.id)
      .is("parent_comment_id", null);

    if (postCommentsError) {
      console.error("Error loading post reply count:", postCommentsError);
      setPostReplyCount(0);
    } else {
      setPostReplyCount((postComments || []).length);
    }

    // ancestor chain
    const chain: Comment[] = [];
    let currentParentId = main.parent_comment_id;

    while (currentParentId) {
      const { data: parentData, error: parentError } = await supabase
        .from("comments")
        .select("id, post_id, user_id, content, content_text, content_json, created_at, parent_comment_id")
        .eq("id", currentParentId)
        .single();

      if (parentError || !parentData) {
        console.error("Error loading parent comment:", parentError);
        break;
      }

      const parent = parentData as Comment;
      chain.push(parent);
      currentParentId = parent.parent_comment_id;
    }

    chain.reverse();
    setAncestors(chain);

    // ✅ attachments for ancestor chain + main comment (top portion)
    {
      const threadIds = [main.id, ...chain.map((c) => c.id)];

      if (threadIds.length > 0) {
        const { data: attRows, error: attErr } = await supabase
          .from("comment_attachments")
          .select("id, comment_id, kind, url, meta, sort_order, width, height")
          .in("comment_id", threadIds)
          .order("sort_order", { ascending: true });

        if (attErr) console.error("Error loading thread comment attachments:", attErr);

        const attByComment: Record<string, any[]> = {};
        (attRows ?? []).forEach((a: any) => {
          const k = a.comment_id;
          if (!attByComment[k]) attByComment[k] = [];
          attByComment[k].push(a);
        });

        setMainComment((prev) =>
          prev ? { ...prev, attachments: attByComment[prev.id] ?? [] } : prev
        );

        setAncestors((prev) =>
          (prev ?? []).map((c) => ({ ...c, attachments: attByComment[c.id] ?? [] }))
        );
      }
    }

    // replies to main comment
    const replyList = await loadReplies(main.id);

    // counts/likes for all visible comments
    const ids: string[] = [
      main.id,
      ...chain.map((c) => c.id),
      ...replyList.map((c) => c.id),
    ];

    if (ids.length > 0) {
      // reply counts
      const { data: replyRows, error: replyError } = await supabase
        .from("comments")
        .select("id, parent_comment_id")
        .in("parent_comment_id", ids);

      if (replyError) {
        console.error("Error loading reply counts:", replyError);
      } else {
        const replyMap: Record<string, number> = {};
        (replyRows || []).forEach((row: any) => {
          if (row.parent_comment_id) {
            replyMap[row.parent_comment_id] =
              (replyMap[row.parent_comment_id] || 0) + 1;
          }
        });
        setCommentReplyCounts(replyMap);
      }

      // likes for comments
      const { data: likeRows, error: likeError } = await supabase
        .from("comment_likes")
        .select("comment_id, user_id")
        .in("comment_id", ids);

      if (likeError) {
        console.error("Error loading comment likes:", likeError);
      } else {
        const counts: Record<string, number> = {};
        const likedMap: Record<string, boolean> = {};

        (likeRows || []).forEach((row: CommentLike) => {
          counts[row.comment_id] = (counts[row.comment_id] || 0) + 1;
          if (user && row.user_id === user.id) {
            likedMap[row.comment_id] = true;
          }
        });

        setCommentLikeCounts(counts);
        setCommentLikedByMe(likedMap);
      }
    } else {
      setCommentReplyCounts({});
      setCommentLikeCounts({});
      setCommentLikedByMe({});
    }

    // load profiles for everyone in this thread
    const userIdSet = new Set<string>();
    userIdSet.add(postRecord.user_id);
    userIdSet.add(main.user_id);
    chain.forEach((c) => userIdSet.add(c.user_id));
    replyList.forEach((c) => userIdSet.add(c.user_id));

    const userIds = Array.from(userIdSet);
    if (userIds.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", userIds);

      if (profileError) {
        console.error("Error loading profiles:", profileError);
      } else {
        const unameMap: Record<string, string> = {};
        const avatarMap: Record<string, string | null> = {};

        (profileRows || []).forEach((p: Profile) => {
          if (p.username && p.username.trim()) {
            unameMap[p.id] = p.username.trim();
          }
          avatarMap[p.id] = p.avatar_url ?? null;
        });

        setUsernamesById(unameMap);
        setAvatarUrlsById(avatarMap);
      }
    } else {
      setUsernamesById({});
      setAvatarUrlsById({});
    }

    setLoading(false);
  }

  async function loadReplies(commentId: string): Promise<Comment[]> {
    setRepliesLoading(true);

    const { data, error } = await supabase
      .from("comments")
      .select("id, post_id, user_id, content, content_text, content_json, created_at, parent_comment_id")
      .eq("parent_comment_id", commentId)
      .order("created_at", { ascending: true });

    setRepliesLoading(false);

    if (error) {
      console.error("Error loading replies:", error);
      setReplies([]);
      return [];
    }

    const list = (data || []) as Comment[];
    setReplies(list);
    return list;
  }

  /* ---------- textarea auto-grow ---------- */

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    const maxHeight = 20 * 24;
    const newHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${newHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }

  /* ---------- add reply (to main comment) ---------- */

  async function handleAddReply() {
    if (!user || !mainComment) return;

    const text = replyInput.trim();
    if (!text) return;

    setAddingReply(true);

    const { error } = await supabase.from("comments").insert({
      post_id: mainComment.post_id,
      user_id: user.id,
      content: text,
      parent_comment_id: mainComment.id,
    });

    setAddingReply(false);

    if (error) {
      console.error("Error adding reply:", error);
      return;
    }

    setReplyInput("");
    setReplyActive(false);

    if (replyTextareaRef.current) {
      replyTextareaRef.current.style.height = "24px";
      replyTextareaRef.current.style.overflowY = "hidden";
    }

    await loadCommentAndContext(mainComment.id);
  }

  /* ---------- edit / delete ---------- */

  async function handleEditComment(id: string, e: any) {
    e.stopPropagation();
    if (!user) return;

    const allComments: Comment[] = [
      ...(ancestors || []),
      ...(mainComment ? [mainComment] : []),
      ...(replies || []),
    ];

    const c = allComments.find((cm) => cm.id === id);
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

    setMainComment((prev) =>
      prev && prev.id === c.id ? { ...prev, content: trimmed } : prev
    );
    setAncestors((prev) =>
      prev.map((cm) => (cm.id === c.id ? { ...cm, content: trimmed } : cm))
    );
    setReplies((prev) =>
      prev.map((cm) => (cm.id === c.id ? { ...cm, content: trimmed } : cm))
    );

    setOpenMenuCommentId(null);
  }

  async function handleDeleteComment(id: string, e: any) {
    e.stopPropagation();
    if (!user) return;

    const allComments: Comment[] = [
      ...(ancestors || []),
      ...(mainComment ? [mainComment] : []),
      ...(replies || []),
    ];

    const c = allComments.find((cm) => cm.id === id);
    if (!c || user.id !== c.user_id) return;

    const ok = window.confirm("Delete this comment?");
    if (!ok) return;

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

    // if main comment deleted, go back to post
    if (mainComment && c.id === mainComment.id) {
      if (post) router.push(`/posts/${post.id}`);
      else router.push("/");
      return;
    }

    if (mainComment) {
      await loadCommentAndContext(mainComment.id);
    }
  }

  /* ---------- like toggle for comments ---------- */

  async function toggleCommentLike(commentId: string, e: any) {
    e.stopPropagation();

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

  /* ---------- like toggle for origin post ---------- */

  async function handleTogglePostLike(postId: string, e: any) {
    e.stopPropagation();

    if (!user) {
      openAuthModal();
      return;
    }

    if (!post || postId !== post.id) return;

    if (postLikedByMe) {
      const { error } = await supabase
        .from("likes")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error unliking post:", error);
        return;
      }

      setPostLikedByMe(false);
      setPostLikeCount((prev) => Math.max(0, prev - 1));
    } else {
      const { error } = await supabase.from("likes").insert({
        post_id: post.id,
        user_id: user.id,
      });

      if (error) {
        console.error("Error liking post:", error);
        return;
      }

      setPostLikedByMe(true);
      setPostLikeCount((prev) => prev + 1);
    }
  }

  /* ---------- menu helper ---------- */

  function toggleCommentMenu(commentId: string, e: any) {
    e.stopPropagation();
    setOpenMenuCommentId((prev) =>
      prev === commentId ? null : prev ? null : commentId
    );
  }

  /* ---------- navigation helpers ---------- */

  function openCommentFromIcon(commentId: string, e: any) {
    e.stopPropagation();
    router.push(`/comments/${commentId}`);
  }

  function handleReplyClick(commentId: string, e: any) {
    openCommentFromIcon(commentId, e);
  }

  function handleMainReplyClick(_id: string, e: any) {
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

  /* ---------- identity helpers ---------- */

  function getHandle(userId: string): string | null {
    const u = usernamesById[userId];
    if (u && u.trim()) return u.trim();
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

  const currentUserInitial = getInitialFromUser(user);
  const replyDisabled = addingReply || !replyInput.trim();
  const isCollapsed = !replyActive && !replyInput.trim();

  function handleReplyInputChange(e: any) {
    setReplyInput(e.target.value);
    if (replyTextareaRef.current) autoGrow(replyTextareaRef.current);
  }

  function handleReplyBlur() {
    if (!replyInput.trim()) {
      setReplyActive(false);
      if (replyTextareaRef.current) {
        replyTextareaRef.current.style.height = "24px";
        replyTextareaRef.current.style.overflowY = "hidden";
      }
    }
  }

  /* ---------- thread items ---------- */

  const threadItems =
    post && mainComment
      ? [
        { type: "post" as const, item: post },
        ...ancestors.map((c) => ({ type: "comment" as const, item: c })),
        { type: "comment" as const, item: mainComment },
      ]
      : [];

  /* ---------- back link ---------- */

  function handleBackClick(
    e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>
  ) {
    e.preventDefault();

    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    if (post) router.push(`/posts/${post.id}`);
    else router.push("/");
  }

  /* ---------- composer avatar node ---------- */

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
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentUserAvatarUrl}
          alt="Your avatar"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        currentUserInitial
      )}
    </div>
  );

  /* ---------------------- page body (MATCH POST PAGE LAYOUT) ---------------------- */

  const pageBody = (
    <div
      className="postPageWrap"
      style={{
        maxWidth: LAYOUT.pageMaxWidth,
        margin: "0 auto",
        padding: `${LAYOUT.pagePaddingY} ${LAYOUT.pagePaddingX}`,
      }}
    >
      <div
        className="postLayoutRow"
        style={{
          display: "flex",
          justifyContent: "center",
          gap: LAYOUT.columnGap,
        }}
      >
        {/* LEFT SIDEBAR */}
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

        {/* CENTER */}
        <main
          className="postMain"
          style={{
            flex: `0 0 ${LAYOUT.mainWidth}`,
            maxWidth: LAYOUT.mainWidth,
          }}
        >
          {loading || !post || !mainComment ? (
            <p style={{ marginTop: "1rem" }}>Loading thread…</p>
          ) : (
            <>
              {/* THREAD (wrapped like PostPage) */}
              <FeedShell>
                <div className="threadSectionBorders">
                  {threadItems.map((entry, index) => {
                    const isFirst = index === 0;
                    const isLast = index === threadItems.length - 1;

                    const showConnectorAbove = !isFirst;
                    const showConnectorBelow = !isLast;

                    if (entry.type === "post") {
                      const p = entry.item as Post;
                      const handle = getHandle(p.user_id);
                      const avatarUrl = getAvatarUrl(p.user_id);

                      // ✅ if the root post is a review, render it like PostPage does
                      if (p.review_id) {
                        const originTitle =
                          reviewAnime?.title ?? reviewManga?.title ?? "";
                        const posterUrl =
                          reviewAnime?.image_url ?? reviewManga?.image_url ?? null;

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

                        const episodeLabel =
                          episodeNum != null ? `Ep ${episodeNum}` : undefined;
                        const episodeHref =
                          reviewAnime?.slug && episodeNum != null
                            ? `/anime/${reviewAnime.slug}/episode/${episodeNum}`
                            : undefined;

                        const chapterLabel =
                          chapterNum != null ? `Ch ${chapterNum}` : undefined;
                        const chapterHref =
                          reviewManga?.slug && chapterNum != null
                            ? `/manga/${reviewManga.slug}/chapter/${chapterNum}`
                            : undefined;

                        return (
                          <div style={{ position: "relative", background: "#fff" }}>
                            <ReviewPostRow
                              key={`post-${p.id}`}
                              postId={p.id}
                              reviewId={p.review_id}
                              userId={p.user_id}
                              createdAt={p.created_at}
                              content={p.content}
                              contentText={p.content_text ?? null}
                              contentJson={p.content_json ?? null}
                              attachments={postAttachments}
                              rating={reviewRow?.rating ?? null}
                              containsSpoilers={!!reviewRow?.contains_spoilers}
                              authorLiked={!!reviewRow?.author_liked}
                              displayName={getDisplayName(p.user_id)}
                              username={handle ?? undefined}
                              avatarUrl={avatarUrl ?? null}
                              initial={getInitial(p.user_id)}
                              originLabel={originTitle}
                              originHref={originHref}
                              episodeLabel={episodeLabel}
                              episodeHref={episodeHref}
                              chapterLabel={chapterLabel}
                              chapterHref={chapterHref}
                              posterUrl={posterUrl}
                              href={`/posts/${p.id}`}
                              isOwner={false}
                              replyCount={postReplyCount}
                              likeCount={postLikeCount}
                              likedByMe={postLikedByMe}
                              onToggleLike={handleTogglePostLike}
                              disableHoverHighlight
                            />
                            {showConnectorBelow && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: `calc(0.7rem + 45px)`,
                                  bottom: -36,
                                  left: `calc(0.8rem + ${52 / 2}px)`,
                                  transform: "translateX(-50%)",
                                  borderLeft: "1px solid #e0e0e0",
                                  pointerEvents: "none",
                                  zIndex: 0,
                                }}
                              />
                            )}

                            {/* TOP */}
                            <div
                              style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                height: 1,
                                background: "#fff",
                                pointerEvents: "none",
                              }}
                            />

                            {/* BOTTOM */}
                            <div
                              style={{
                                position: "absolute",
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: 1,
                                background: "#fff",
                                pointerEvents: "none",
                              }}
                            />

                            {/* LEFT */}
                            <div
                              style={{
                                position: "absolute",
                                top: 0,
                                bottom: 0,
                                left: 0,
                                width: 1,
                                background: "#fff",
                                pointerEvents: "none",
                              }}
                            />

                            {/* RIGHT */}
                            <div
                              style={{
                                position: "absolute",
                                top: 0,
                                bottom: 0,
                                right: 0,
                                width: 1,
                                background: "#fff",
                                pointerEvents: "none",
                              }}
                            />
                          </div>
                        );
                      }

                      // normal post stays as-is
                      return (
                        <ThreadRow
                          key={`post-${p.id}`}
                          id={p.id}
                          userId={p.user_id}
                          createdAt={p.created_at}
                          content={p.content}
                          contentText={p.content_text ?? null}
                          contentJson={p.content_json ?? null}
                          attachments={postAttachments}
                          displayName={getDisplayName(p.user_id)}
                          initial={getInitial(p.user_id)}
                          username={handle ?? undefined}
                          avatarUrl={avatarUrl}
                          href={`/posts/${p.id}`}
                          showConnectorAbove={showConnectorAbove}
                          showConnectorBelow={showConnectorBelow}
                          isOwner={false}
                          replyCount={postReplyCount}
                          likeCount={postLikeCount}
                          likedByMe={postLikedByMe}
                          onToggleLike={handleTogglePostLike}
                        />
                      );
                    }

                    const c = entry.item as Comment;
                    const isOwner = !!(user && user.id === c.user_id);
                    const isMainRow = mainComment && c.id === mainComment.id;
                    const handle = getHandle(c.user_id);
                    const avatarUrl = getAvatarUrl(c.user_id);

                    return (
                      <ThreadRow
                        key={c.id}
                        id={c.id}
                        userId={c.user_id}
                        createdAt={c.created_at}
                        content={c.content}
                        contentText={c.content_text ?? null}
                        contentJson={c.content_json ?? null}
                        attachments={c.attachments ?? []}
                        displayName={getDisplayName(c.user_id)}
                        initial={getInitial(c.user_id)}
                        username={handle ?? undefined}
                        avatarUrl={avatarUrl}
                        isMain={!!isMainRow}
                        isOwner={isOwner}
                        href={isMainRow ? undefined : `/comments/${c.id}`}
                        replyCount={
                          isMainRow ? replies.length : commentReplyCounts[c.id] || 0
                        }
                        likeCount={commentLikeCounts[c.id] || 0}
                        likedByMe={!!commentLikedByMe[c.id]}
                        onReplyClick={isMainRow ? handleMainReplyClick : handleReplyClick}
                        onToggleLike={toggleCommentLike}
                        onEdit={handleEditComment}
                        onDelete={handleDeleteComment}
                        isMenuOpen={openMenuCommentId === c.id}
                        onToggleMenu={toggleCommentMenu}
                        showConnectorAbove={showConnectorAbove}
                        showConnectorBelow={showConnectorBelow}
                      />
                    );
                  })}
                </div>
              </FeedShell>

              {/* COMPOSER + REPLIES (wrapped like PostPage) */}
              <div style={{ marginTop: "0.75rem" }} />
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
                            onClick={(e) => e.stopPropagation()}
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
                            id="comment-reply-input"
                            ref={replyTextareaRef}
                            value={replyInput}
                            onChange={handleReplyInputChange}
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
                            onClick={handleAddReply}
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
                            onClick={handleAddReply}
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
                            {addingReply ? "Replying…" : "Reply"}
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
                      borderTop: "2px solid #000000",
                      padding: "0.65rem 0.75rem",
                      margin: 0,
                    }}
                  >
                    Log in to reply.
                  </p>
                )}

                {/* Replies list */}
                <section
                  className="mobileRepliesBottomBorder"
                  style={{ marginTop: 0 }}
                >
                  {repliesLoading ? (
                    <p style={{ marginTop: "0.6rem" }}>Loading replies…</p>
                  ) : replies.length === 0 ? (
                    <p
                      style={{
                        color: "#666",
                        background: "#fff",
                        border: "1px solid #000000",
                        borderTop: "1px solid #000000",
                        padding: "0.65rem 0.75rem",
                        margin: 0,
                      }}
                    >
                      No replies yet.
                    </p>
                  ) : (
                    <div>
                      {replies.map((c) => {
                        const isOwner = user && user.id === c.user_id;
                        const handle = getHandle(c.user_id);
                        const avatarUrl = getAvatarUrl(c.user_id);

                        return (
                          <CommentRow
                            key={c.id}
                            id={c.id}
                            userId={c.user_id}
                            createdAt={c.created_at}
                            content={c.content}
                            contentText={c.content_text ?? null}
                            contentJson={c.content_json ?? null}
                            attachments={c.attachments ?? []}
                            displayName={getDisplayName(c.user_id)}
                            initial={getInitial(c.user_id)}
                            username={handle ?? undefined}
                            avatarUrl={avatarUrl}
                            isOwner={!!isOwner}
                            href={`/comments/${c.id}`}
                            replyCount={commentReplyCounts[c.id] || 0}
                            likeCount={commentLikeCounts[c.id] || 0}
                            likedByMe={!!commentLikedByMe[c.id]}
                            onReplyClick={handleReplyClick}
                            onToggleLike={toggleCommentLike}
                            onEdit={handleEditComment}
                            onDelete={handleDeleteComment}
                            isMenuOpen={openMenuCommentId === c.id}
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

        {/* RIGHT SIDEBAR */}
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

  /* ---------------------- wrap with same backdrop system as PostPage ---------------------- */

  return (
    <div style={{ minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      {post ? (
        <PostContextHeaderLayout post={post} review={reviewRow}>
          {pageBody}
        </PostContextHeaderLayout>
      ) : (
        pageBody
      )}

      <style jsx global>{`
      /* THREAD borders:
   - top/bottom always
   - left/right only on non-phone (default) */
.threadSectionBorders {
  border-top: 2px solid #000;
  border-bottom: 2px solid #000;
  border-left: 1px solid #000;
  border-right: 1px solid #000;
}

        @media (max-width: 768px) {
          .postSidebar {
            display: none !important;
            .threadSectionBorders {
  border-left: none !important;
  border-right: none !important;
}
          }

          .postMain {
            flex: 1 1 auto !important;
            max-width: 100% !important;
          }

          .postLayoutRow {
            justify-content: flex-start !important;
          }

          /* edge-to-edge on phones, same as PostPage */
          .postPageWrap {
            padding-left: 0 !important;
            padding-right: 0 !important;
          }

          .mobileRepliesBottomBorder {
            border-bottom: 1px solid #000 !important;
          }
        }
      `}</style>
    </div>
  );
}

(CommentPage as any).hideHeader = true;
