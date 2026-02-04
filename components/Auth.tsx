"use client";
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  async function handleLogin() {
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error("Supabase auth error:", error);
      setMessage(error.message);
    } else {
      setMessage("Check your inbox for the login link.");
    }
  }


  return (
    <div className="flex flex-col gap-4">
      <input
        type="email"
        placeholder="Your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border p-2 rounded"
      />
      <button
        onClick={handleLogin}
        className="bg-black text-white dark:bg-white dark:text-black rounded px-4 py-2"
      >
        Log In
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}
