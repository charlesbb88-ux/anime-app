"use client";

import { useEffect, useMemo, useState } from "react";
import type { McPaperDollLoadout } from "@/components/mc/paperdoll/mcPaperDollTypes";
import {
  DEFAULT_MC_PAPERDOLL_LOADOUT,
} from "@/components/mc/paperdoll/mcPaperDollCatalog";
import {
  getOrCreateMyMcPaperDollLoadout,
  saveMyMcPaperDollLoadout,
} from "@/lib/mcPaperDollLoadoutService";

function sameLoadout(a: McPaperDollLoadout | null, b: McPaperDollLoadout | null) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useMcPaperDollEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [savedLoadout, setSavedLoadout] = useState<McPaperDollLoadout | null>(null);
  const [draftLoadout, setDraftLoadout] = useState<McPaperDollLoadout>(
    DEFAULT_MC_PAPERDOLL_LOADOUT
  );

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError(null);

        const loadout = await getOrCreateMyMcPaperDollLoadout();

        if (cancelled) return;

        setSavedLoadout(loadout);
        setDraftLoadout(loadout);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message ?? "Failed to load MC character.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  const canSave = useMemo(() => {
    return !saving && !sameLoadout(savedLoadout, draftLoadout);
  }, [saving, savedLoadout, draftLoadout]);

function setBody(bodyId: string | null) {
    setDraftLoadout((prev) => ({
      ...prev,
      body: bodyId,
    }));
  }

  function setHair(hairId: string | null) {
    setDraftLoadout((prev) => ({
      ...prev,
      hair: hairId,
    }));
  }

  function reset() {
    if (!savedLoadout) return;
    setDraftLoadout(savedLoadout);
    setError(null);
  }

  async function save() {
    try {
      setSaving(true);
      setError(null);

      const next = await saveMyMcPaperDollLoadout(draftLoadout);
      setSavedLoadout(next);
      setDraftLoadout(next);
    } catch (err: any) {
      setError(err?.message ?? "Failed to save MC character.");
    } finally {
      setSaving(false);
    }
  }

  return {
    loading,
    saving,
    error,
    draftLoadout,
    canSave,
    setBody,
    setHair,
    reset,
    save,
  };
}