// components/Header.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { Search } from "lucide-react";

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

  // ✅ AniList-style show/hide
  const [isHidden, setIsHidden] = useState(false);

  const HEADER_BTN_H = 32;

  const menuRef = useRef<HTMLDivElement | null>(null);

  // ✅ layout reservation constants (prevents header jump while auth/avatar loads)
  const AVATAR_PX = 48; // 3rem
  const HEADER_MIN_PX = 56; // stable header height (includes padding)

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

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;

      const u = session?.user ?? null;
      setUser(u);

      if (u) fetchProfile(u.id);
      else setProfile(null);

      setAuthChecking(false);
    });

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

  // ✅ added (helper path for dropdown tabs)
  const baseProfilePath = profile?.username ? `/${profile.username}` : null;

  // ✅ ONE PLACE to change divider style
  const dropdownDividerBorder = "1px solid #c2c2c2";

  // ✅ shared base style for dropdown links
  const dropdownItemStyleBase: React.CSSProperties = {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "0.6rem 0.85rem",
    textDecoration: "none",
    cursor: "pointer",
    fontSize: "0.9rem",
    color: "#333",
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error logging out:", error.message);
      return;
    }
    setIsUserMenuOpen(false);
    window.location.href = "/";
  };

  const menuLinks = baseProfilePath
    ? [
      { label: "Posts", href: baseProfilePath },
      { label: "Completions", href: `${baseProfilePath}/completions` },
      { label: "Watchlist", href: `${baseProfilePath}/watchlist` },
      { label: "Activity", href: `${baseProfilePath}/activity` },
      { label: "Journal", href: `${baseProfilePath}/journal` },
      { label: "My Library", href: `${baseProfilePath}/library` },
    ]
    : [];

  return (
    <>
      <header
        style={{
          width: "100%",
          padding: "0.3rem .3rem",
          borderBottom: transparent ? "none" : "1px solid #000000",
          background: transparent ? "transparent" : "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",

          // ✅ keeps header height stable while auth/avatar loads
          minHeight: `${HEADER_MIN_PX}px`,

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
        <div
          style={{
            width: "100%",
            maxWidth: "67rem", // max-w-6xl
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Left: brand + nav links */}
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            <Link
              href="/"
              style={{
                textDecoration: "none",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  padding: "0.1rem 0.3rem",
                  fontWeight: 700,
                  fontSize: "1.7rem",
                  color: "#000",
                  background: "#fff",
                  border: "2px solid #000",
                  borderRadius: 0, // adjust: 4 = sharp, 999 = pill
                  lineHeight: 1,
                }}
              >
                INKBASED
              </span>
            </Link>

            <nav
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                fontSize: "0.95rem",
              }}
            ></nav>
          </div>

          {/* Right: discover + auth / user menu */}
          <div
            ref={menuRef}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
            }}
          >
            <Link
              href="/discover"
              style={{
                textDecoration: "none",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: HEADER_BTN_H,
                  padding: "0 0.55rem", // horizontal only
                  fontWeight: 700,
                  fontSize: "1.05rem",
                  color: "#ffffff",
                  background: "#000000",
                  border: "1px solid #ffffff",
                  borderRadius: 0,
                  lineHeight: "1",
                  whiteSpace: "nowrap",
                }}
              >
                DISCOVER
              </span>
            </Link>

            <Link
              href="/search"
              style={{
                textDecoration: "none",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: HEADER_BTN_H,
                  width: HEADER_BTN_H, // makes it perfectly square
                  background: "#000000",
                  border: "1px solid #ffffff",
                  borderRadius: 0,
                  lineHeight: "1",
                }}
              >
                <Search size={18} strokeWidth={3} color="#ffffff" />
              </span>
            </Link>

            {/* ✅ ALWAYS render something here to reserve layout (no jank) */}
            {user ? (
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <div
                  style={{
                    width: AVATAR_PX,
                    height: AVATAR_PX,
                    borderRadius: "50%",
                    background: "#e5e5e5",
                    border: "2px solid #000000",
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
                      loading="eager"
                      decoding="async"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  ) : (
                    initial || "U"
                  )}
                </div>
              </button>
            ) : authChecking ? (
              // ✅ skeleton placeholder (same size as avatar)
              <div
                aria-hidden="true"
                style={{
                  width: AVATAR_PX,
                  height: AVATAR_PX,
                  borderRadius: "50%",
                  background: "#f0f0f0",
                  border: "2px solid #000000",
                  flexShrink: 0,
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("open-auth-modal", { detail: { mode: "login" } })
                  );
                }}
                style={{
                  height: HEADER_BTN_H,
                  padding: "0 0.75rem",
                  borderRadius: 100,
                  border: "1px solid #ffffff",
                  background: "#008cff",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: "1",
                  whiteSpace: "nowrap",
                }}
              >
                LOG IN
              </button>
            )}

            {/* ✅ dropdown */}
            {user && isUserMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "2.6rem",
                  right: 0,
                  background: "#fff",
                  border: "1px solid #000000",
                  borderRadius: 2,
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.12)",
                  minWidth: "190px",
                  zIndex: 100,
                  overflow: "hidden",
                }}
              >
                {menuLinks.map((item, idx) => {
                  const isLast = idx === menuLinks.length - 1;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsUserMenuOpen(false)}
                      style={{
                        ...dropdownItemStyleBase,
                        borderBottom: isLast ? "none" : dropdownDividerBorder,
                      }}
                    >
                      {item.label}
                    </Link>
                  );
                })}

                {/* ✅ NEW: Settings link at bottom */}
                <Link
                  href="/settings"
                  onClick={() => setIsUserMenuOpen(false)}
                  style={{
                    ...dropdownItemStyleBase,
                    borderTop: menuLinks.length > 0 ? dropdownDividerBorder : "none",
                    borderBottom: dropdownDividerBorder,
                  }}
                >
                  Settings
                </Link>

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
                    borderTop: "none",
                  }}
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
