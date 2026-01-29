"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient"; // adjust path if needed

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
        if (!cancelled) setTopReview((data ?? null) as TopReviewRow | null);
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
      {/* ===== TOP USER ===== */}
      <div
        style={{
          padding: "1rem 1.1rem",
          background: "#ffffff",
          borderRadius: 10,
          border: "1px solid #11111111",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ fontSize: "0.95rem", fontWeight: 800 }}>Top User</div>
          <div style={{ fontSize: "0.85rem", color: "#777" }}>This week</div>
        </div>

        <div style={{ height: 10 }} />

        {loadingUser && <div style={{ fontSize: "0.9rem", color: "#777" }}>Loading…</div>}
        {!loadingUser && errorUser && <div style={{ fontSize: "0.9rem", color: "#b00000" }}>{errorUser}</div>}
        {!loadingUser && !errorUser && !topUser && (
          <div style={{ fontSize: "0.9rem", color: "#777" }}>No activity yet this week.</div>
        )}

        {!loadingUser && !errorUser && topUser && (
          <Link href={`/profile/${topUser.username}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.85rem",
                padding: "0.8rem",
                borderRadius: 10,
                border: "1px solid #eee",
                background: "#fafafa",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 999,
                  background: "#eaeaea",
                  border: "1px solid #ddd",
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

              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: "1rem",
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={topUser.username}
                >
                  {topUser.username}
                </div>

                <div style={{ fontSize: "0.82rem", color: "#666", marginTop: 2 }}>
                  {topUser.reviews_written} reviews • {topUser.responses_received} replies • {topUser.likes_received} likes
                </div>
              </div>

              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: "0.75rem", color: "#777" }}>Impact</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 900 }}>{Math.round(Number(topUser.score))}</div>
              </div>
            </div>
          </Link>
        )}
      </div>

      {/* ===== TOP REVIEW ===== */}
      <div
        style={{
          padding: "1rem 1.1rem",
          background: "#ffffff",
          borderRadius: 10,
          border: "1px solid #11111111",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ fontSize: "0.95rem", fontWeight: 800 }}>Top Review</div>
          <div style={{ fontSize: "0.85rem", color: "#777" }}>This week</div>
        </div>

        <div style={{ height: 10 }} />

        {loadingReview && <div style={{ fontSize: "0.9rem", color: "#777" }}>Loading…</div>}
        {!loadingReview && errorReview && <div style={{ fontSize: "0.9rem", color: "#b00000" }}>{errorReview}</div>}
        {!loadingReview && !errorReview && !topReview && (
          <div style={{ fontSize: "0.9rem", color: "#777" }}>No reviews yet this week.</div>
        )}

        {!loadingReview && !errorReview && topReview && (() => {
          const isAnime = !!topReview.anime_id;
          const mediaTitle = isAnime ? topReview.anime_title : topReview.manga_title;
          const mediaSlug = isAnime ? topReview.anime_slug : topReview.manga_slug;
          const mediaImg = isAnime ? topReview.anime_image_url : topReview.manga_image_url;
          const mediaHref = isAnime ? `/anime/${mediaSlug}` : `/manga/${mediaSlug}`;

          return (
            <Link
              href={`/review/${topReview.review_id}`} // 🔧 change if your review route differs
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  padding: "0.8rem",
                  borderRadius: 10,
                  border: "1px solid #eee",
                  background: "#fafafa",
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

                <div style={{ minWidth: 0, flex: 1 }}>
                  {/* media title */}
                  <div
                    style={{
                      fontSize: "0.92rem",
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
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
                    <div style={{ fontSize: "0.82rem", color: "#666" }}>
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
                  <div style={{ fontSize: "0.85rem", color: "#333", marginTop: 8, lineHeight: 1.25 }}>
                    {clampText(topReview.content, 120)}
                  </div>

                  {/* metrics */}
                  <div style={{ fontSize: "0.8rem", color: "#666", marginTop: 10 }}>
                    {topReview.replies_count} replies • {topReview.likes_count} likes
                  </div>
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: "0.75rem", color: "#777" }}>Heat</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 900 }}>{Math.round(Number(topReview.score))}</div>
                </div>
              </div>
            </Link>
          );
        })()}
      </div>
    </aside>
  );
}
