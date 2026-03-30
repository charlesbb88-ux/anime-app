"use client";

import { useMemo, useState } from "react";
import { createChallenge, getCurrentUserId } from "@/lib/mcChallenges";
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
  const [checkingSelf, setCheckingSelf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSelf, setIsSelf] = useState(false);
  const [sent, setSent] = useState(false);

  const buttonDisabled = useMemo(() => {
    return disabled || loading || checkingSelf || isSelf || sent;
  }, [disabled, loading, checkingSelf, isSelf, sent]);

  async function handleOpen() {
    setError(null);
    setCheckingSelf(true);

    try {
      const currentUserId = await getCurrentUserId();
      const selfTarget = currentUserId === defenderUserId;
      setIsSelf(selfTarget);

      if (selfTarget) {
        setError("You cannot challenge yourself.");
        return;
      }

      setOpen(true);
    } catch (e: any) {
      setError(e?.message ?? "Failed to check current user.");
    } finally {
      setCheckingSelf(false);
    }
  }

  async function handleConfirm() {
    setLoading(true);
    setError(null);

    try {
      await createChallenge(defenderUserId);
      setSent(true);
      setOpen(false);
      onCreated?.();
    } catch (e: any) {
      setError(e?.message ?? "Failed to send challenge.");
    } finally {
      setLoading(false);
    }
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
          {checkingSelf
            ? "Checking..."
            : sent
              ? "Challenge sent"
              : isSelf
                ? "Cannot challenge yourself"
                : label}
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