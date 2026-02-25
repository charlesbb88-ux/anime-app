"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/** ✅ tweak this breakpoint if you want */
const PHONE_MAX_WIDTH_PX = 767;

function useIsPhone() {
  const [isPhone, setIsPhone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH_PX}px)`);
    const update = () => setIsPhone(mq.matches);
    update();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    } else {
      mq.addListener(update);
      return () => mq.removeListener(update);
    }
  }, []);

  return isPhone;
}

/** ✅ ONE PLACE to control phone-only styling */
const PHONE = {
  // layout around the button
  wrapAlign: "items-end" as const, // items-start | items-center | items-end
  wrapGap: "gap-1", // space between button + error

  // button sizing
  px: "px-3", // px-2 | px-3 | px-4 | px-5
  py: "py-1", // py-0.5 | py-1 | py-1.5 | py-2
  text: "text-sm", // text-xs | text-sm | text-base
  radius: "rounded-md", // rounded | rounded-md | rounded-lg | rounded-xl

  // optional: enforce a minimum width so it looks consistent
  minw: "", // e.g. "min-w-[92px]" or ""

  // optional: make it taller / centered nicely
  leading: "leading-none", // leading-none | leading-tight | leading-normal

  // colors (you can change these too)
  following:
    "border border-black/40 text-black bg-transparent hover:border-black/70 hover:bg-black/10",
  notFollowing: "bg-black text-white hover:brightness-110 active:brightness-95",

  disabled: "opacity-60 cursor-not-allowed",
};

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

  const isPhone = useIsPhone();

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

  // ✅ phone-only classes (desktop keeps your original look)
  const wrapClass = isPhone ? `flex flex-col ${PHONE.wrapAlign} ${PHONE.wrapGap}` : "flex flex-col items-end gap-1";

  const btnClass = isPhone
    ? [
        PHONE.px,
        PHONE.py,
        PHONE.text,
        PHONE.radius,
        PHONE.minw,
        PHONE.leading,
        "transition",
        disabled ? PHONE.disabled : "",
        isFollowing ? PHONE.following : PHONE.notFollowing,
      ]
        .filter(Boolean)
        .join(" ")
    : [
        "px-3 py-1 text-sm rounded-md transition",
        disabled ? "opacity-60 cursor-not-allowed" : "hover:brightness-110 active:brightness-95",
        isFollowing
          ? "border border-black/40 text-black bg-transparent hover:border-black/70 hover:bg-black/10"
          : "bg-black text-white",
      ].join(" ");

  return (
    <div className={wrapClass}>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={btnClass}
        aria-label={isFollowing ? "Unfollow user" : "Follow user"}
      >
        {label}
      </button>

      {errorMsg ? <div className="text-[12px] text-red-500/90">{errorMsg}</div> : null}
    </div>
  );
}