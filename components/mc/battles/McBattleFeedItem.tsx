"use client";

import McBattleReplayCard from "@/components/mc/battles/McBattleReplayCard";
import type { McBattleCardRow } from "@/components/mc/battles/mcBattleTypes";
import type { McBattleUserMetaMap } from "@/hooks/useMcBattleUserMetaMap";

type Props = {
  battle: McBattleCardRow;
  isActive: boolean;
  onNodeChange?: (battleId: string, node: HTMLDivElement | null) => void;
  onSelect?: (battleId: string) => void;
  fighterMetaMap?: McBattleUserMetaMap;
};

function shouldIgnoreFeedSelect(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;

  return Boolean(
    target.closest(
      'a, button, input, textarea, select, label, summary, [role="button"], [data-no-feed-select="true"]'
    )
  );
}

export default function McBattleFeedItem({
  battle,
  isActive,
  onNodeChange,
  onSelect,
  fighterMetaMap,
}: Props) {
  return (
    <div
      ref={(node) => {
        onNodeChange?.(battle.id, node);
      }}
      className="min-w-0 w-full"
      onClick={(event) => {
        if (shouldIgnoreFeedSelect(event.target)) return;
        onSelect?.(battle.id);
      }}
    >
      <McBattleReplayCard
        battle={battle}
        isActive={isActive}
        fighterMetaMap={fighterMetaMap}
      />
    </div>
  );
}