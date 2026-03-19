"use client";

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
}: {
    titleWidth?: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={`rounded-md border border-white/10 bg-black ${className}`}>
            <div className="px-4 py-2">
                <SkeletonBlock className={`h-3 ${titleWidth}`} />
            </div>
            <div className="px-4 pb-3">{children}</div>
        </div>
    );
}

export default function MCLayoutSkeleton() {
    return (
        <>
            <div className="grid gap-4 lg:grid-cols-[320px_minmax(320px,1fr)_320px]">
                <div className="order-2 flex flex-col gap-6 lg:order-none lg:col-start-1">
                    <SkeletonCard titleWidth="w-14">
                        <div className="mt-2 space-y-2">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2">
                                    <SkeletonBlock className="h-3 w-10" />
                                    <SkeletonBlock className="mt-2 h-8 w-16" />
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2">
                                    <SkeletonBlock className="h-3 w-8" />
                                    <SkeletonBlock className="mt-2 h-8 w-20" />
                                </div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2">
                                <div className="flex items-center justify-between gap-3">
                                    <SkeletonBlock className="h-4 w-36" />
                                    <SkeletonBlock className="h-4 w-12" />
                                </div>
                                <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/10">
                                    <div className="h-full w-[55%] rounded-full bg-white/20" />
                                </div>
                                <SkeletonBlock className="mt-2 h-3 w-24" />
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

                    <SkeletonCard titleWidth="w-20">
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

                <div className="order-1 lg:order-none lg:col-start-2">
                    <div className="h-full rounded-md border border-white/10 bg-black p-3">
                        <div className="flex h-full flex-col">
                            <div className="flex flex-1 items-start justify-center">
                                <div className="flex w-full max-w-md flex-col items-center">
                                    <div className="flex h-[420px] w-full items-center justify-center rounded-[2rem] border border-white/10 bg-black/20">
                                        <div className="flex flex-col items-center">
                                            <SkeletonBlock className="h-28 w-28 rounded-full" />
                                            <SkeletonBlock className="mt-5 h-6 w-36" />
                                            <SkeletonBlock className="mt-3 h-4 w-48" />
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
                </div>

                <div className="order-3 flex flex-col gap-6 lg:order-none lg:col-start-3">
                    <SkeletonCard titleWidth="w-16">
                        <div className="mt-2 space-y-3">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2"
                                >
                                    <SkeletonBlock className="h-5 w-full" />
                                </div>
                            ))}
                        </div>
                    </SkeletonCard>

                    <SkeletonCard titleWidth="w-24">
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

                    <SkeletonCard titleWidth="w-16">
                        <div className="mt-2 space-y-2">
                            {Array.from({ length: 5 }).map((_, i) => (
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
            </div>
        </>
    );
}