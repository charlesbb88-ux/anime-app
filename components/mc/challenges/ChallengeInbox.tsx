"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
    acceptChallenge,
    cancelChallenge,
    getChallengeInbox,
    rejectChallenge,
    type McChallengeInboxData,
    type McChallengeWithProfiles,
} from "@/lib/mcChallenges";

type TabKey = "received" | "sent" | "ready";

type Props = {
    className?: string;
};

function formatRelativeDate(value: string) {
    const date = new Date(value);
    const time = date.getTime();

    if (!Number.isFinite(time)) {
        return "";
    }

    const diffMs = time - Date.now();
    const absMs = Math.abs(diffMs);

    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (absMs < minute) {
        return diffMs < 0 ? "just now" : "in under a minute";
    }

    if (absMs < hour) {
        const count = Math.round(absMs / minute);
        return diffMs < 0 ? `${count}m ago` : `in ${count}m`;
    }

    if (absMs < day) {
        const count = Math.round(absMs / hour);
        return diffMs < 0 ? `${count}h ago` : `in ${count}h`;
    }

    const count = Math.round(absMs / day);
    return diffMs < 0 ? `${count}d ago` : `in ${count}d`;
}

function sectionEmptyText(tab: TabKey) {
    if (tab === "received") return "No pending incoming challenges.";
    if (tab === "sent") return "No pending outgoing challenges.";
    return "No battles ready to watch.";
}

function getUpdateLabel(status: string) {
    if (status === "rejected") return "Rejected";
    if (status === "expired") return "Expired";
    return status;
}

