import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import ProBadge from "@/components/pro/ProBadge";
import { supabase } from "@/lib/supabaseClient";

type LeaderboardUser = {
    user_id: string;
    username: string | null;
    avatar_url: string | null;
    is_pro: boolean;
    account_xp: number;
    account_level: number;
};

export default function LeaderboardPage() {
    const [users, setUsers] = useState<LeaderboardUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        async function loadLeaderboard() {
            try {
                setLoading(true);
                setErrorMessage(null);

                const { data, error } = await supabase.rpc("get_leaderboard_users", {
                    limit_count: 20,
                });

                if (error) throw error;

                setUsers(
                    data?.map((row: any) => ({
                        user_id: row.user_id,
                        username: row.username ?? null,
                        avatar_url: row.avatar_url ?? null,
                        is_pro: !!row.is_pro,
                        account_xp: row.account_xp ?? 0,
                        account_level: row.account_level ?? 1,
                    })) ?? []
                );
            } catch (error: any) {
                console.error("Leaderboard error:", error);
                setErrorMessage(error?.message ?? "Failed to load leaderboard.");
            } finally {
                setLoading(false);
            }
        }

        loadLeaderboard();
    }, []);

    const topThree = users.slice(0, 3);
    const rest = users.slice(3);

    return (
        <main className="min-h-screen bg-white px-3 py-4 text-black sm:px-6 sm:py-8">
            <div className="mx-auto max-w-5xl">
                <div className="mb-4 rounded-[10px] border-[3px] border-black bg-white p-4 shadow-[6px_6px_0px_#000]">
                    <h1 className="text-center text-2xl font-black sm:text-4xl">
                        Leaderboard
                    </h1>
                    <p className="mt-1 text-center text-sm font-medium text-neutral-600">
                        Ranked by account XP
                    </p>
                </div>

                {loading && <StatusCard text="Loading leaderboard..." />}
                {!loading && errorMessage && <StatusCard text={errorMessage} error />}
                {!loading && !errorMessage && users.length === 0 && (
                    <StatusCard text="No leaderboard users yet." />
                )}

                {!loading && !errorMessage && users.length > 0 && (
                    <>
                        <section className="mb-4 grid grid-cols-3 items-end gap-2 sm:mb-6 sm:gap-4">
                            {topThree.map((user, index) => (
                                <PodiumCard
                                    key={user.user_id}
                                    user={user}
                                    rank={index + 1}
                                />
                            ))}
                        </section>

                        <section className="overflow-hidden rounded-[10px] border-[3px] border-black bg-white shadow-[6px_6px_0px_#000]">
                            {rest.map((user, index) => (
                                <LeaderboardRow
                                    key={user.user_id}
                                    user={user}
                                    rank={index + 4}
                                />
                            ))}
                        </section>
                    </>
                )}
            </div>
        </main>
    );
}

function StatusCard({ text, error = false }: { text: string; error?: boolean }) {
    return (
        <div
            className={`rounded-[10px] border-[3px] border-black bg-white p-6 text-center font-bold shadow-[6px_6px_0px_#000] ${error ? "text-red-600" : "text-black"
                }`}
        >
            {text}
        </div>
    );
}

function PodiumCard({
    user,
    rank,
}: {
    user: LeaderboardUser;
    rank: number;
}) {
    const username = user.username || "Player";

    const height =
        rank === 1
            ? "h-[190px] sm:h-[270px]"
            : rank === 2
                ? "h-[160px] sm:h-[225px]"
                : "h-[145px] sm:h-[205px]";

    const orderClass = rank === 1 ? "order-2" : rank === 2 ? "order-1" : "order-3";

    // 👇 ONLY CHANGE: avatar sizes scale by rank
    const avatarSize =
        rank === 1
            ? "h-20 w-20 sm:h-28 sm:w-28"
            : rank === 2
                ? "h-16 w-16 sm:h-24 sm:w-24"
                : "h-14 w-14 sm:h-20 sm:w-20";

    return (
        <Link
            href={`/${username}`}
            className={`${orderClass} ${height} relative flex min-w-0 flex-col items-center justify-center rounded-[10px] border-[3px] border-black bg-white p-2 text-center shadow-[4px_4px_0px_#000] transition hover:-translate-y-1 sm:p-4`}
        >
            <div className="absolute left-2 top-2 rounded-[5px] border-[2px] border-black bg-white px-2 py-1 text-[10px] font-black sm:text-sm">
                {rank === 1 ? "1st" : rank === 2 ? "2nd" : "3rd"}
            </div>

            <div className="absolute right-2 top-2 text-xl sm:text-3xl">
                {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}
            </div>

            {/* 👇 Bigger avatar (no weird positioning) */}
            <div
                className={`${avatarSize} mb-2 overflow-hidden rounded-full border-[3px] border-black bg-neutral-100`}
            >
                {user.avatar_url ? (
                    <Image
                        src={user.avatar_url}
                        alt={username}
                        width={200}
                        height={200}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-xl font-black text-black">
                        {username.slice(0, 1).toUpperCase()}
                    </div>
                )}
            </div>

            <div className="flex max-w-full items-center justify-center gap-1 truncate text-xs font-black sm:text-base">
                <span className="truncate">{username}</span>
                <ProBadge isPro={user.is_pro} />
            </div>

            <div className="text-xs font-black text-green-600 sm:text-lg">
                {user.account_xp.toLocaleString()} XP
            </div>

            <div className="text-[10px] font-bold text-neutral-500 sm:text-xs">
                Level {user.account_level}
            </div>
        </Link>
    );
}

function LeaderboardRow({
    user,
    rank,
}: {
    user: LeaderboardUser;
    rank: number;
}) {
    const username = user.username || "Player";

    return (
        <Link
            href={`/${username}`}
            className="flex items-center gap-3 border-b-[2px] border-black px-3 py-3 last:border-b-0 hover:bg-neutral-100 sm:gap-4 sm:px-5 sm:py-4"
        >
            <Avatar src={user.avatar_url} username={username} />

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 truncate text-sm font-black sm:text-base">
                    <span className="truncate">{username}</span>
                    <ProBadge isPro={user.is_pro} />
                </div>

                <div className="text-sm font-black text-green-600">
                    {user.account_xp.toLocaleString()} XP
                </div>

                <div className="text-xs font-bold text-neutral-500">
                    Level {user.account_level}
                </div>
            </div>

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[2px] border-black bg-white text-sm font-black shadow-[2px_2px_0px_#000] sm:h-12 sm:w-12">
                {rank}
            </div>
        </Link>
    );
}

function Avatar({
    src,
    username,
    large = false,
}: {
    src: string | null;
    username: string;
    large?: boolean;
}) {
    const size = large
        ? "h-14 w-14 sm:h-24 sm:w-24"
        : "h-12 w-12 sm:h-14 sm:w-14";

    return (
        <div
            className={`${size} relative shrink-0 overflow-hidden rounded-full border-[2px] border-black bg-neutral-100`}
        >
            {src ? (
                <Image
                    src={src}
                    alt={username}
                    fill
                    sizes="56px"
                    className="object-cover"
                />
            ) : (
                <div className="flex h-full w-full items-center justify-center text-lg font-black text-black">
                    {username.slice(0, 1).toUpperCase()}
                </div>
            )}
        </div>
    );
}