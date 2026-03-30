"use client";

import React, { useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

export type ProfileTab =
  | "posts"
  | "watchlist"
  | "activity"
  | "journal"
  | "library"
  | "completions"
  | "mc"
  | "battles";

type Props = {
  username: string;
  activeTab?: ProfileTab;
  className?: string;
  variant?: "plain" | "card";
  center?: boolean;
};

export default function ProfileTabsRow({
  username,
  activeTab,
  className = "",
  variant = "plain",
}: Props) {
  const router = useRouter();
  const baseProfilePath = `/${username}`;
  const navRef = useRef<HTMLElement | null>(null);

  const dragStateRef = useRef({
    isPointerDown: false,
    startX: 0,
    startScrollLeft: 0,
    didDrag: false,
  });

  function isPathActive(path: string) {
    return router.asPath === path || router.asPath.startsWith(`${path}/`);
  }

  const computedActive: ProfileTab = useMemo(() => {
    if (activeTab) return activeTab;
    if (isPathActive(`${baseProfilePath}/mc`)) return "mc";
    if (isPathActive(`${baseProfilePath}/battles`)) return "battles";
    if (isPathActive(`${baseProfilePath}/completions`)) return "completions";
    if (isPathActive(`${baseProfilePath}/watchlist`)) return "watchlist";
    if (isPathActive(`${baseProfilePath}/activity`)) return "activity";
    if (isPathActive(`${baseProfilePath}/journal`)) return "journal";
    if (isPathActive(`${baseProfilePath}/library`)) return "library";
    return "posts";
  }, [activeTab, router.asPath, baseProfilePath]);

  function tabClass(isActive: boolean) {
    return [
      "inline-flex shrink-0 items-center",
      "text-[14px] leading-3 font-semibold tracking-wide",
      "select-none",
      isActive
        ? "border-b-2 border-black text-black"
        : "text-slate-500 hover:text-slate-800",
    ].join(" ");
  }

  const navClass = [
    variant === "card"
      ? "bg-white border-t-2 border-b-0 border-black md:border-3 md:border-black md:rounded-sm"
      : "",
    variant === "card" ? "px-4" : "",
    variant === "card" ? "" : "border-b border-slate-200",
    "min-w-0 w-full",
    "overflow-x-auto overflow-y-visible whitespace-nowrap",
    "[-webkit-overflow-scrolling:touch]",
    "scrollbar-hide",
    "py-1",
    "cursor-grab active:cursor-grabbing",
    "select-none",
  ]
    .filter(Boolean)
    .join(" ");

  const innerClass = "flex w-max min-w-max gap-6";

  function handlePointerDown(e: React.PointerEvent<HTMLElement>) {
    const el = navRef.current;
    if (!el) return;

    dragStateRef.current.isPointerDown = true;
    dragStateRef.current.startX = e.clientX;
    dragStateRef.current.startScrollLeft = el.scrollLeft;
    dragStateRef.current.didDrag = false;
  }

  function handlePointerMove(e: React.PointerEvent<HTMLElement>) {
    const el = navRef.current;
    const drag = dragStateRef.current;
    if (!el || !drag.isPointerDown) return;

    const dx = e.clientX - drag.startX;

    if (Math.abs(dx) > 6) {
      drag.didDrag = true;
    }

    if (drag.didDrag) {
      el.scrollLeft = drag.startScrollLeft - dx;
    }
  }

  function handlePointerUp() {
    dragStateRef.current.isPointerDown = false;
    setTimeout(() => {
      dragStateRef.current.didDrag = false;
    }, 0);
  }

  function handlePointerLeave() {
    dragStateRef.current.isPointerDown = false;
  }

  function handleClickCapture(e: React.MouseEvent<HTMLElement>) {
    if (!dragStateRef.current.didDrag) return;
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragStart(e: React.DragEvent<HTMLElement>) {
    e.preventDefault();
  }

  function Tab({
    href,
    active,
    label,
  }: {
    href: string;
    active: boolean;
    label: string;
  }) {
    return (
      <Link
        href={href}
        className={tabClass(active)}
        draggable={false}
      >
        <span className="block px-3 py-2 -mx-3 -my-2">
          {label}
        </span>
      </Link>
    );
  }

  return (
    <div className={`w-full min-w-0 ${className}`}>
      <nav
        ref={navRef}
        className={navClass}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onClickCapture={handleClickCapture}
        onDragStart={handleDragStart}
      >
        <div className={innerClass}>
          <Tab href={baseProfilePath} active={computedActive === "posts"} label="Posts" />
          <Tab href={`${baseProfilePath}/mc`} active={computedActive === "mc"} label="MC" />
          <Tab href={`${baseProfilePath}/battles`} active={computedActive === "battles"} label="Battles" />
          <Tab href={`${baseProfilePath}/completions`} active={computedActive === "completions"} label="Completions" />
          <Tab href={`${baseProfilePath}/watchlist`} active={computedActive === "watchlist"} label="Watchlist" />
          <Tab href={`${baseProfilePath}/activity`} active={computedActive === "activity"} label="Activity" />
          <Tab href={`${baseProfilePath}/journal`} active={computedActive === "journal"} label="Journal" />
          <Tab href={`${baseProfilePath}/library`} active={computedActive === "library"} label="My Library" />
        </div>
      </nav>
    </div>
  );
}