function ChallengeRow({
    challenge,
    mode,
    loadingAction,
    onAccept,
    onReject,
    onCancel,
    onWatch,
}: {
    challenge: McChallengeWithProfiles;
    mode: TabKey;
    loadingAction: string | null;
    onAccept: (challengeId: string) => void;
    onReject: (challengeId: string) => void;
    onCancel: (challengeId: string) => void;
    onWatch: (challengeId: string, battleId: string) => void | Promise<void>;
}) {
    const otherUser =
        mode === "received" || mode === "ready"
            ? challenge.challenger
            : challenge.defender;

    const rowActionPrefix = `${mode}:${challenge.id}`;
    const accepting = loadingAction === `${rowActionPrefix}:accept`;
    const rejecting = loadingAction === `${rowActionPrefix}:reject`;
    const canceling = loadingAction === `${rowActionPrefix}:cancel`;
    const watching = loadingAction === `${rowActionPrefix}:watch`;

    return (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">
                        @{otherUser?.username ?? "Unknown user"}
                    </div>

                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/40">
                        {mode === "received"
                            ? "Received"
                            : mode === "sent"
                                ? "Sent"
                                : "Ready to watch"}
                    </div>

                    <div className="mt-2 text-sm text-white/65">
                        {mode === "received" ? (
                            <>Expires {formatRelativeDate(challenge.expires_at)}</>
                        ) : null}

                        {mode === "sent" ? (
                            <>
                                Waiting for response • expires{" "}
                                {formatRelativeDate(challenge.expires_at)}
                            </>
                        ) : null}

                        {mode === "ready" ? (
                            <>
                                Battle created{" "}
                                {formatRelativeDate(
                                    challenge.responded_at ?? challenge.updated_at
                                )}
                            </>
                        ) : null}
                    </div>
                </div>

                {otherUser?.avatar_url ? (
                    <img
                        src={otherUser.avatar_url}
                        alt={otherUser.username}
                        className="h-10 w-10 rounded-full object-cover"
                    />
                ) : (
                    <div className="h-10 w-10 rounded-full border border-white/10 bg-white/5" />
                )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
                {mode === "received" ? (
                    <>
                        <button
                            type="button"
                            onClick={() => onAccept(challenge.id)}
                            disabled={accepting || rejecting || canceling}
                            className="rounded-xl border border-white/10 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {accepting ? "Accepting..." : "Accept"}
                        </button>

                        <button
                            type="button"
                            onClick={() => onReject(challenge.id)}
                            disabled={accepting || rejecting || canceling}
                            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {rejecting ? "Rejecting..." : "Reject"}
                        </button>
                    </>
                ) : null}

                {mode === "sent" ? (
                    <button
                        type="button"
                        onClick={() => onCancel(challenge.id)}
                        disabled={canceling}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {canceling ? "Canceling..." : "Cancel challenge"}
                    </button>
                ) : null}

                {mode === "ready" && challenge.battle_id ? (
                    <button
                        type="button"
                        onClick={() => onWatch(challenge.id, challenge.battle_id!)}
                        disabled={watching}
                        className="rounded-xl border border-white/10 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {watching ? "Opening..." : "Watch battle"}
                    </button>
                ) : null}
            </div>
        </div>
    );
}

export default function ChallengeInbox({ className = "" }: Props) {
    const [tab, setTab] = useState<TabKey>("received");
    const [data, setData] = useState<McChallengeInboxData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function loadInbox(nextMode: "initial" | "refresh" = "initial") {
        try {
            setError(null);

            if (nextMode === "initial") {
                setLoading(true);
            } else {
                setRefreshing(true);
            }

            const inbox = await getChallengeInbox();
            setData(inbox);
        } catch (e: any) {
            setError(e?.message ?? "Failed to load battle inbox.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    useEffect(() => {
        loadInbox("initial");
    }, []);

    const rows = useMemo(() => {
        if (!data) return [];

        if (tab === "received") return data.received;
        if (tab === "sent") return data.sent;
        return data.readyToWatch;
    }, [data, tab]);

    async function handleAccept(challengeId: string) {
        const key = `received:${challengeId}:accept`;
        try {
            setLoadingAction(key);
            setError(null);
            await acceptChallenge(challengeId);
            await loadInbox("refresh");
            setTab("ready");
        } catch (e: any) {
            setError(e?.message ?? "Failed to accept challenge.");
        } finally {
            setLoadingAction(null);
        }
    }

    async function handleReject(challengeId: string) {
        const key = `received:${challengeId}:reject`;
        try {
            setLoadingAction(key);
            setError(null);
            await rejectChallenge(challengeId);
            await loadInbox("refresh");
        } catch (e: any) {
            setError(e?.message ?? "Failed to reject challenge.");
        } finally {
            setLoadingAction(null);
        }
    }

    async function handleCancel(challengeId: string) {
        const key = `sent:${challengeId}:cancel`;
        try {
            setLoadingAction(key);
            setError(null);
            await cancelChallenge(challengeId);
            await loadInbox("refresh");
        } catch (e: any) {
            setError(e?.message ?? "Failed to cancel challenge.");
        } finally {
            setLoadingAction(null);
        }
    }

    async function handleWatch(challengeId: string, battleId: string) {
        const key = `ready:${challengeId}:watch`;

        try {
            setLoadingAction(key);

            const {
                data: { user },
            } = await supabase.auth.getUser();

            await fetch("/api/mc/challenges/view", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    challengeId,
                    actorUserId: user?.id,
                }),
            });

            window.location.href = `/battles/${battleId}`;
        } finally {
            setLoadingAction(null);
        }
    }

    const receivedCount = data?.received.length ?? 0;
    const sentCount = data?.sent.length ?? 0;
    const readyCount = data?.readyToWatch.length ?? 0;

    return (
        <div
            className={
                className || "rounded-2xl border border-white/10 bg-black px-4 py-4"
            }
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-white/45">
                        Battles
                    </div>
                    <h2 className="mt-1 text-xl font-semibold text-white">
                        Battle inbox
                    </h2>
                </div>

                <button
                    type="button"
                    onClick={() => loadInbox("refresh")}
                    disabled={refreshing || loading}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {refreshing ? "Refreshing..." : "Refresh"}
                </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => setTab("received")}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition ${tab === "received"
                            ? "bg-white text-black"
                            : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                        }`}
                >
                    Received {receivedCount > 0 ? `(${receivedCount})` : ""}
                </button>

                <button
                    type="button"
                    onClick={() => setTab("sent")}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition ${tab === "sent"
                            ? "bg-white text-black"
                            : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                        }`}
                >
                    Sent {sentCount > 0 ? `(${sentCount})` : ""}
                </button>

                <button
                    type="button"
                    onClick={() => setTab("ready")}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition ${tab === "ready"
                            ? "bg-white text-black"
                            : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                        }`}
                >
                    Ready to watch {readyCount > 0 ? `(${readyCount})` : ""}
                </button>
            </div>

            {error ? (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {error}
                </div>
            ) : null}

            {loading ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-sm text-white/60">
                    Loading battle inbox...
                </div>
            ) : (() => {
                const hasSentUpdates = tab === "sent" && (data?.updates?.length ?? 0) > 0;
                const hasAnyVisibleContent = rows.length > 0 || hasSentUpdates;

                if (!hasAnyVisibleContent) {
                    return (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-sm text-white/60">
                            {sectionEmptyText(tab)}
                        </div>
                    );
                }

                return (
                    <div className="mt-4 space-y-3">
                        {rows.map((challenge) => (
                            <ChallengeRow
                                key={challenge.id}
                                challenge={challenge}
                                mode={tab}
                                loadingAction={loadingAction}
                                onAccept={handleAccept}
                                onReject={handleReject}
                                onCancel={handleCancel}
                                onWatch={handleWatch}
                            />
                        ))}

                        {tab === "sent" && data?.updates?.length ? (
                            <div className="mt-6">
                                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-white/45">
                                    Recent updates
                                </div>

                                <div className="space-y-3">
                                    {data.updates.slice(0, 5).map((challenge) => {
                                        const otherUser = challenge.defender;

                                        return (
                                            <div
                                                key={challenge.id}
                                                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <div className="text-sm font-medium text-white">
                                                            @{otherUser?.username ?? "Unknown user"}
                                                        </div>

                                                        <div className="mt-1 text-sm text-white/60">
                                                            {getUpdateLabel(challenge.status)}
                                                        </div>
                                                    </div>

                                                    <div className="text-xs text-white/40">
                                                        {formatRelativeDate(
                                                            challenge.responded_at ?? challenge.updated_at
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null}
                    </div>
                );
            })()}
        </div>
    );
}