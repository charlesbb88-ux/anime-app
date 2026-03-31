"use client";

import { useMemo, useState } from "react";
import ScreenSpriteFighter, {
  type DotAction,
} from "@/components/mc/ScreenSpriteFighter";
import { buildMcPaperDollLayers } from "@/components/mc/paperdoll/buildMcPaperDollLayers";
import { MC_PAPERDOLL_CATALOG } from "@/components/mc/paperdoll/mcPaperDollCatalog";
import type { McPaperDollLoadout } from "@/components/mc/paperdoll/mcPaperDollTypes";
import { resolveMcPaperDollDefinition } from "@/components/mc/paperdoll/buildMcPaperDollLayers";

const ACTIONS: DotAction[] = [
  "idle",
  "run",
  "jump",
  "attack",
  "hit",
  "recover",
  "defeat_fall",
  "defeat_ground",
];

type Props = {
  loadout: McPaperDollLoadout;
};

export default function McPaperDollPreview({ loadout }: Props) {
  const [action, setAction] = useState<DotAction>("idle");

  const layers = useMemo(() => {
    const definition = resolveMcPaperDollDefinition(MC_PAPERDOLL_CATALOG, loadout);
    return buildMcPaperDollLayers(definition);
  }, [loadout]);

  return (
    <div className="rounded-2xl border border-black border-2 bg-white p-4">

      {/* HIDDEN FOR NOW */}
      {false && (
        <div className="mb-4 flex flex-wrap gap-2">
          {ACTIONS.map((nextAction) => {
            const selected = action === nextAction;

            return (
              <button
                key={nextAction}
                type="button"
                onClick={() => setAction(nextAction)}
                className={[
                  "rounded-xl border px-3 py-2 text-xs transition",
                  selected
                    ? "border-black bg-black text-white"
                    : "border-black bg-white/20 text-black/80 hover:bg-black/5",
                ].join(" ")}
              >
                {nextAction}
              </button>
            );
          })}
        </div>
      )}

      <div
        className="relative mx-auto overflow-hidden rounded-2xl bg-white"
        style={{ width: 360, height: 520 }}
      >
        <ScreenSpriteFighter
          screenX={180}
          screenY={480}
          facing="right"
          action={action}
          layers={layers}
          sourceFrameWidth={768}
          sourceFrameHeight={1024}
          renderWidth={360}
          renderHeight={480}
          yOffset={action === "defeat_ground" ? 28 : 8}
          flash={false}
        />
      </div>
    </div>
  );
}