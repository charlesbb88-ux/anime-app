"use client";

import { useMemo, useState } from "react";
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

function FighterHeaderBlock({
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
      className={`flex items-start gap-2 rounded-md p-1 transition hover:bg-black/5 ${
        isRight ? "justify-end" : "justify-start"
      }`}
    >
      {!isRight && (
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-black bg-black/5">
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
        <div className="text-sm font-semibold leading-tight text-black">
          {username}
        </div>

        <div className="mt-0.5 text-xs leading-tight text-black/70">
          {wins}-{losses}
        </div>

        <div className="mt-0.5 text-xs leading-tight text-black/70">
          Level {level} • XP {xp}
        </div>

        <div className="mt-0.5 text-xs leading-tight text-black/55">
          {title}
        </div>
      </div>

      {isRight && (
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-black bg-black/5">
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
  title,
  compact = false,
  isActive = true,
  fighterMetaMap,
}: Props) {
  const [replayNonce, setReplayNonce] = useState(0);

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
    <div className="min-w-0 overflow-hidden rounded-sm border border-black bg-white p-1">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-black">
            {title ?? `${challengerName} vs ${defenderName}`}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setReplayNonce((prev) => prev + 1);
          }}
          className="rounded-xl border border-black/10 bg-white px-2 py-1 text-xs text-black hover:bg-black/5"
        >
          Replay
        </button>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <FighterHeaderBlock
          align="left"
          username={challengerName}
          avatarUrl={challengerMeta?.avatarUrl ?? null}
          wins={challengerMeta?.wins ?? 0}
          losses={challengerMeta?.losses ?? 0}
          level={challengerMeta?.level ?? 1}
          xp={challengerMeta?.xp ?? 0}
          title={challengerMeta?.title ?? "Unranked Wanderer"}
        />

        <FighterHeaderBlock
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

      <McBattleReplayStage
        battle={battle}
        isActive={isActive}
        replayNonce={replayNonce}
      />
    </div>
  );
}