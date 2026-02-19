// components/AuthModal.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/router";
import { Eye, EyeOff } from "lucide-react";

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
  mode: "login" | "signup";
  next?: string;
};

type Step = "chooser" | "email" | "reset";

function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase();
}

function isValidUsername(u: string) {
  return /^[a-z0-9_]{3,20}$/.test(u);
}

function isLikelyEmail(s: string) {
  return s.includes("@");
}

export default function AuthModal({ isOpen, onClose, mode, next }: AuthModalProps) {
  const router = useRouter();

  const [step, setStep] = useState<Step>("chooser");
  const [localMode, setLocalMode] = useState<"login" | "signup">(mode);
  const [showPassword, setShowPassword] = useState(false);

  const [identifier, setIdentifier] = useState(""); // email or username for login
  const [email, setEmail] = useState(""); // signup email
  const [username, setUsername] = useState(""); // signup username
  const [password, setPassword] = useState("");

  // reset password state
  const [resetEmail, setResetEmail] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const nextUrl = useMemo(() => {
    const n = next || router.asPath || "/";
    return n.startsWith("/") ? n : "/";
  }, [next, router.asPath]);

  // Reset internal state whenever opened / mode changes
  useEffect(() => {
    if (!isOpen) return;
    setLocalMode(mode);
    setStep("chooser");
    setIdentifier("");
    setEmail("");
    setUsername("");
    setPassword("");
    setResetEmail("");
    setBusy(false);
    setShowPassword(false);
    setMsg(null);
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const title =
    step === "reset"
      ? "Reset password"
      : step === "chooser"
        ? localMode === "login"
          ? "Log in"
          : "Sign up"
        : localMode === "login"
          ? "Log in"
          : "Sign up";

  async function signInWithOAuth(provider: "google" | "apple") {
    setMsg(null);
    setBusy(true);

    const origin =
      typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

    const redirectTo = `${origin}${nextUrl}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });

    setBusy(false);

    if (error) {
      setMsg(error.message || "Could not continue. Please try again.");
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const id = identifier.trim();
    if (!id) return setMsg("Enter your email or username.");
    if (!password) return setMsg("Enter your password.");

    setBusy(true);

    // If they typed a username, convert it -> email by looking up profiles.
    let emailToUse: string | null = null;

    if (isLikelyEmail(id)) {
      emailToUse = id;
    } else {
      setBusy(false);
      return setMsg("For now, log in with your email. (Username login needs a tiny server/RPC step.)");
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password,
    });

    setBusy(false);

    if (error) return setMsg(error.message || "Login failed.");

    onClose();
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const e2 = email.trim();
    const u2 = normalizeUsername(username);

    if (!e2) return setMsg("Enter your email.");
    if (!password || password.length < 8) return setMsg("Password must be at least 8 characters.");
    if (!u2) return setMsg("Choose a username.");
    if (!isValidUsername(u2)) {
      return setMsg("Username must be 3–20 characters: lowercase letters, numbers, underscore.");
    }

    setBusy(true);

    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: e2,
      password,
    });

    if (signUpErr) {
      setBusy(false);
      return setMsg(signUpErr.message || "Could not sign up.");
    }

    const userId = signUpData.user?.id;

    if (userId) {
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ username: u2 })
        .eq("id", userId);

      if (updErr) {
        const m = (updErr as any)?.message?.toLowerCase?.() || "";
        setBusy(false);
        if (m.includes("duplicate") || m.includes("unique")) {
          return setMsg("That username is already taken.");
        }
        return setMsg("Account created, but username could not be saved. Try again after logging in.");
      }
    }

    setBusy(false);

    const { data: now } = await supabase.auth.getUser();
    if (!now.user) {
      return setMsg("Check your email to confirm your account, then log in.");
    }

    onClose();
  }

  async function handleSendReset() {
    setMsg(null);

    const e2 = resetEmail.trim();
    if (!e2 || !isLikelyEmail(e2)) return setMsg("Enter a valid email address.");

    setBusy(true);

    const origin =
      typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

    const { error } = await supabase.auth.resetPasswordForEmail(e2, {
      redirectTo: `${origin}/reset-password`,
    });

    setBusy(false);

    if (error) return setMsg(error.message || "Could not send reset email.");
    setMsg("Check your email for a password reset link.");
  }

  function closeAndReset() {
    onClose();
  }

  function goBack() {
    setMsg(null);

    // TikTok-like back behavior:
    // - from reset -> back to email login
    // - from email -> back to chooser
    if (step === "reset") {
      setStep("email");
      return;
    }

    setStep("chooser");
  }

  function switchMode() {
    setMsg(null);
    setBusy(false);
    setStep("chooser");
    setLocalMode((m) => (m === "login" ? "signup" : "login"));
    setIdentifier("");
    setEmail("");
    setUsername("");
    setPassword("");
    setResetEmail("");
  }

  // Button row style like TikTok list
  const rowBtn =
    "w-full h-12 rounded-xl border border-black/10 bg-white hover:bg-black/[0.03] " +
    "flex items-center justify-center gap-2 text-sm font-semibold";

  const iconBox = "w-9 h-9 rounded-lg bg-black/[0.04] flex items-center justify-center";

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center px-4"
      onClick={closeAndReset}
    >
      <div
        className="w-full max-w-[560px] bg-white rounded-2xl shadow-[0_18px_60px_rgba(0,0,0,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="relative px-6 pt-6">
          {/* Back arrow (only when not chooser) */}
          {step !== "chooser" && (
            <button
              type="button"
              onClick={goBack}
              className="absolute left-4 top-5 w-10 h-10 rounded-full hover:bg-black/5 flex items-center justify-center"
              aria-label="Back"
            >
              <span style={{ fontSize: 22, lineHeight: 1 }}>‹</span>
            </button>
          )}

          {/* Close X */}
          <button
            type="button"
            onClick={closeAndReset}
            className="absolute right-4 top-5 w-10 h-10 rounded-full hover:bg-black/5 flex items-center justify-center"
            aria-label="Close"
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>✕</span>
          </button>

          <h2 className="text-center text-3xl font-extrabold tracking-tight">{title}</h2>

          {msg && (
            <div className="mt-4 rounded-xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm text-black/80">
              {msg}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-6 pb-2 pt-6">
          {/* STEP 1: chooser */}
          {step === "chooser" && (
            <div className="space-y-3">
              {localMode === "login" ? (
                <>
                  <button
                    className={rowBtn}
                    onClick={() => setStep("email")}
                    disabled={busy}
                    type="button"
                  >
                    <span className={iconBox}>👤</span>
                    Use email / username
                  </button>

                  <button
                    className={rowBtn}
                    onClick={() => signInWithOAuth("google")}
                    disabled={busy}
                    type="button"
                  >
                    <span className={iconBox}>G</span>
                    Continue with Google
                  </button>

                  <button
                    className={rowBtn}
                    onClick={() => signInWithOAuth("apple")}
                    disabled={busy}
                    type="button"
                  >
                    <span className={iconBox}></span>
                    Continue with Apple
                  </button>
                </>
              ) : (
                <>
                  <button
                    className={rowBtn}
                    onClick={() => setStep("email")}
                    disabled={busy}
                    type="button"
                  >
                    <span className={iconBox}>✉️</span>
                    Use email
                  </button>

                  <button
                    className={rowBtn}
                    onClick={() => signInWithOAuth("apple")}
                    disabled={busy}
                    type="button"
                  >
                    <span className={iconBox}></span>
                    Continue with Apple
                  </button>

                  <button
                    className={rowBtn}
                    onClick={() => signInWithOAuth("google")}
                    disabled={busy}
                    type="button"
                  >
                    <span className={iconBox}>G</span>
                    Continue with Google
                  </button>
                </>
              )}
            </div>
          )}

          {/* STEP 2: email */}
          {step === "email" && (
            <div className="mt-2">
              {localMode === "login" ? (
                <form onSubmit={handleLogin} className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Email or username</label>
                    <input
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="w-full h-12 rounded-xl border border-black/15 px-4 text-sm outline-none focus:border-black"
                      placeholder="Email or username"
                      autoComplete="username"
                      disabled={busy}
                    />
                    <p className="text-xs text-black/45 mt-1">
                      (Username login can be enabled with a tiny RPC; right now email login is supported.)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">Password</label>

                    <div className="relative">
                      <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        type={showPassword ? "text" : "password"}
                        className="w-full h-12 rounded-xl border border-black/15 pl-4 pr-12 text-sm outline-none focus:border-black"
                        placeholder="Password"
                        autoComplete="current-password"
                        disabled={busy}
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full hover:bg-black/5 flex items-center justify-center text-black/60 hover:text-black"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        disabled={busy}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setMsg(null);
                        // prefill reset email if they typed an email in identifier
                        const maybe = identifier.trim();
                        setResetEmail(isLikelyEmail(maybe) ? maybe : "");
                        setStep("reset");
                      }}
                      className="text-sm text-black/60 hover:text-black"
                      disabled={busy}
                    >
                      Forgot password?
                    </button>

                    {/* optional spacer / keep right side empty like TikTok */}
                    <span />
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full h-12 rounded-xl bg-black text-white text-sm font-semibold disabled:opacity-60"
                  >
                    {busy ? "Logging in…" : "Log in"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSignup} className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Email</label>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      className="w-full h-12 rounded-xl border border-black/15 px-4 text-sm outline-none focus:border-black"
                      placeholder="Email"
                      autoComplete="email"
                      disabled={busy}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">Username</label>
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full h-12 rounded-xl border border-black/15 px-4 text-sm outline-none focus:border-black"
                      placeholder="Username (lowercase)"
                      autoComplete="username"
                      disabled={busy}
                    />
                    <p className="text-xs text-black/45 mt-1">
                      3–20 chars: lowercase letters, numbers, underscore.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">Password</label>

                    <div className="relative">
                      <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        type={showPassword ? "text" : "password"}
                        className="w-full h-12 rounded-xl border border-black/15 pl-4 pr-12 text-sm outline-none focus:border-black"
                        placeholder="Password (8+ characters)"
                        autoComplete="new-password"
                        disabled={busy}
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full hover:bg-black/5 flex items-center justify-center text-black/60 hover:text-black"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        disabled={busy}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full h-12 rounded-xl bg-black text-white text-sm font-semibold disabled:opacity-60"
                  >
                    {busy ? "Creating…" : "Sign up"}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* STEP 3: reset password (TikTok-style inside modal) */}
          {step === "reset" && (
            <div className="mt-2 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-semibold">Enter email address</label>
                  <button
                    type="button"
                    className="text-sm text-black/60 hover:text-black"
                    onClick={() => {
                      setMsg(null);
                      setStep("email");
                    }}
                    disabled={busy}
                  >
                    Log in with phone
                  </button>
                </div>

                <input
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  type="email"
                  className="w-full h-12 rounded-xl border border-black/15 px-4 text-sm outline-none focus:border-black"
                  placeholder="Email address"
                  autoComplete="email"
                  disabled={busy}
                />
              </div>

              <button
                type="button"
                onClick={handleSendReset}
                disabled={busy}
                className="w-full h-12 rounded-xl bg-black text-white text-sm font-semibold disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send reset link"}
              </button>

              <p className="text-xs text-black/45 leading-relaxed">
                We’ll email you a reset link. Open it to set a new password.
              </p>
            </div>
          )}
        </div>

        {/* Footer switch like TikTok */}
        <div className="px-6 pb-6 pt-3">
          <div className="text-center text-sm text-black/60">
            {localMode === "login" ? (
              <>
                Don’t have an account?{" "}
                <button
                  type="button"
                  onClick={switchMode}
                  className="text-pink-600 font-semibold hover:underline"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={switchMode}
                  className="text-pink-600 font-semibold hover:underline"
                >
                  Log in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
