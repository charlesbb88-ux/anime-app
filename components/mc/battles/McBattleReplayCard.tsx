"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import type { McBattleCardRow } from "@/components/mc/battles/mcBattleTypes";
import McBattleReplayStage from "@/components/mc/battles/McBattleReplayStage";
import {
  useMcBattleUserMetaMap,
  type McBattleUserMetaMap,
} from "@/hooks/useMcBattleUserMetaMap";

type Props = {
  battle: McBattleCardRow;
  title?: string;
  compact?: boolean;
  isActive?: boolean;
  fighterMetaMap?: McBattleUserMetaMap;
};

function FighterDetailsBlock({
  align,
  username,
  avatarUrl,
  wins,
  losses,
  level,
  xp,
  title,
}: {
  align: "left" | "right";
  username: string;
  avatarUrl: string | null;
  wins: number;
  losses: number;
  level: number;
  xp: number;
  title: string;
}) {
  const isRight = align === "right";
  const href = `/${username}`;

  return (
    <a
      href={href}
      className={`flex items-start gap-2 rounded-md p-1 transition hover:bg-black/5 ${isRight ? "justify-end" : "justify-start"
        }`}
    >
      {!isRight && (
        <div className="h-18 w-18 shrink-0 overflow-hidden rounded-full border border-black bg-black/5">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={username}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-black/60">
              {username.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
      )}

      <div className={isRight ? "text-right" : "text-left"}>
        <div className="text-lg font-medium text-black">{username}</div>
        <div className="text-sm text-black/60">{title}</div>
        <div className="text-sm">
          <span className="text-green-500">{wins}W</span>
          <span className="mx-1 text-black/30">•</span>
          <span className="text-red-500">{losses}L</span>
        </div>
        <div className="text-sm text-black/60">
          Lvl {level} • {xp} XP
        </div>
      </div>

      {isRight && (
        <div className="h-18 w-18 shrink-0 overflow-hidden rounded-full border border-black bg-black/5">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={username}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-black/60">
              {username.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
      )}
    </a>
  );
}

export default function McBattleReplayCard({
  battle,
  compact = false,
  isActive = true,
  fighterMetaMap,
}: Props) {
  const [replayNonce, setReplayNonce] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // ✅ CLOSE ON OUTSIDE CLICK
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!dropdownRef.current) return;

      if (!dropdownRef.current.contains(event.target as Node)) {
        setDetailsOpen(false);
      }
    }

    if (detailsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [detailsOpen]);

  const challengerId = battle.challenger_user_id;
  const defenderId = battle.defender_user_id;

  const fallbackNames = useMemo(
    () => ({
      challenger: battle.challenger_snapshot?.username ?? "Challenger",
      defender: battle.defender_snapshot?.username ?? "Defender",
    }),
    [battle]
  );

  const shouldUseFallbackHook = !fighterMetaMap;

  const { metaMap: localMetaMap } = useMcBattleUserMetaMap(
    shouldUseFallbackHook ? [challengerId, defenderId] : []
  );

  const resolvedMetaMap = fighterMetaMap ?? localMetaMap;

  const challengerMeta = resolvedMetaMap[challengerId];
  const defenderMeta = resolvedMetaMap[defenderId];

  const challengerName = challengerMeta?.username ?? fallbackNames.challenger;
  const defenderName = defenderMeta?.username ?? fallbackNames.defender;

  return (
    <div
      ref={dropdownRef}
      className="min-w-0 overflow-hidden rounded-sm border border-black bg-white p-1"
    >
      <McBattleReplayStage
        battle={battle}
        isActive={isActive}
        replayNonce={replayNonce}
      />

      {/* minimalist toggle */}
      <div className="mt-2">
        <button
          type="button"
          onClick={() => setDetailsOpen((prev) => !prev)}
          className="flex w-full items-center justify-center gap-1 pb-1 text-sm text-black transition hover:text-black"
        >
          <span>Details</span>

          <span
            className={`transition-transform duration-200 ${detailsOpen ? "rotate-180" : ""
              }`}
          >
            ▾
          </span>
        </button>

        {detailsOpen && (
          <div className="mt-2 grid grid-cols-2 gap-3">
            <FighterDetailsBlock
              align="left"
              username={challengerName}
              avatarUrl={challengerMeta?.avatarUrl ?? null}
              wins={challengerMeta?.wins ?? 0}
              losses={challengerMeta?.losses ?? 0}
              level={challengerMeta?.level ?? 1}
              xp={challengerMeta?.xp ?? 0}
              title={challengerMeta?.title ?? "Unranked Wanderer"}
            />

            <FighterDetailsBlock
              align="right"
              username={defenderName}
              avatarUrl={defenderMeta?.avatarUrl ?? null}
              wins={defenderMeta?.wins ?? 0}
              losses={defenderMeta?.losses ?? 0}
              level={defenderMeta?.level ?? 1}
              xp={defenderMeta?.xp ?? 0}
              title={defenderMeta?.title ?? "Unranked Wanderer"}
            />
          </div>
        )}
      </div>
    </div>
  );
}