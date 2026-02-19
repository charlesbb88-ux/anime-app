// pages/login.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";

type Mode = "login" | "signup" | "forgot";

function isValidUsername(u: string) {
    // 3-20 chars, lowercase letters/numbers/underscore
    return /^[a-z0-9_]{3,20}$/.test(u);
}

export default function LoginPage() {
    const router = useRouter();

    const nextUrl = useMemo(() => {
        const raw = router.query.next;
        if (typeof raw !== "string" || !raw) return "/";
        // prevent open redirects
        if (!raw.startsWith("/")) return "/";
        return raw;
    }, [router.query.next]);

    const [mode, setMode] = useState<Mode>("login");

    useEffect(() => {
        const m = router.query.mode;
        if (m === "signup") setMode("signup");
        if (m === "login") setMode("login");
    }, [router.query.mode]);

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    // only for signup
    const [username, setUsername] = useState("");

    const [msg, setMsg] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    // If already logged in, bounce them out
    useEffect(() => {
        let mounted = true;
        (async () => {
            const { data } = await supabase.auth.getUser();
            if (!mounted) return;
            if (data.user) router.replace(nextUrl);
        })();
        return () => {
            mounted = false;
        };
    }, [router, nextUrl]);

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setMsg(null);

        const e2 = email.trim();
        if (!e2) return setMsg("Enter your email.");
        if (!password) return setMsg("Enter your password.");

        setBusy(true);
        const { error } = await supabase.auth.signInWithPassword({
            email: e2,
            password,
        });
        setBusy(false);

        if (error) return setMsg(error.message);

        router.replace(nextUrl);
    }

    async function handleSignup(e: React.FormEvent) {
        e.preventDefault();
        setMsg(null);

        const e2 = email.trim();
        const u2 = username.trim().toLowerCase();

        if (!e2) return setMsg("Enter your email.");
        if (!password || password.length < 8) return setMsg("Password must be at least 8 characters.");
        if (!u2) return setMsg("Choose a username.");
        if (!isValidUsername(u2)) {
            return setMsg("Username must be 3–20 characters: lowercase letters, numbers, underscore.");
        }

        setBusy(true);

        // Optional fast check (DB is still the final authority)
        const { data: existing, error: existingErr } = await supabase
            .from("profiles")
            .select("id")
            .eq("username", u2)
            .maybeSingle();

        if (existingErr && existingErr.code !== "PGRST116") {
            setBusy(false);
            return setMsg("Could not check username. Try again.");
        }
        if (existing) {
            setBusy(false);
            return setMsg("That username is already taken.");
        }

        // 1) Create auth user
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
            email: e2,
            password,
        });

        if (signUpErr) {
            setBusy(false);
            return setMsg(signUpErr.message);
        }

        // Supabase may require email confirmation depending on your settings.
        // If confirmations are ON, session might be null until they confirm.
        const userId = signUpData.user?.id;
        if (!userId) {
            setBusy(false);
            return setMsg("Check your email to confirm your account, then log in.");
        }

        // 2) Claim username on the (auto-created) profiles row
        const { error: updErr } = await supabase
            .from("profiles")
            .update({ username: u2 })
            .eq("id", userId);

        setBusy(false);

        if (updErr) {
            // If unique constraint hits (race), show taken
            const m = (updErr as any)?.message?.toLowerCase?.() || "";
            if (m.includes("duplicate") || m.includes("unique")) {
                return setMsg("That username is already taken.");
            }
            return setMsg("Account created, but could not save username. Please try logging in and setting it again.");
        }

        // If confirmations are OFF, they’re logged in immediately.
        // If confirmations are ON, they might still need to confirm.
        const { data: uNow } = await supabase.auth.getUser();
        if (!uNow.user) {
            return setMsg("Check your email to confirm your account, then log in.");
        }

        router.replace(nextUrl);
    }

    async function handleForgot(e: React.FormEvent) {
        e.preventDefault();
        setMsg(null);

        const e2 = email.trim();
        if (!e2) return setMsg("Enter your email.");

        setBusy(true);
        const origin =
            typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

        const { error } = await supabase.auth.resetPasswordForEmail(e2, {
            redirectTo: `${origin}/reset-password`,
        });
        setBusy(false);

        if (error) return setMsg(error.message);

        setMsg("Check your email for a password reset link.");
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
                <div className="flex items-center justify-between mb-5">
                    <h1 className="text-xl font-semibold">
                        {mode === "login" ? "Log in" : mode === "signup" ? "Sign up" : "Reset password"}
                    </h1>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setMode("login")}
                            className={`px-3 py-1.5 rounded-full text-sm border ${mode === "login" ? "bg-black text-white border-black" : "bg-white text-black border-black/15"
                                }`}
                        >
                            Log in
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode("signup")}
                            className={`px-3 py-1.5 rounded-full text-sm border ${mode === "signup" ? "bg-black text-white border-black" : "bg-white text-black border-black/15"
                                }`}
                        >
                            Sign up
                        </button>
                    </div>
                </div>

                <p className="text-sm text-black/60 mb-4">
                    {mode === "login"
                        ? "Use your email and password."
                        : mode === "signup"
                            ? "Choose a username, then create your account."
                            : "We’ll email you a reset link."}
                </p>

                {msg && (
                    <div className="mb-4 rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm text-black/80">
                        {msg}
                    </div>
                )}

                {mode === "login" && (
                    <form onSubmit={handleLogin} className="space-y-3">
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none focus:border-black"
                            autoComplete="email"
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none focus:border-black"
                            autoComplete="current-password"
                        />

                        <button
                            type="submit"
                            disabled={busy}
                            className="w-full rounded-full bg-black text-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
                        >
                            {busy ? "Logging in…" : "Log in"}
                        </button>

                        <button
                            type="button"
                            onClick={() => setMode("forgot")}
                            className="w-full text-sm text-black/70 hover:text-black"
                        >
                            Forgot password?
                        </button>
                    </form>
                )}

                {mode === "signup" && (
                    <form onSubmit={handleSignup} className="space-y-3">
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none focus:border-black"
                            autoComplete="email"
                        />
                        <input
                            type="text"
                            placeholder="Username (lowercase)"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none focus:border-black"
                            autoComplete="username"
                        />
                        <input
                            type="password"
                            placeholder="Password (8+ characters)"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none focus:border-black"
                            autoComplete="new-password"
                        />

                        <button
                            type="submit"
                            disabled={busy}
                            className="w-full rounded-full bg-black text-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
                        >
                            {busy ? "Creating…" : "Create account"}
                        </button>
                    </form>
                )}

                {mode === "forgot" && (
                    <form onSubmit={handleForgot} className="space-y-3">
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none focus:border-black"
                            autoComplete="email"
                        />
                        <button
                            type="submit"
                            disabled={busy}
                            className="w-full rounded-full bg-black text-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
                        >
                            {busy ? "Sending…" : "Send reset link"}
                        </button>

                        <button
                            type="button"
                            onClick={() => setMode("login")}
                            className="w-full text-sm text-black/70 hover:text-black"
                        >
                            Back to login
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
