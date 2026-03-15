"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AccountProgressionCard from "@/components/mc/AccountProgressionCard";
import TagProgressionList, {
  type ProgressionTagRow,
} from "@/components/mc/TagProgressionList";

type AccountProgressionRow = {
  user_id: string;
  account_level: number;
  account_xp: number;
  current_level_floor_xp: number;
  next_level_xp: number;
  progress_into_level: number;
  progress_needed_in_level: number;
  progress_percent: number;
};

function safeNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default function MC() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountProgressionRow | null>(null);
  const [allTags, setAllTags] = useState<ProgressionTagRow[]>([]);

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
            setAllTags([]);
            setLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setUserId(user.id);
        }

        const [
          { data: accountData, error: accountError },
          { data: tagData, error: tagError },
        ] = await Promise.all([
          supabase.rpc("get_account_progression", { p_user_id: user.id }),
          supabase.rpc("get_user_progression_detailed", { p_user_id: user.id }),
        ]);

        if (accountError) throw accountError;
        if (tagError) throw tagError;

        if (!cancelled) {
          const rawAccount = ((accountData as any[] | null) ?? [])[0] ?? null;

          const normalizedAccount: AccountProgressionRow | null = rawAccount
            ? {
                user_id: String(rawAccount.user_id ?? user.id),
                account_level: safeNumber(rawAccount.account_level, 1),
                account_xp: safeNumber(rawAccount.account_xp, 0),
                current_level_floor_xp: safeNumber(rawAccount.current_level_floor_xp, 0),
                next_level_xp: safeNumber(rawAccount.next_level_xp, 0),
                progress_into_level: safeNumber(rawAccount.progress_into_level, 0),
                progress_needed_in_level: safeNumber(rawAccount.progress_needed_in_level, 0),
                progress_percent: safeNumber(rawAccount.progress_percent, 0),
              }
            : null;

          const normalizedTags: ProgressionTagRow[] = ((tagData as any[] | null) ?? []).map(
            (tag) => ({
              tag_id: safeNumber(tag.tag_id, 0),
              tag_name: String(tag.tag_name ?? ""),
              tag_level: safeNumber(tag.tag_level, 1),
              tag_xp: safeNumber(tag.tag_xp, 0),
              current_level_floor_xp: safeNumber(tag.current_level_floor_xp, 0),
              next_level_xp: safeNumber(tag.next_level_xp, 0),
              progress_into_level: safeNumber(tag.progress_into_level, 0),
              progress_needed_in_level: safeNumber(tag.progress_needed_in_level, 0),
              progress_percent: safeNumber(tag.progress_percent, 0),
            })
          );

          setAccount(normalizedAccount);
          setAllTags(normalizedTags);
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
            <AccountProgressionCard
              account_level={account?.account_level ?? 1}
              account_xp={account?.account_xp ?? 0}
              progress_percent={account?.progress_percent ?? 0}
              progress_into_level={account?.progress_into_level ?? 0}
              progress_needed_in_level={account?.progress_needed_in_level ?? 0}
            />

            <TagProgressionList tags={allTags} />
          </div>
        )}
      </div>
    </div>
  );
}