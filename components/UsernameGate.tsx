"use client";

import React, { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

type UsernameGateProps = {
  children: React.ReactNode;
};

type Profile = {
  id: string;
  username: string;
  created_at: string;
};

export default function UsernameGate({ children }: UsernameGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [needsUsername, setNeedsUsername] = useState(false);

  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkProfile = async () => {
      setChecking(true);
      setNeedsUsername(false);
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (userError || !user) {
        setUser(null);
        setChecking(false);
        return;
      }

      setUser(user);

      // ---- fetch profile WITHOUT generics on from() ----
      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("id, username")
        .eq("id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (profileError && profileError.code !== "PGRST116") {
        // real error (not "no rows")
        console.error("Error checking profile:", profileError);
        setChecking(false);
        return;
      }

      const profile = profileData as Profile | null;

      if (!profile) {
        setNeedsUsername(true);
      } else {
        setNeedsUsername(false);
        // keep local input in sync with stored username (which is lowercase)
        setUsername(profile.username);
      }

      setChecking(false);
    };

    checkProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      if (session?.user) {
        setUser(session.user);
        checkProfile();
      } else {
        setUser(null);
        setNeedsUsername(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmed = username.trim();
    if (!trimmed) {
      setError("Please choose a username.");
      return;
    }

    // ✅ Canonical handle: always lowercase
    const handle = trimmed.toLowerCase();

    setSubmitting(true);
    setError(null);

    // 1) Check if username already taken (using lowercase handle)
    const {
      data: existingData,
      error: existingError,
    } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", handle)
      .maybeSingle();

    if (existingError && existingError.code !== "PGRST116") {
      console.error("Error checking username:", existingError);
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    const existing = existingData as Profile | null;

    if (existing) {
      setError("That username is already taken.");
      setSubmitting(false);
      return;
    }

    // 2) Insert profile with lowercase handle
    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      username: handle, // 👈 stored as lowercase only
    });

    if (insertError) {
      console.error("Error inserting profile:", insertError);
      setError("Could not save username. Please try again.");
      setSubmitting(false);
      return;
    }

    // keep local input in sync with stored value
    setUsername(handle);
    setNeedsUsername(false);
    setSubmitting(false);
  };

  return (
    <>
      {children}

      {user && !checking && needsUsername && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "400px",
              background: "#ffffff",
              borderRadius: 12,
              padding: "1.75rem 1.5rem",
              boxShadow: "0 18px 45px rgba(0,0,0,0.25)",
              border: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: 600,
                marginBottom: "0.75rem",
              }}
            >
              Choose a username
            </h2>
            <p
              style={{
                fontSize: "0.95rem",
                color: "#555",
                marginBottom: "1.1rem",
              }}
            >
              You need a username before you can like, comment, or post.
            </p>

            <form onSubmit={handleSubmit}>
              <label
                htmlFor="username"
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  marginBottom: "0.4rem",
                }}
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={submitting}
                autoFocus
                style={{
                  width: "100%",
                  padding: "0.6rem 0.7rem",
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  fontSize: "0.95rem",
                  marginBottom: "0.75rem",
                }}
              />

              {error && (
                <p
                  style={{
                    color: "#d22",
                    fontSize: "0.85rem",
                    marginBottom: "0.75rem",
                  }}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: "100%",
                  padding: "0.65rem 0.8rem",
                  borderRadius: 999,
                  border: "none",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  cursor: submitting ? "default" : "pointer",
                  opacity: submitting ? 0.7 : 1,
                  background:
                    "linear-gradient(135deg, #111827, #111827, #1f2937)",
                  color: "#fff",
                }}
              >
                {submitting ? "Saving…" : "Save username"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
