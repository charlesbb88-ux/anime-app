"use client";

import McBattleReplayCard from "@/components/mc/battles/McBattleReplayCard";
import type { McBattleCardRow } from "@/components/mc/battles/mcBattleTypes";

type Props = {
  battle: McBattleCardRow;
  isActive: boolean;
  onNodeChange?: (battleId: string, node: HTMLDivElement | null) => void;
};

export default function McBattleFeedItem({
  battle,
  isActive,
  onNodeChange,
}: Props) {
  return (
    <div
      ref={(node) => {
        onNodeChange?.(battle.id, node);
      }}
      className="min-w-0 w-full"
    >
      <McBattleReplayCard battle={battle} isActive={isActive} />
    </div>
  );
}