"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TagProgressionCard from "@/components/mc/TagProgressionCard";

export type ProgressionTagRow = {
  tag_id: number;
  tag_name: string;
  tag_level: number;
  tag_xp: number;
  current_level_floor_xp: number;
  next_level_xp: number;
  progress_into_level: number;
  progress_needed_in_level: number;
  progress_percent: number;
};

const PAGE_SIZE = 10;

type Props = {
  tags: ProgressionTagRow[];
};

export default function TagProgressionList({ tags }: Props) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [tags]);

  const visibleTags = useMemo(() => {
    return tags.slice(0, visibleCount);
  }, [tags, visibleCount]);

  const hasMore = visibleCount < tags.length;

  useEffect(() => {
    if (!hasMore) return;
    if (!loadMoreRef.current) return;

    const node = loadMoreRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;

        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, tags.length));
      },
      {
        root: null,
        rootMargin: "200px 0px",
        threshold: 0,
      }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, tags.length]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm uppercase tracking-wide text-white/60">All Tags</div>
        <div className="text-sm text-white/50">
          Showing {visibleTags.length} of {tags.length}
        </div>
      </div>

      {tags.length === 0 ? (
        <div className="mt-4 text-white/70">No progression tags yet.</div>
      ) : (
        <>
          <div className="mt-4 space-y-3">
            {visibleTags.map((tag) => (
              <TagProgressionCard
                key={tag.tag_id}
                tag_id={tag.tag_id}
                tag_name={tag.tag_name}
                tag_level={tag.tag_level}
                tag_xp={tag.tag_xp}
                progress_into_level={tag.progress_into_level}
                progress_needed_in_level={tag.progress_needed_in_level}
                progress_percent={tag.progress_percent}
              />
            ))}
          </div>

          {hasMore && (
            <div
              ref={loadMoreRef}
              className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center text-sm text-white/50"
            >
              Loading more...
            </div>
          )}

          {!hasMore && tags.length > PAGE_SIZE && (
            <div className="mt-4 text-center text-sm text-white/40">
              All tags loaded
            </div>
          )}
        </>
      )}
    </div>
  );
}