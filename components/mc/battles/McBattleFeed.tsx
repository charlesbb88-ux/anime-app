"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getUserBattles } from "@/lib/mcBattleFeedService";
import McBattleFeedItem from "./McBattleFeedItem";
import McBattleFeedSkeleton from "./McBattleFeedSkeleton";
import type { McBattleCardRow } from "./mcBattleTypes";
import { useMcBattleUserMetaMap } from "@/hooks/useMcBattleUserMetaMap";

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
  const [hasMore, setHasMore] = useState(true);

  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const measureRafRef = useRef<number | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  const battleUserIds = useMemo(() => {
    return Array.from(
      new Set(
        battles.flatMap((battle) => [
          battle.challenger_user_id,
          battle.defender_user_id,
        ])
      )
    );
  }, [battles]);

  const {
    metaMap: fighterMetaMap,
    loading: fighterMetaLoading,
    error: fighterMetaError,
  } = useMcBattleUserMetaMap(battleUserIds);

  const scheduleMeasure = useCallback(() => {
    if (typeof window === "undefined") return;

    if (measureRafRef.current != null) return;

    measureRafRef.current = window.requestAnimationFrame(() => {
      measureRafRef.current = null;

      const viewportHeight = window.innerHeight;
      const viewportCenterY = viewportHeight / 2;

      let bestId: string | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      let visibleCount = 0;

      for (const battle of battles) {
        const el = itemRefs.current[battle.id];
        if (!el) continue;

        const rect = el.getBoundingClientRect();
        const isVisible = rect.bottom > 0 && rect.top < viewportHeight;

        if (!isVisible) continue;

        visibleCount += 1;

        const cardCenterY = rect.top + rect.height / 2;
        const distance = Math.abs(cardCenterY - viewportCenterY);

        if (distance < bestDistance) {
          bestDistance = distance;
          bestId = battle.id;
        }
      }

      if (bestId) {
        setActiveBattleId((prev) => (prev === bestId ? prev : bestId));
        return;
      }

      if (visibleCount === 0) {
        setActiveBattleId((prev) => prev);
      }
    });
  }, [battles]);

  const loadInitial = useCallback(async () => {
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
      setHasMore(data.length === initialLimit);
      setActiveBattleId(data[0]?.id ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load battles.");
    } finally {
      setLoading(false);
    }
  }, [userId, initialLimit]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;

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
      setHasMore(data.length === pageSize);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load more battles.");
    } finally {
      setLoadingMore(false);
    }
  }, [userId, pageSize, offset, loadingMore, hasMore]);

  const handleNodeChange = useCallback(
    (battleId: string, node: HTMLDivElement | null) => {
      itemRefs.current[battleId] = node;
      scheduleMeasure();
    },
    [scheduleMeasure]
  );

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    const currentIds = new Set(battles.map((battle) => battle.id));

    for (const battleId of Object.keys(itemRefs.current)) {
      if (!currentIds.has(battleId)) {
        delete itemRefs.current[battleId];
      }
    }
  }, [battles]);

  useEffect(() => {
    if (!battles.length) {
      setActiveBattleId(null);
      return;
    }

    const run = () => {
      scheduleMeasure();
    };

    run();

    const t1 = window.setTimeout(run, 0);
    const t2 = window.setTimeout(run, 80);
    const t3 = window.setTimeout(run, 180);

    window.addEventListener("scroll", run, { passive: true });
    window.addEventListener("resize", run);

    return () => {
      window.removeEventListener("scroll", run);
      window.removeEventListener("resize", run);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);

      if (measureRafRef.current != null) {
        window.cancelAnimationFrame(measureRafRef.current);
        measureRafRef.current = null;
      }
    };
  }, [battles, scheduleMeasure]);

  useEffect(() => {
    if (previewMode) return;
    if (!hasMore) return;
    if (loading) return;

    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (loadingMore) return;

        loadMore();
      },
      {
        root: null,
        rootMargin: "800px 0px",
        threshold: 0,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [previewMode, hasMore, loading, loadingMore, loadMore]);

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
      {fighterMetaError && (
        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-200">
          Failed to load some fighter profile info. Battles still loaded.
        </div>
      )}

      {battles.map((battle) => (
        <McBattleFeedItem
          key={battle.id}
          battle={battle}
          isActive={battle.id === activeBattleId}
          onNodeChange={handleNodeChange}
          fighterMetaMap={fighterMetaMap}
        />
      ))}

      {!previewMode && hasMore && (
        <div ref={loadMoreSentinelRef} className="h-8 w-full" />
      )}

      {!previewMode && loadingMore && <McBattleFeedSkeleton count={2} />}
    </div>
  );
}