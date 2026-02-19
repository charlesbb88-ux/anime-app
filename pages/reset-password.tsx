// pages/reset-password.tsx
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/router";
import { Eye, EyeOff } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // When user opens the Supabase reset link, Supabase sets a recovery session.
    // We can detect it via session or PASSWORD_RECOVERY event.
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      setHasRecoverySession(!!data.session);
      setReady(true);
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") {
        setHasRecoverySession(!!session);
        setReady(true);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!password || password.length < 8) return setMsg("Password must be at least 8 characters.");
    if (password !== password2) return setMsg("Passwords do not match.");

    setBusy(true);

    const { error } = await supabase.auth.updateUser({ password });

    setBusy(false);

    if (error) return setMsg(error.message || "Could not update password.");

    setMsg("Password updated. Redirecting…");
    setTimeout(() => router.replace("/"), 600);
  }

  return (
    <div className="min-h-screen bg-black/[0.03] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[560px] bg-white rounded-2xl border border-black/10 shadow-[0_18px_60px_rgba(0,0,0,0.12)] p-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-center">Reset password</h1>

        {msg && (
          <div className="mt-4 rounded-xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm text-black/80">
            {msg}
          </div>
        )}

        {!ready ? (
          <div className="mt-6 text-center text-sm text-black/60">Loading…</div>
        ) : !hasRecoverySession ? (
          <div className="mt-6 text-sm text-black/70 leading-relaxed">
            This reset link is missing or expired. Go back and request a new password reset email.
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="mt-6 space-y-3">
            <div>
              <label className="block text-sm font-semibold mb-1">New password</label>

              <div className="relative">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  className="w-full h-12 rounded-xl border border-black/15 pl-4 pr-12 text-sm outline-none focus:border-black"
                  placeholder="New password (8+ characters)"
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

            <div>
              <label className="block text-sm font-semibold mb-1">Confirm new password</label>

              <div className="relative">
                <input
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  type={showPassword2 ? "text" : "password"}
                  className="w-full h-12 rounded-xl border border-black/15 pl-4 pr-12 text-sm outline-none focus:border-black"
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  disabled={busy}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword2((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full hover:bg-black/5 flex items-center justify-center text-black/60 hover:text-black"
                  aria-label={showPassword2 ? "Hide password" : "Show password"}
                  disabled={busy}
                >
                  {showPassword2 ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full h-12 rounded-xl bg-black text-white text-sm font-semibold disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save new password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
