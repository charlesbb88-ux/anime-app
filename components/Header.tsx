// components/Header.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import AuthModal from "./AuthModal";

type UserType = any;

type Profile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
};

export default function Header({ transparent = false }: { transparent?: boolean }) {
  const [user, setUser] = useState<UserType | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // ✅ AniList-style show/hide
  const [isHidden, setIsHidden] = useState(false);

  const menuRef = useRef<HTMLDivElement | null>(null);

  // Watch auth state + load profile (username + avatar_url)
  useEffect(() => {
    let isMounted = true;

    async function fetchProfile(userId: string) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .eq("id", userId)
        .maybeSingle();

      if (!isMounted) return;
      if (error) {
        console.error("Error loading profile in header:", error);
        setProfile(null);
        return;
      }
      setProfile(data as Profile);
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!isMounted) return;
      const u = data.user ?? null;
      setUser(u);

      if (u) fetchProfile(u.id);
      else setProfile(null);

      setAuthChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;

        const u = session?.user ?? null;
        setUser(u);

        if (u) fetchProfile(u.id);
        else setProfile(null);

        setAuthChecking(false);
      }
    );

    return () => {
      isMounted = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  // CLICK OUTSIDE HANDLER FOR USER MENU
  useEffect(() => {
    if (!isUserMenuOpen) return;

    function handleClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isUserMenuOpen]);

  // ✅ AniList behavior:
  // - scroll down => hide (after a small threshold)
  // - any scroll up => show immediately
  // - near top => always show
  // - if user menu open => keep visible
  useEffect(() => {
    let lastY = typeof window !== "undefined" ? window.scrollY : 0;
    let rafId: number | null = null;

    const SHOW_AT_TOP_Y = 10;
    const HIDE_AFTER_Y = 60;
    const DOWN_DEADZONE = 4;

    const onScroll = () => {
      if (rafId != null) return;

      rafId = window.requestAnimationFrame(() => {
        rafId = null;

        const y = window.scrollY;

        if (y <= SHOW_AT_TOP_Y) {
          setIsHidden(false);
          lastY = y;
          return;
        }

        if (isUserMenuOpen) {
          setIsHidden(false);
          lastY = y;
          return;
        }

        const delta = y - lastY;

        // down
        if (delta > DOWN_DEADZONE) {
          if (y > HIDE_AFTER_Y) setIsHidden(true);
        }

        // up (ANY amount)
        if (delta < 0) {
          setIsHidden(false);
        }

        lastY = y;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId != null) window.cancelAnimationFrame(rafId);
    };
  }, [isUserMenuOpen]);

  // ---- name / initial helpers using profile.username ----
  function getEmailPrefix(u: UserType | null) {
    if (!u) return "";
    const email: string = u.email || "";
    return email.split("@")[0] || "";
  }

  function getDisplayName(u: UserType | null, p: Profile | null) {
    if (!u) return "";
    if (p && p.username && p.username.trim().length > 0) {
      return p.username.trim();
    }
    return getEmailPrefix(u);
  }

  function getInitial(u: UserType | null, p: Profile | null) {
    const name = getDisplayName(u, p);
    if (name) return name.trim()[0].toUpperCase();
    const email: string = u?.email || "";
    const c = email.trim()[0];
    return c ? c.toUpperCase() : "";
  }

  const displayName = getDisplayName(user, profile);
  const initial = getInitial(user, profile);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error logging out:", error.message);
      return;
    }
    setIsUserMenuOpen(false);
    window.location.href = "/";
  };

  const handleGoProfile = () => {
    if (!profile?.username) return;
    window.location.href = `/${profile.username}`;
  };

  return (
    <>
      <header
        style={{
          width: "100%",
          padding: "0.75rem 1.5rem",
          borderBottom: transparent ? "none" : "1px solid #ddd",
          background: transparent ? "transparent" : "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",

          // ✅ key change:
          // transparent pages should OVERLAY the content, not push it down
          position: transparent ? "fixed" : "sticky",
          top: 0,
          zIndex: 50,

          // ✅ AniList show/hide (keep your existing variables)
          transform: isHidden ? "translateY(-110%)" : "translateY(0)",
          transition: "transform 140ms ease-out",
          willChange: "transform",

          // optional, helps readability on backdrops:
          backdropFilter: "none",
          WebkitBackdropFilter: "none",
        }}
      >

        {/* Left: brand + nav links */}
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <Link
            href="/"
            style={{
              fontWeight: 700,
              fontSize: "1.1rem",
              textDecoration: "none",
              color: "#000",
              cursor: "pointer",
            }}
          >
            AnimeApp
          </Link>

          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              fontSize: "0.95rem",
            }}
          >
            <Link
              href="/anime"
              style={{
                textDecoration: "none",
                color: "#333",
                padding: "0.2rem 0.45rem",
                borderRadius: 6,
              }}
            >
              Anime
            </Link>
            <Link
              href="/manga"
              style={{
                textDecoration: "none",
                color: "#333",
                padding: "0.2rem 0.45rem",
                borderRadius: 6,
              }}
            >
              Manga
            </Link>
          </nav>
        </div>

        {/* Right: auth / user menu */}
        <div style={{ position: "relative", minWidth: "2.5rem" }} ref={menuRef}>
          {authChecking ? null : user ? (
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.55rem",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <div
                style={{
                  width: "2.1rem",
                  height: "2.1rem",
                  borderRadius: "50%",
                  background: "#e5e5e5",
                  border: "1px solid #d0d0d0",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  overflow: "hidden",
                }}
              >
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt={displayName || "Your avatar"}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                ) : (
                  (initial || "U")
                )}
              </div>

              <span
                style={{
                  fontSize: "0.95rem",
                  color: "#333",
                  maxWidth: "9rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {displayName || "User"}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsAuthOpen(true)}
              style={{
                padding: "0.4rem 1rem",
                borderRadius: 999,
                border: "1px solid #000",
                background: "#000",
                color: "#fff",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: 500,
              }}
            >
              Log in
            </button>
          )}

          {user && isUserMenuOpen && (
            <div
              style={{
                position: "absolute",
                top: "2.6rem",
                right: 0,
                background: "#fff",
                border: "1px solid #ddd",
                borderRadius: 8,
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.12)",
                minWidth: "150px",
                zIndex: 100,
              }}
            >
              {profile?.username && (
                <button
                  type="button"
                  onClick={handleGoProfile}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "0.6rem 0.85rem",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    color: "#333",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  Profile
                </button>
              )}

              <button
                type="button"
                onClick={handleLogout}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "0.6rem 0.85rem",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  color: "#b00000",
                }}
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </header>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
}
