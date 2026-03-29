"use client";

import McBattleReplayCard from "@/components/mc/battles/McBattleReplayCard";
import type { McBattleCardRow } from "@/components/mc/battles/mcBattleTypes";

type Props = {
    battle: McBattleCardRow;
    isActive: boolean;
    registerNode?: (node: HTMLDivElement | null) => void;
};

export default function McBattleFeedItem({
    battle,
    isActive,
    registerNode,
}: Props) {
    return (
        <div ref={registerNode} className="min-w-0 w-full">
            <McBattleReplayCard battle={battle} isActive={isActive} />
        </div>
    );
}