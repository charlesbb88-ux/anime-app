"use client";

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

const TYPO = {
  base: "1rem",
  small: "0.9rem",
};

export default function PostFeed() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [postContent, setPostContent] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [posting, setPosting] = useState(false);

  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedByMe, setLikedByMe] = useState<Record<string, boolean>>({});
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});

  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);

  // map from user_id → username (canonical lowercase handle)
  const [usernamesById, setUsernamesById] = useState<Record<string, string>>(
    {}
  );

  // map from user_id → avatar_url
  const [avatarUrlsById, setAvatarUrlsById] = useState<
    Record<string, string | null>
  >({});

  // current user avatar + username (for composer)
  const [currentUserAvatarUrl, setCurrentUserAvatarUrl] = useState<
    string | null
  >(null);
  const [currentUserUsername, setCurrentUserUsername] = useState<string | null>(
    null
  );

  // 1) Load current user & listen for auth changes
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

  // 1b) Load current user's profile (avatar + username) for composer
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

  // 2) Fetch feed ASAP on mount
  useEffect(() => {
    fetchFeed();
  }, []);

  // 3) Fetch which posts this user liked, once we know user.id
  useEffect(() => {
    if (user && user.id) {
      fetchLikedByMe(user.id);
    } else {
      setLikedByMe({});
    }
  }, [user]);

  // 4) Close dropdown when clicking anywhere else
  useEffect(() => {
    if (!openMenuPostId) return;
    function handleDocumentClick() {
      setOpenMenuPostId(null);
    }
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, [openMenuPostId]);

  async function fetchFeed() {
    setIsLoadingPosts(true);
    try {
      const [
        { data: postsData, error: postsError },
        { data: likesData, error: likesError },
        { data: commentsData, error: commentsError },
      ] = await Promise.all([
        supabase
          .from("posts")
          .select("id, content, created_at, user_id")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("likes").select("post_id, user_id"),
        supabase.from("comments").select("post_id, parent_comment_id"),
      ]);

      // Posts
      let postList: Post[] = [];
      if (postsError) {
        console.error("Error fetching posts:", postsError);
      } else {
        postList = (postsData || []) as Post[];
        setPosts(postList);
      }

      // Like counts
      if (likesError) {
        console.error("Error fetching likes:", likesError);
      } else {
        const counts: Record<string, number> = {};
        (likesData || []).forEach((like: Like) => {
          counts[like.post_id] = (counts[like.post_id] || 0) + 1;
        });
        setLikeCounts(counts);
      }

      // Reply counts (root comments only)
      if (commentsError) {
        console.error("Error fetching comments:", commentsError);
      } else {
        const replyCountMap: Record<string, number> = {};
        (commentsData || []).forEach((c: CommentMeta) => {
          if (c.parent_comment_id === null) {
            replyCountMap[c.post_id] = (replyCountMap[c.post_id] || 0) + 1;
          }
        });
        setReplyCounts(replyCountMap);
      }

      // Fetch usernames + avatars for all post authors
      if (postList.length > 0) {
        const uniqueUserIds = Array.from(
          new Set(postList.map((p) => p.user_id).filter(Boolean))
        );

        if (uniqueUserIds.length > 0) {
          const {
            data: profilesData,
            error: profilesError,
          } = await supabase
            .from("profiles")
            .select("id, username, avatar_url")
            .in("id", uniqueUserIds);

          if (profilesError) {
            console.error("Error fetching profiles:", profilesError);
          } else {
            const profiles = (profilesData || []) as Profile[];
            const usernameMap: Record<string, string> = {};
            const avatarMap: Record<string, string | null> = {};

            profiles.forEach((profile) => {
              if (profile.id) {
                if (profile.username && profile.username.trim()) {
                  usernameMap[profile.id] = profile.username.trim();
                }
                avatarMap[profile.id] = profile.avatar_url ?? null;
              }
            });

            setUsernamesById(usernameMap);
            setAvatarUrlsById(avatarMap);
          }
        } else {
          setUsernamesById({});
          setAvatarUrlsById({});
        }
      } else {
        setUsernamesById({});
        setAvatarUrlsById({});
      }
    } finally {
      setIsLoadingPosts(false);
    }
  }

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
    (data || []).forEach((row: { post_id: string }) => {
      map[row.post_id] = true;
    });

    setLikedByMe(map);
  }

  async function handlePost() {
    if (!user) return;
    const trimmed = postContent.trim();
    if (!trimmed) return;

    setPosting(true);

    const { error } = await supabase.from("posts").insert({
      content: trimmed,
      user_id: user.id,
    });

    setPosting(false);

    if (error) {
      console.error("Error creating post:", error);
      return;
    }

    setPostContent("");
    await fetchFeed();
    if (user && user.id) {
      fetchLikedByMe(user.id);
    }
  }

  // Like handler – opens auth modal when logged out
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

  function openPost(postId: string) {
    router.push(`/posts/${postId}`);
  }

  function openPostFromIcon(postId: string, e: any) {
    e.stopPropagation();
    openPost(postId);
  }

  function toggleMenu(postId: string, e: any) {
    e.stopPropagation();
    setOpenMenuPostId((prev) => (prev === postId ? null : postId));
  }

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

  // ---- display helpers ----

  function getHandle(userId: string): string | null {
    const username = usernamesById[userId];
    if (username && username.trim()) {
      return username.trim(); // already lowercase from UsernameGate rule
    }
    return null;
  }

  function getDisplayName(userId: string): string {
    const handle = getHandle(userId);
    if (handle) {
      return `@${handle}`;
    }
    return `User-${userId.slice(0, 4)}`;
  }

  function getInitialFromUser(userObj: any) {
    if (!userObj) return "U";
    const email: string = userObj.email || "";
    const c = email.trim()[0];
    if (c) return c.toUpperCase();
    return "U";
  }

  function getInitialFromUserId(userId: string) {
    const handle = getHandle(userId);
    if (handle) {
      return handle.charAt(0).toUpperCase();
    }
    return getDisplayName(userId).charAt(0).toUpperCase();
  }

  const currentUserInitial = getInitialFromUser(user);

  // composer avatar node (wrapped in Link if we know username)
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
            display: "block",
          }}
        />
      ) : (
        currentUserInitial
      )}
    </div>
  );

  return (
    <>
      {/* Composer only when logged in */}
      {user && (
        <div
          style={{
            border: "1px solid #11111111",
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
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder="What's happening?"
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
                cursor:
                  posting || !postContent.trim() ? "default" : "pointer",
                fontSize: TYPO.small,
                fontWeight: 500,
              }}
            >
              {posting ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      )}

      {/* Feed – always visible */}
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

            const handle = getHandle(p.user_id); // canonical handle (no @)
            const displayName = getDisplayName(p.user_id);
            const initial = getInitialFromUserId(p.user_id);
            const avatarUrl =
              avatarUrlsById[p.user_id] !== undefined
                ? avatarUrlsById[p.user_id] || undefined
                : undefined;

            return (
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
              />
            );
          })
        )}
      </div>
    </>
  );
}
