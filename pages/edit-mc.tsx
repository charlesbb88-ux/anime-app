"use client";

import McPaperDollPreview from "@/components/mc/paperdoll/McPaperDollPreview";
import McPaperDollOptionSelector from "@/components/mc/paperdoll/McPaperDollOptionSelector";
import { useMcPaperDollEditor } from "@/components/mc/paperdoll/useMcPaperDollEditor";
import {
  MC_BODY_OPTIONS,
  MC_HAIR_OPTIONS,
} from "@/components/mc/paperdoll/mcPaperDollCatalog";

export default function EditMcPage() {
  const {
    loading,
    saving,
    error,
    draftLoadout,
    canSave,
    setBody,
    setHair,
    reset,
    save,
  } = useMcPaperDollEditor();

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
                options={MC_HAIR_OPTIONS}
                selectedId={draftLoadout.hair}
                onSelect={setHair}
                allowNone
                noneLabel="Bald"
              />

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