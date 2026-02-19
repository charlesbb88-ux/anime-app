// components/AuthModal.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/router";
import { Eye, EyeOff, ChevronLeft, X } from "lucide-react";

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
      return setMsg("Username must be 3–20 chars: lowercase letters, numbers, underscore.");
    }

    setBusy(true);

    // ✅ 1) Reserve username first (atomic)
    {
      const { error } = await supabase.rpc("claim_username", { p_username: u2 });
      if (error) {
        setBusy(false);
        // our function throws 'username_taken'
        const m = (error.message || "").toLowerCase();
        if (m.includes("username_taken")) return setMsg("That username is already taken.");
        if (m.includes("invalid_username")) {
          return setMsg("Username must be 3–20 chars: lowercase letters, numbers, underscore.");
        }
        return setMsg("Could not check username. Please try again.");
      }
    }

    // ✅ 2) Create auth user (store username in user metadata)
    const origin =
      typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: e2,
      password,
      options: {
        emailRedirectTo: `${origin}${nextUrl}`,
        data: {
          username: u2, // ✅ store here so the DB trigger can copy it into profiles
        },
      },
    });

    if (signUpErr) {
      await supabase.rpc("release_username", { p_username: u2 });
      setBusy(false);
      return setMsg(signUpErr.message || "Could not sign up.");
    }

    // ✅ If email confirmation is ON, session will be null.
    // That’s expected. Username will be applied by the trigger.
    setBusy(false);

    if (!signUpData.session) {
      return setMsg(`We sent a confirmation email to ${e2}. Please confirm to finish signing up.`);
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

  // ✅ Constrain the “content column” so buttons/inputs don’t stretch to modal edges
  const contentCol = "mx-auto w-full max-w-[380px]";

  // ✅ TikTok-style row button (icon left, text centered)
  // NOTE: Tailwind doesn't have text-md — use text-base
  const rowBtn =
    "w-full h-12 rounded-xl border border-black/10 bg-white hover:bg-black/[0.03] " +
    "grid grid-cols-[52px_1fr_52px] items-center text-base font-semibold";

  const rowIcon = "flex items-center justify-center text-black";
  const rowLabel = "text-center";
  const rowSpacer = "block";

  // ✅ Top icon buttons: bigger, perfectly centered, consistent hover circle
  const topIconBtn =
    "absolute grid place-items-center w-12 h-12 rounded-full hover:bg-black/5 active:bg-black/10";
  const topIcon = "text-black/80";

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
          {step !== "chooser" && (
            <button
              type="button"
              onClick={goBack}
              aria-label="Back"
              className={`${topIconBtn} left-3 top-3`}
            >
              <ChevronLeft
                size={30}
                strokeWidth={2.75}
                className={`${topIcon} translate-x-[-1px]`}
              />
            </button>
          )}

          <button
            type="button"
            onClick={closeAndReset}
            aria-label="Close"
            className={`${topIconBtn} right-3 top-3`}
          >
            <X size={28} strokeWidth={2.75} className={topIcon} />
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
          <div className={contentCol}>
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
                      <span className={rowIcon}>👤</span>
                      <span className={rowLabel}>Use email</span>
                      <span className={rowSpacer} />
                    </button>

                    <button
                      className={rowBtn}
                      onClick={() => signInWithOAuth("google")}
                      disabled={busy}
                      type="button"
                    >
                      <span className={rowIcon}>G</span>
                      <span className={rowLabel}>Continue with Google</span>
                      <span className={rowSpacer} />
                    </button>

                    <button
                      className={rowBtn}
                      onClick={() => signInWithOAuth("apple")}
                      disabled={busy}
                      type="button"
                    >
                      <span className={rowIcon}></span>
                      <span className={rowLabel}>Continue with Apple</span>
                      <span className={rowSpacer} />
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
                      <span className={rowIcon}>✉️</span>
                      <span className={rowLabel}>Use email</span>
                      <span className={rowSpacer} />
                    </button>

                    <button
                      className={rowBtn}
                      onClick={() => signInWithOAuth("apple")}
                      disabled={busy}
                      type="button"
                    >
                      <span className={rowIcon}></span>
                      <span className={rowLabel}>Continue with Apple</span>
                      <span className={rowSpacer} />
                    </button>

                    <button
                      className={rowBtn}
                      onClick={() => signInWithOAuth("google")}
                      disabled={busy}
                      type="button"
                    >
                      <span className={rowIcon}>G</span>
                      <span className={rowLabel}>Continue with Google</span>
                      <span className={rowSpacer} />
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
                          const maybe = identifier.trim();
                          setResetEmail(isLikelyEmail(maybe) ? maybe : "");
                          setStep("reset");
                        }}
                        className="text-sm text-black/60 hover:text-black"
                        disabled={busy}
                      >
                        Forgot password?
                      </button>
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

            {/* STEP 3: reset password */}
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
