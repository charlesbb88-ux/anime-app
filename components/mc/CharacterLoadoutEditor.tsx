"use client";

import type { CharacterLoadoutOptionGroup } from "@/components/mc/avatarTypes";

type Props = {
  groups: CharacterLoadoutOptionGroup[];
  savingSlotKey?: string | null;
  onEquip: (slotKey: string, assetId: number) => void;
};

export default function CharacterLoadoutEditor({
  groups,
  savingSlotKey,
  onEquip,
}: Props) {
  if (groups.length === 0) return null;

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-4">
        <div className="text-sm font-semibold text-white">Loadout Editor</div>
        <div className="mt-1 text-xs text-white/50">
          Temporary slot switcher for testing owned and equipped assets.
        </div>
      </div>

      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.slotKey}>
            <div className="mb-2 text-xs uppercase tracking-[0.18em] text-white/45">
              {group.slotLabel}
            </div>

            <div className="flex flex-wrap gap-2">
              {group.options.map((option) => {
                const isSaving = savingSlotKey === group.slotKey;
                const isEquipped = option.isEquipped;

                return (
                  <button
                    key={option.assetId}
                    type="button"
                    onClick={() => onEquip(group.slotKey, option.assetId)}
                    disabled={isSaving || isEquipped}
                    className={[
                      "rounded-xl border px-3 py-2 text-sm transition",
                      isEquipped
                        ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                        : "border-white/10 bg-black/20 text-white/80 hover:border-white/20 hover:bg-white/10",
                      isSaving ? "opacity-60" : "",
                    ].join(" ")}
                  >
                    {option.displayName}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}