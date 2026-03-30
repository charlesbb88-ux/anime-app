"use client";

import type { ReactNode } from "react";

function SkeletonBlock({
  className = "",
}: {
  className?: string;
}) {
  return <div className={`animate-pulse rounded-xl bg-white/10 ${className}`} />;
}

function SkeletonCard({
  titleWidth = "w-20",
  children,
  className = "",
  bodyClassName = "px-4 pb-3",
}: {
  titleWidth?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={`rounded-md border border-white/10 bg-black ${className}`}>
      <div className="px-4 py-2">
        <SkeletonBlock className={`h-3 ${titleWidth}`} />
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

function BattleReplaySkeleton() {
  return (
    <div className="min-w-0 overflow-hidden rounded-sm border border-black bg-white p-1">
      <div className="overflow-hidden rounded-sm border border-black/10 bg-black/[0.04]">
        <div className="relative h-[220px] w-full">
          <div className="absolute left-[12%] bottom-6 flex flex-col items-center">
            <SkeletonBlock className="h-14 w-10 rounded-md bg-black/10" />
            <SkeletonBlock className="mt-2 h-2 w-12 rounded-full bg-black/10" />
          </div>

          <div className="absolute right-[12%] bottom-6 flex flex-col items-center">
            <SkeletonBlock className="h-14 w-10 rounded-md bg-black/10" />
            <SkeletonBlock className="mt-2 h-2 w-12 rounded-full bg-black/10" />
          </div>

          <div className="absolute left-3 top-3">
            <SkeletonBlock className="h-8 w-24 rounded-md bg-black/10" />
          </div>

          <div className="absolute right-3 top-3">
            <SkeletonBlock className="h-8 w-24 rounded-md bg-black/10" />
          </div>

          <div className="absolute left-1/2 top-3 -translate-x-1/2">
            <SkeletonBlock className="h-6 w-20 rounded-full bg-black/10" />
          </div>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
            <SkeletonBlock className="h-2.5 w-28 rounded-full bg-black/10" />
          </div>
        </div>
      </div>

      <div className="mt-2 flex justify-center">
        <div className="flex items-center gap-1 pb-1">
          <SkeletonBlock className="h-4 w-14 rounded-md bg-black/10" />
          <SkeletonBlock className="h-4 w-4 rounded-md bg-black/10" />
        </div>
      </div>
    </div>
  );
}

export default function MCLayoutSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(320px,1fr)_320px]">
      <div className="order-2 flex flex-col gap-2 lg:order-none lg:col-start-1">
        <SkeletonCard titleWidth="w-14">
          <div className="mt-2 space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2">
                <SkeletonBlock className="h-3 w-10" />
                <SkeletonBlock className="mt-2 h-9 w-14" />
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2">
                <SkeletonBlock className="h-3 w-8" />
                <SkeletonBlock className="mt-2 h-9 w-20" />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2">
              <div className="flex items-center justify-between gap-3">
                <SkeletonBlock className="h-4 w-36" />
                <SkeletonBlock className="h-4 w-12" />
              </div>

              <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[58%] rounded-full bg-white/20" />
              </div>

              <SkeletonBlock className="mt-2 h-3 w-28" />
            </div>

            <div className="grid gap-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2">
                <SkeletonBlock className="h-3 w-10" />
                <SkeletonBlock className="mt-2 h-6 w-40" />
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2">
                <SkeletonBlock className="h-3 w-10" />
                <SkeletonBlock className="mt-2 h-6 w-24" />
              </div>
            </div>
          </div>
        </SkeletonCard>

        <SkeletonCard titleWidth="w-20" bodyClassName="px-4 pb-2">
          <div className="mt-2 grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2"
              >
                <SkeletonBlock className="h-3 w-16" />
                <SkeletonBlock className="mt-2 h-7 w-14" />
              </div>
            ))}
          </div>
        </SkeletonCard>
      </div>

      <div className="order-1 flex flex-col gap-2 lg:order-none lg:col-start-2">
        <div className="h-full rounded-md border border-white/10 bg-black p-3">
          <div className="flex h-full flex-col">
            <div className="flex flex-1 items-start justify-center">
              <div className="flex w-full max-w-md flex-col items-center">
                <div className="relative w-full max-w-[420px]">
                  <div className="flex h-[420px] w-full items-center justify-center rounded-[2rem] border border-white/10 bg-black/20">
                    <div className="flex flex-col items-center">
                      <SkeletonBlock className="h-40 w-28 rounded-2xl" />
                    </div>
                  </div>

                  <div className="absolute right-3 top-3 z-20">
                    <SkeletonBlock className="h-8 w-8 rounded-full" />
                  </div>
                </div>

                <div className="mt-2 flex w-full flex-col items-center text-center">
                  <SkeletonBlock className="h-7 w-32" />
                  <SkeletonBlock className="mt-2 h-5 w-44" />
                  <SkeletonBlock className="mt-3 h-4 w-20" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <SkeletonCard titleWidth="w-24">
          <div className="mt-2 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2">
              <SkeletonBlock className="h-3 w-10" />
              <SkeletonBlock className="mt-2 h-9 w-12" />
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2">
              <SkeletonBlock className="h-3 w-12" />
              <SkeletonBlock className="mt-2 h-9 w-12" />
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2">
              <SkeletonBlock className="h-3 w-10" />
              <SkeletonBlock className="mt-2 h-9 w-12" />
            </div>
          </div>

          <div className="mt-3 grid gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <SkeletonBlock className="h-4 w-28" />
                  <SkeletonBlock className="h-4 w-12" />
                </div>
              </div>
            ))}
          </div>
        </SkeletonCard>
      </div>

      <div className="order-3 flex flex-col gap-2 lg:order-none lg:col-start-3">
        <SkeletonCard titleWidth="w-16" bodyClassName="px-4 pb-2">
          <div className="mt-2 space-y-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-center">
              <SkeletonBlock className="mx-auto h-4 w-24" />
            </div>
          </div>
        </SkeletonCard>

        <SkeletonCard titleWidth="w-24" bodyClassName="px-4 pb-2">
          <div className="mt-2 grid grid-cols-1 gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <SkeletonBlock className="h-4 w-24" />
                  <SkeletonBlock className="h-7 w-12" />
                </div>
              </div>
            ))}
          </div>
        </SkeletonCard>

        <SkeletonCard titleWidth="w-16" bodyClassName="px-4 pb-2">
          <div className="mt-2 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <SkeletonBlock className="h-5 w-24" />
                    <SkeletonBlock className="mt-2 h-3 w-16" />
                  </div>

                  <SkeletonBlock className="h-7 w-14 rounded-lg" />
                </div>

                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[45%] rounded-full bg-white/20" />
                </div>
              </div>
            ))}
          </div>
        </SkeletonCard>
      </div>

      <div className="order-4 mt-2 min-w-0 lg:col-span-3">
        <div className="mb-4 flex items-center justify-between">
          <SkeletonBlock className="h-7 w-20 rounded-md bg-black/10" />
          <SkeletonBlock className="h-5 w-16 rounded-md bg-black/10" />
        </div>

        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <BattleReplaySkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}