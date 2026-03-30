"use client";

import McBattleReplayCard from "@/components/mc/battles/McBattleReplayCard";
import type { McBattleCardRow } from "@/components/mc/battles/mcBattleTypes";
import type { McBattleUserMetaMap } from "@/hooks/useMcBattleUserMetaMap";

type Props = {
  battle: McBattleCardRow;
  isActive: boolean;
  onNodeChange?: (battleId: string, node: HTMLDivElement | null) => void;
  fighterMetaMap?: McBattleUserMetaMap;
};

export default function McBattleFeedItem({
  battle,
  isActive,
  onNodeChange,
  fighterMetaMap,
}: Props) {
  return (
    <div
      ref={(node) => {
        onNodeChange?.(battle.id, node);
      }}
      className="min-w-0 w-full"
    >
      <McBattleReplayCard
        battle={battle}
        isActive={isActive}
        fighterMetaMap={fighterMetaMap}
      />
    </div>
  );
}