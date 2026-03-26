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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 text-sm font-semibold text-white">Preview</div>

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
                  ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                  : "border-white/10 bg-black/20 text-white/80 hover:border-white/20 hover:bg-white/10",
              ].join(" ")}
            >
              {nextAction}
            </button>
          );
        })}
      </div>

      <div
        className="relative mx-auto overflow-hidden rounded-2xl border border-white/10 bg-[#0f0f0f]"
        style={{ width: 420, height: 320 }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'url("/mc/backgrounds/arena-bg.png")',
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            opacity: 0.7,
          }}
        />

        <div
          className="absolute left-0 right-0"
          style={{
            bottom: -185,
            height: 320,
            backgroundImage: 'url("/mc/backgrounds/arena-platform.png")',
            backgroundSize: "100% 100%",
            backgroundPosition: "center bottom",
            backgroundRepeat: "no-repeat",
          }}
        />

        <ScreenSpriteFighter
          screenX={210}
          screenY={300}
          facing="right"
          action={action}
          layers={layers}
          sourceFrameWidth={768}
          sourceFrameHeight={1024}
          renderWidth={130}
          renderHeight={173}
          yOffset={action === "defeat_ground" ? 28 : 8}
          flash={false}
        />
      </div>
    </div>
  );
}