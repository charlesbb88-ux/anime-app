"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type UserProgressionRow = {
  user_id: string;
  account_xp: number;
  account_level: number;
};

type ProgressionTagRow = {
  tag_id: number;
  tag_name: string;
  tag_level: number;
  tag_xp: number;
};

export default function MC() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [account, setAccount] = useState<UserProgressionRow | null>(null);
  const [topTags, setTopTags] = useState<ProgressionTagRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
          if (!cancelled) {
            setUserId(null);
            setAccount(null);
            setTopTags([]);
            setLoading(false);
          }
          return;
        }

        if (!cancelled) setUserId(user.id);

        const [{ data: accountData, error: accountError }, { data: tagData, error: tagError }] =
          await Promise.all([
            supabase
              .from("user_progression")
              .select("user_id, account_xp, account_level")
              .eq("user_id", user.id)
              .maybeSingle(),
            supabase.rpc("get_user_progression", { p_user_id: user.id }),
          ]);

        if (accountError) throw accountError;
        if (tagError) throw tagError;

        if (!cancelled) {
          setAccount((accountData as UserProgressionRow | null) ?? null);
          setTopTags(((tagData as ProgressionTagRow[] | null) ?? []).slice(0, 5));
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load progression.");
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold">Progression</h1>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
            Loading...
          </div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-200">
            {error}
          </div>
        ) : !userId ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
            You must be logged in to view this page.
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm uppercase tracking-wide text-white/60">Account</div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-wide text-white/50">Level</div>
                  <div className="mt-2 text-3xl font-bold">
                    {account?.account_level ?? 1}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-wide text-white/50">XP</div>
                  <div className="mt-2 text-3xl font-bold">
                    {account?.account_xp ?? 0}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm uppercase tracking-wide text-white/60">Top Tags</div>

              {topTags.length === 0 ? (
                <div className="mt-4 text-white/70">No progression tags yet.</div>
              ) : (
                <div className="mt-4 space-y-3">
                  {topTags.map((tag) => (
                    <div
                      key={tag.tag_id}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                    >
                      <div>
                        <div className="font-semibold">{tag.tag_name}</div>
                        <div className="text-sm text-white/50">
                          XP: {Number(tag.tag_xp).toFixed(2)}
                        </div>
                      </div>

                      <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold">
                        Lv {tag.tag_level}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}