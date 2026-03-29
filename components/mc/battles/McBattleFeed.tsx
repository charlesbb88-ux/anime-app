"use client";

import { useEffect, useRef, useState } from "react";
import { getUserBattles } from "@/lib/mcBattleFeedService";
import McBattleFeedItem from "./McBattleFeedItem";
import McBattleFeedSkeleton from "./McBattleFeedSkeleton";
import type { McBattleCardRow } from "./mcBattleTypes";

type Props = {
  userId: string;
  initialLimit: number;
  pageSize?: number;
  previewMode?: boolean;
};

export default function McBattleFeed({
  userId,
  initialLimit,
  pageSize = 10,
  previewMode = false,
}: Props) {
  const [battles, setBattles] = useState<McBattleCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [activeBattleId, setActiveBattleId] = useState<string | null>(null);

  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const measureRafRef = useRef<number | null>(null);

  async function loadInitial() {
    try {
      setLoading(true);
      setError(null);

      const data = await getUserBattles({
        userId,
        limit: initialLimit,
        offset: 0,
      });

      setBattles(data);
      setOffset(data.length);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load battles.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    try {
      setLoadingMore(true);
      setError(null);

      const data = await getUserBattles({
        userId,
        limit: pageSize,
        offset,
      });

      setBattles((prev) => [...prev, ...data]);
      setOffset((prev) => prev + data.length);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load more battles.");
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    loadInitial();
  }, [userId]);

  useEffect(() => {
    if (!battles.length) {
      setActiveBattleId(null);
      return;
    }

    function measureActiveCard() {
      measureRafRef.current = null;

      const viewportCenterY = window.innerHeight / 2;

      let bestId: string | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const battle of battles) {
        const el = itemRefs.current[battle.id];
        if (!el) continue;

        const rect = el.getBoundingClientRect();
        const isVisible = rect.bottom > 0 && rect.top < window.innerHeight;

        if (!isVisible) continue;

        const cardCenterY = rect.top + rect.height / 2;
        const distance = Math.abs(cardCenterY - viewportCenterY);

        if (distance < bestDistance) {
          bestDistance = distance;
          bestId = battle.id;
        }
      }

      if (!bestId && battles.length > 0) {
        bestId = battles[0].id;
      }

      setActiveBattleId((prev) => (prev === bestId ? prev : bestId));
    }

    function requestMeasure() {
      if (measureRafRef.current != null) return;
      measureRafRef.current = window.requestAnimationFrame(measureActiveCard);
    }

    requestMeasure();

    window.addEventListener("scroll", requestMeasure, { passive: true });
    window.addEventListener("resize", requestMeasure);

    return () => {
      window.removeEventListener("scroll", requestMeasure);
      window.removeEventListener("resize", requestMeasure);

      if (measureRafRef.current != null) {
        window.cancelAnimationFrame(measureRafRef.current);
        measureRafRef.current = null;
      }
    };
  }, [battles]);

  if (loading) {
    return <McBattleFeedSkeleton count={initialLimit} />;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-200">
        {error}
      </div>
    );
  }

  if (battles.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white/60">
        No battles yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {battles.map((battle) => (
        <McBattleFeedItem
          key={battle.id}
          battle={battle}
          isActive={battle.id === activeBattleId}
          registerNode={(node) => {
            itemRefs.current[battle.id] = node;
          }}
        />
      ))}

      {!previewMode && (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15 disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}