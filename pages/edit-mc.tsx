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
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold">Edit MC</h1>
          <p className="mt-2 text-sm text-white/60">
            Customize your paper-doll character. This page is built around the
            new sprite-layer system.
          </p>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
            Loading MC character...
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
            <McPaperDollPreview loadout={draftLoadout} />

            <div className="space-y-4">
              <McPaperDollOptionSelector
                title="Skin Color"
                options={MC_BODY_OPTIONS}
                selectedId={draftLoadout.body ?? "default"}
                onSelect={(id) => {
                  if (id === "default") {
                    setBody(null);
                    return;
                  }

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

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 text-sm font-semibold text-white">
                  Actions
                </div>
                <div className="text-sm text-white/60">
                  More slots can be added later without changing this page
                  structure. Body and hair are wired first.
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={save}
                  disabled={!canSave}
                  className={[
                    "rounded-xl px-4 py-2 text-sm font-medium transition",
                    canSave
                      ? "bg-cyan-500 text-black hover:bg-cyan-400"
                      : "cursor-not-allowed bg-white/10 text-white/40",
                  ].join(" ")}
                >
                  {saving ? "Saving..." : "Save MC"}
                </button>

                <button
                  type="button"
                  onClick={reset}
                  disabled={saving}
                  className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15 disabled:opacity-50"
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