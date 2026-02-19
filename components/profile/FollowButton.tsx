"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  viewerUserId: string | null;
  profileId: string;
  isOwner: boolean;
};

export default function FollowButton({ viewerUserId, profileId, isOwner }: Props) {
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canShow = useMemo(() => !isOwner, [isOwner]);
  const canUse = useMemo(
    () => !!viewerUserId && !!profileId && !isOwner,
    [viewerUserId, profileId, isOwner]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setErrorMsg(null);

      if (!canShow || !viewerUserId) {
        setLoading(false);
        setIsFollowing(false);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from("user_follows")
        .select("follower_id")
        .eq("follower_id", viewerUserId)
        .eq("following_id", profileId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setErrorMsg("Couldn’t load follow state.");
        setIsFollowing(false);
      } else {
        setIsFollowing(!!data);
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [viewerUserId, profileId, canShow]);

  async function onToggle() {
    setErrorMsg(null);
    if (!canUse || working) return;

    setWorking(true);

    if (!isFollowing) {
      const { error } = await supabase.from("user_follows").insert({
        follower_id: viewerUserId,
        following_id: profileId,
      });

      if (error && (error as any)?.code !== "23505") {
        setErrorMsg("Follow failed. Try again.");
      } else {
        setIsFollowing(true);
      }
    } else {
      const { error } = await supabase
        .from("user_follows")
        .delete()
        .eq("follower_id", viewerUserId)
        .eq("following_id", profileId);

      if (error) setErrorMsg("Unfollow failed. Try again.");
      else setIsFollowing(false);
    }

    setWorking(false);
  }

  if (!canShow) return null;

  const disabled = loading || working || !viewerUserId;

  const label = !viewerUserId
    ? "Follow"
    : loading
    ? "…"
    : isFollowing
    ? "Following"
    : "Follow";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={[
          "px-3 py-1 text-sm rounded-md transition",
          disabled
            ? "opacity-60 cursor-not-allowed"
            : "hover:brightness-110 active:brightness-95",

          // 🔁 INVERTED COLORS
          isFollowing
            ? "border border-black/40 text-black bg-transparent hover:border-black/70 hover:bg-black/10"
            : "bg-black text-white",
        ].join(" ")}
        aria-label={isFollowing ? "Unfollow user" : "Follow user"}
      >
        {label}
      </button>

      {errorMsg ? (
        <div className="text-[12px] text-red-500/90">{errorMsg}</div>
      ) : null}
    </div>
  );
}