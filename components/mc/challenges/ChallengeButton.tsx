"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createChallenge,
  getCurrentUserId,
  hasPendingOutgoingChallenge,
} from "@/lib/mcChallenges";
import ChallengeConfirmModal from "@/components/mc/challenges/ChallengeConfirmModal";

type Props = {
  defenderUserId: string;
  defenderUsername: string;
  onCreated?: () => void;
  className?: string;
  disabled?: boolean;
  label?: string;
};

export default function ChallengeButton({
  defenderUserId,
  defenderUsername,
  onCreated,
  className = "",
  disabled = false,
  label = "Challenge",
}: Props) {
  const [open, setOpen] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSelf, setIsSelf] = useState(false);
  const [hasPending, setHasPending] = useState(false);
  const [sent, setSent] = useState(false);

  const buttonDisabled = useMemo(() => {
    return disabled || initializing || loading || isSelf || hasPending || sent;
  }, [disabled, initializing, loading, isSelf, hasPending, sent]);

  useEffect(() => {
    let cancelled = false;

    async function loadState() {
      try {
        setInitializing(true);
        setError(null);

        const currentUserId = await getCurrentUserId();

        if (cancelled) return;

        const selfTarget = currentUserId === defenderUserId;
        setIsSelf(selfTarget);

        if (selfTarget) {
          setHasPending(false);
          setInitializing(false);
          return;
        }

        const pending = await hasPendingOutgoingChallenge(defenderUserId);

        if (cancelled) return;

        setHasPending(pending);
        setInitializing(false);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Failed to load challenge state.");
        setInitializing(false);
      }
    }

    loadState();

    return () => {
      cancelled = true;
    };
  }, [defenderUserId]);

  function handleOpen() {
    setError(null);

    if (buttonDisabled) {
      return;
    }

    setOpen(true);
  }

  async function handleConfirm() {
    setLoading(true);
    setError(null);

    try {
      await createChallenge(defenderUserId);
      setSent(true);
      setHasPending(true);
      setOpen(false);
      onCreated?.();
    } catch (e: any) {
      setError(e?.message ?? "Failed to send challenge.");
    } finally {
      setLoading(false);
    }
  }

  function getButtonText() {
    if (initializing) return "Loading...";
    if (isSelf) return "Cannot challenge yourself";
    if (sent || hasPending) return "Challenge pending";
    return label;
  }

  return (
    <>
      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={handleOpen}
          disabled={buttonDisabled}
          className={
            className ||
            "rounded-xl border border-white/10 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
          }
        >
          {getButtonText()}
        </button>

        {error && !open ? (
          <div className="text-sm text-red-300">{error}</div>
        ) : null}
      </div>

      <ChallengeConfirmModal
        open={open}
        loading={loading}
        targetUsername={defenderUsername}
        error={error}
        onConfirm={handleConfirm}
        onClose={() => {
          if (loading) return;
          setOpen(false);
        }}
      />
    </>
  );
}