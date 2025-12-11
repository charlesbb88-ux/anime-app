"use client";

import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient"; // ⬅️ change this path if needed

const TYPO = {
  base: "1rem",
};

export default function LeftSidebar() {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleToggleUserMenu = () => {
    setIsUserMenuOpen((prev) => !prev);
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Error logging out:", error.message);
      return;
    }

    // close the menu
    setIsUserMenuOpen(false);

    // send them somewhere after logout (change to "/login" if you want)
    window.location.href = "/";
  };

  return (
    <aside
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      {/* TOP CARD: NAV BUTTONS */}
      <div
        style={{
          padding: "1rem 1.1rem",
          background: "#ffffff",
          borderRadius: 10,
          border: "1px solid #11111111",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          height: "auto",
        }}
      >
        <nav
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          {[
            "Home",
            "Log",
            "Lists",
            "Bookmarks",
            "Reviews",
            "Profile",
            "Settings",
          ].map((label) => (
            <button
              key={label}
              style={{
                width: "100%",
                padding: "0.6rem 0.8rem",
                fontSize: TYPO.base,
                textAlign: "left",
                border: "1px solid #eee",
                borderRadius: 8,
                background: "#fafafa",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#f2f2f2")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "#fafafa")
              }
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* BOTTOM CARD: USER + MENU (three dots + pop-up) */}
      <div
        style={{
          padding: "0.8rem 1.1rem",
          background: "#ffffff",
          borderRadius: 10,
          border: "1px solid #11111111",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
          }}
        >
          {/* Left side: avatar + name */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            {/* Avatar placeholder */}
            <div
              style={{
                width: "2.4rem",
                height: "2.4rem",
                borderRadius: "50%",
                background: "#e5e5e5",
                border: "1px solid #d0d0d0",
                flexShrink: 0,
              }}
            />

            {/* Username */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontSize: TYPO.base,
                  fontWeight: 600,
                }}
              >
                Username
              </span>
              <span
                style={{
                  fontSize: "0.85rem",
                  color: "#777",
                }}
              >
                View profile
              </span>
            </div>
          </div>

          {/* Right side: three dots + pop-up menu */}
          <div
            style={{
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={handleToggleUserMenu}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: "0 0.3rem",
                fontSize: "1.2rem",
                lineHeight: 1,
                color: "#555",
              }}
            >
              ⋯
            </button>

            {isUserMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "1.6rem",
                  right: 0,
                  background: "#fff",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.12)",
                  minWidth: "140px",
                  zIndex: 20,
                }}
              >
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "0.55rem 0.8rem",
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
        </div>
      </div>
    </aside>
  );
}
