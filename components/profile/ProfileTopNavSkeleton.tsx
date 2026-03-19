"use client";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/10 ${className}`} />;
}

export default function ProfileTopNavSkeleton() {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-4">
        {/* avatar */}
        <Skeleton className="h-12 w-12 rounded-full" />

        {/* username + bio */}
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>

      {/* tabs */}
      <div className="mt-4 flex gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-16" />
        ))}
      </div>
    </div>
  );
}