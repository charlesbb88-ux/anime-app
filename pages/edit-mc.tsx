"use client";

import McPaperDollPreview from "@/components/mc/paperdoll/McPaperDollPreview";
import McPaperDollOptionSelector from "@/components/mc/paperdoll/McPaperDollOptionSelector";
import { useMcPaperDollEditor } from "@/components/mc/paperdoll/useMcPaperDollEditor";
import {
  MC_BODY_OPTIONS,
  MC_HAIR_OPTIONS,
  MC_LOCKED_HAIR_OPTIONS,
  MC_LOCKED_TORSO_OPTIONS,
  MC_LOCKED_BOTTOMS_OPTIONS,
} from "@/components/mc/paperdoll/mcPaperDollCatalog";

export default function EditMcPage() {
  const {
    loading,
    saving,
    error,
    draftLoadout,
    unlockedItems,
    canSave,
    setBody,
    setHair,
    setTorso,
    setBottoms,
    reset,
    save,
  } = useMcPaperDollEditor();

  const unlockedHairIds = new Set(
    unlockedItems
      .filter((item) => item.slot === "hair")
      .map((item) => item.item_id)
  );

  const unlockedTorsoIds = new Set(
    unlockedItems
      .filter((item) => item.slot === "torso")
      .map((item) => item.item_id)
  );

  const unlockedBottomsIds = new Set(
    unlockedItems
      .filter((item) => item.slot === "bottoms")
      .map((item) => item.item_id)
  );

  const availableHairOptions = [
    ...MC_HAIR_OPTIONS,
    ...MC_LOCKED_HAIR_OPTIONS.filter((option) =>
      unlockedHairIds.has(option.id)
    ),
  ];

  const availableTorsoOptions = MC_LOCKED_TORSO_OPTIONS.filter((option) =>
    unlockedTorsoIds.has(option.id)
  );

  const availableBottomsOptions =
    MC_LOCKED_BOTTOMS_OPTIONS.filter((option) =>
      unlockedBottomsIds.has(option.id)
    );

  const showTorsoSelector = availableTorsoOptions.length > 0;

  const showBottomsSelector = availableBottomsOptions.length > 0;

  return (
    <div className="min-h-screen px-4 py-8 text-black">
      <div className="mx-auto max-w-6xl">
        {error ? (
          <div className="mb-4 rounded-2xl border border-black bg-white px-4 py-3 text-sm text-black">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-black bg-white/20 p-6 text-black/70">
            Loading MC character...
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
            <McPaperDollPreview loadout={draftLoadout} />

            <div className="space-y-4">
              <McPaperDollOptionSelector
                title="Skin Color"
                options={MC_BODY_OPTIONS}
                selectedId={draftLoadout.body}
                onSelect={(id) => {
                  if (!id) return;
                  setBody(id);
                }}
              />

              <McPaperDollOptionSelector
                title="Hair"
                options={availableHairOptions}
                selectedId={draftLoadout.hair}
                onSelect={setHair}
                allowNone
                noneLabel="Bald"
              />

              {showTorsoSelector ? (
                <McPaperDollOptionSelector
                  title="Shirt"
                  options={availableTorsoOptions}
                  selectedId={draftLoadout.torso}
                  onSelect={setTorso}
                  allowNone
                  noneLabel="No Shirt"
                />
              ) : null}

              {showBottomsSelector ? (
                <McPaperDollOptionSelector
                  title="Pants"
                  options={availableBottomsOptions}
                  selectedId={draftLoadout.bottoms}
                  onSelect={setBottoms}
                  allowNone
                  noneLabel="No Pants"
                />
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={save}
                  disabled={!canSave}
                  className={[
                    "rounded-xl px-4 py-2 text-sm font-medium transition",
                    canSave
                      ? "border border-black bg-black text-white hover:bg-black/85"
                      : "cursor-not-allowed border border-black bg-white/20 text-black/40",
                  ].join(" ")}
                >
                  {saving ? "Saving..." : "Save MC"}
                </button>

                <button
                  type="button"
                  onClick={reset}
                  disabled={saving}
                  className="rounded-xl border border-black bg-white/20 px-4 py-2 text-sm text-black hover:bg-black/5 disabled:opacity-50"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}