"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient"; // adjust path if needed
import FeedShell from "@/components/FeedShell";
import UserSidebarStatsCard from "@/components/UserSidebarStatsCard";

type TopUserRow = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  reviews_written: number;
  responses_received: number;
  likes_received: number;
  score: number;
};

type TopReviewRow = {
  review_id: string;
  post_id?: string | null; // ✅ add this

  author_id: string;
  author_username: string;
  author_avatar_url: string | null;

  anime_id: string | null;
  anime_slug: string | null;
  anime_title: string | null;
  anime_image_url: string | null;

  manga_id: string | null;
  manga_slug: string | null;
  manga_title: string | null;
  manga_image_url: string | null;

  content: string;
  created_at: string;

  replies_count: number;
  likes_count: number;
  score: number;
};

function clampText(s: string, max: number) {
  const t = (s ?? "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function TopUserCard(props: { topUser: TopUserRow | null; loading: boolean; error: string | null }) {
  const { topUser, loading, error } = props;

  return (
    <div style={{ padding: "1rem 1.1rem" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={{ fontSize: "0.95rem", fontWeight: 800 }}>Top User</div>
        <div style={{ fontSize: "0.85rem", color: "#777" }}>This week</div>
      </div>

      <div style={{ height: 10 }} />

      {loading && <div style={{ fontSize: "0.9rem", color: "#777" }}>Loading…</div>}
      {!loading && error && <div style={{ fontSize: "0.9rem", color: "#b00000" }}>{error}</div>}
      {!loading && !error && !topUser && (
        <div style={{ fontSize: "0.9rem", color: "#777" }}>No activity yet this week.</div>
      )}

      {!loading && !error && topUser && (
        <Link href={`/${topUser.username}`} style={{ textDecoration: "none", color: "inherit" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: 5,
            }}
          >
            {/* big avatar */}
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: 999,
                background: "#111",
                border: "2px solid rgba(255,255,255,0.12)",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              {topUser.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={topUser.avatar_url}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : null}
            </div>

            {/* username */}
            <div
              style={{
                fontSize: "1.05rem",
                fontWeight: 900,
                color: "#000000",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={topUser.username}
            >
              {topUser.username}
            </div>

            {/* ✅ stats directly under username */}
            <UserSidebarStatsCard userId={topUser.user_id} variant="inline" />
          </div>
        </Link>
      )}
    </div>
  );
}

function TopReviewCard(props: { topReview: TopReviewRow | null; loading: boolean; error: string | null }) {
  const { topReview, loading, error } = props;

  return (
    <div style={{ padding: "1rem 1.1rem" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={{ fontSize: "0.95rem", fontWeight: 800 }}>Top Review</div>
        <div style={{ fontSize: "0.85rem", color: "#777" }}>This week</div>
      </div>

      <div style={{ height: 10 }} />

      {loading && <div style={{ fontSize: "0.9rem", color: "#777" }}>Loading…</div>}
      {!loading && error && <div style={{ fontSize: "0.9rem", color: "#b00000" }}>{error}</div>}
      {!loading && !error && !topReview && (
        <div style={{ fontSize: "0.9rem", color: "#777" }}>No reviews yet this week.</div>
      )}

      {!loading && !error && topReview &&
        (() => {
          const isAnime = !!topReview.anime_id;

          const mediaTitle = isAnime ? topReview.anime_title : topReview.manga_title;
          const mediaSlug = isAnime ? topReview.anime_slug : topReview.manga_slug;
          const mediaImg = isAnime ? topReview.anime_image_url : topReview.manga_image_url;

          const mediaHref = isAnime ? `/anime/${mediaSlug}` : `/manga/${mediaSlug}`;

          const postHref = topReview.post_id ? `/posts/${topReview.post_id}` : "#";

          return (
            <Link
              href={postHref}
              onClick={(e) => {
                if (!topReview.post_id) e.preventDefault(); // ✅ prevent broken nav
              }}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  cursor: "pointer",
                }}
              >
                {/* media cover */}
                <div
                  style={{
                    width: 42,
                    height: 58,
                    borderRadius: 8,
                    background: "#eaeaea",
                    border: "1px solid #ddd",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  {mediaImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaImg}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  ) : null}
                </div>

                {/* IMPORTANT: minWidth:0 lets flex children shrink; the text wrapping below prevents long words from overflowing */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  {/* media title */}
                  <div
                    style={{
                      fontSize: "0.92rem",
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "100%",
                    }}
                    title={mediaTitle ?? ""}
                  >
                    {mediaTitle ?? (isAnime ? "Anime" : "Manga")}
                  </div>

                  {/* author */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginTop: 4 }}>
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 999,
                        background: "#eaeaea",
                        border: "1px solid #ddd",
                        overflow: "hidden",
                        flexShrink: 0,
                      }}
                    >
                      {topReview.author_avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={topReview.author_avatar_url}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                      ) : null}
                    </div>

                    <div
                      style={{
                        fontSize: "0.82rem",
                        color: "#666",
                        minWidth: 0,
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={topReview.author_username}
                    >
                      {topReview.author_username}
                      {mediaSlug ? (
                        <>
                          {" • "}
                          <span
                            onClick={(e) => {
                              e.preventDefault();
                              window.location.href = mediaHref;
                            }}
                            style={{ color: "#111", textDecoration: "underline", cursor: "pointer" }}
                          >
                            view
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {/* snippet */}
                  <div
                    style={{
                      fontSize: "0.85rem",
                      color: "#333",
                      marginTop: 8,
                      lineHeight: 1.25,
                      maxWidth: "100%",
                      overflowWrap: "anywhere", // ✅ breaks superlong words so they don't fly out of the card
                      wordBreak: "break-word",  // ✅ fallback for older behavior
                    }}
                  >
                    {clampText(topReview.content, 120)}
                  </div>

                  {/* metrics */}
                  <div style={{ fontSize: "0.8rem", color: "#666", marginTop: 10 }}>
                    {topReview.replies_count} replies • {topReview.likes_count} likes
                  </div>
                </div>
              </div>
            </Link>
          );
        })()}
    </div>
  );
}

export default function RightSidebar() {
  const [topUser, setTopUser] = useState<TopUserRow | null>(null);
  const [topReview, setTopReview] = useState<TopReviewRow | null>(null);

  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingReview, setLoadingReview] = useState(true);

  const [errorUser, setErrorUser] = useState<string | null>(null);
  const [errorReview, setErrorReview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      setLoadingUser(true);
      setErrorUser(null);

      try {
        const { data, error } = await supabase
          .from("top_user_weekly")
          .select("user_id, username, avatar_url, reviews_written, responses_received, likes_received, score")
          .order("score", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (!cancelled) setTopUser((data ?? null) as TopUserRow | null);
      } catch (e: any) {
        if (!cancelled) {
          setErrorUser(e?.message ?? "Failed to load top user.");
          setTopUser(null);
        }
      } finally {
        if (!cancelled) setLoadingUser(false);
      }
    }

    async function loadReview() {
      setLoadingReview(true);
      setErrorReview(null);

      try {
        const { data, error } = await supabase
          .from("top_review_weekly")
          .select(
            "review_id, author_id, author_username, author_avatar_url, anime_id, anime_slug, anime_title, anime_image_url, manga_id, manga_slug, manga_title, manga_image_url, content, created_at, replies_count, likes_count, score"
          )
          .order("score", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          if (!cancelled) setTopReview(null);
          return;
        }

        // ✅ Look up the post id using review_id
        const { data: postRow, error: postErr } = await supabase
          .from("posts")
          .select("id")
          .eq("review_id", data.review_id)
          .maybeSingle();

        if (postErr) throw postErr;

        const merged: TopReviewRow = {
          ...(data as TopReviewRow),
          post_id: postRow?.id ?? null,
        };

        if (!cancelled) setTopReview(merged);
      } catch (e: any) {
        if (!cancelled) {
          setErrorReview(e?.message ?? "Failed to load top review.");
          setTopReview(null);
        }
      } finally {
        if (!cancelled) setLoadingReview(false);
      }
    }

    loadUser();
    loadReview();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside style={{ width: "100%", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <FeedShell>
        <TopUserCard topUser={topUser} loading={loadingUser} error={errorUser} />
      </FeedShell>

      <FeedShell>
        <TopReviewCard topReview={topReview} loading={loadingReview} error={errorReview} />
      </FeedShell>
    </aside>
  );
}
