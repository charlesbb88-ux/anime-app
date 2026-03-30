"use client";

import type { NextPage } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import McBattleReplayCard from "@/components/mc/battles/McBattleReplayCard";
import type { McBattleCardRow } from "@/components/mc/battles/mcBattleTypes";
import { getMcBattleById } from "@/lib/getMcBattleById";

function getFirstQueryParam(param: string | string[] | undefined) {
  if (typeof param === "string") return param;
  if (Array.isArray(param)) return param[0] ?? "";
  return "";
}

function formatBattleDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  const time = date.getTime();

  if (!Number.isFinite(time)) {
    return "";
  }

  return date.toLocaleString();
}

const McBattleDetailPage: NextPage = () => {
  const router = useRouter();
  const rawBattleId = getFirstQueryParam(router.query.battleId);

  const [battle, setBattle] = useState<McBattleCardRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const battleId = useMemo(() => {
    return rawBattleId.trim();
  }, [rawBattleId]);

  useEffect(() => {
    if (!router.isReady || !battleId) return;

    let cancelled = false;

    async function loadBattle() {
      try {
        setLoading(true);
        setError(null);
        setNotFound(false);

        const row = await getMcBattleById(battleId);

        if (cancelled) return;

        if (!row) {
          setBattle(null);
          setNotFound(true);
          setLoading(false);
          return;
        }

        setBattle(row);
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Failed to load battle.");
        setLoading(false);
      }
    }

    loadBattle();

    return () => {
      cancelled = true;
    };
  }, [router.isReady, battleId]);

  const challengerName = battle?.challenger_snapshot?.username ?? "Challenger";
  const defenderName = battle?.defender_snapshot?.username ?? "Defender";

  return (
    <main className="min-h-screen text-black">
      <div className="mx-auto max-w-5xl px-4 pt-5 pb-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-10 text-sm text-white/65">
            Loading battle...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4 text-sm text-red-200">
            {error}
          </div>
        ) : notFound || !battle ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-10 text-sm text-white/65">
            Battle not found.
          </div>
        ) : (
          <div className="space-y-4">
            <McBattleReplayCard battle={battle} isActive />
          </div>
        )}
      </div>
    </main>
  );
};

export default McBattleDetailPage;