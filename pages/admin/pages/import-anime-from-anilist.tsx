"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";

type ImportResponse =
    | {
        success: true;
        anime?: any;
        manual_total_episodes_used?: number | null;
        anilist_total_episodes_seen?: number | null;
        previous_total_episodes_seen?: number | null;
        final_total_episodes_used?: number | null;
        duration_ms?: number;
    }
    | {
        success: false;
        error?: string;
        details?: any;
    };

type CharacterImportResponse =
    | {
        ok: true;
        mode: "single";
        anime?: {
            id: string;
            anilist_id: number | null;
            title: string | null;
        };
        imported?: {
            characters: number;
            joins: number;
        };
    }
    | {
        error?: string;
        raw?: string;
    };

type TmdbImportResponse =
    | {
        ok: true;
        anime?: {
            id: string;
            anilist_id: number | null;
            tmdb_id: number | null;
            title: string | null;
        };
        tmdb?: {
            seriesArtworkInserted: number;
            episodeMappingsAdded: number;
            episodeMappingSkippedReason: string | null;
            episodeMappingLocalUnmappedCount?: number;
            episodeMappingTmdbFlatCount?: number;
            episodeMappingPartiallyMapped?: boolean;
            episodeDetailsUpdated: number;
            episodeDetailsSkippedUnmappable: number;
            episodeStillsInserted: number;
            episodeStillsSkippedUnmappable: number;
        };
    }
    | {
        ok: false;
        error?: string;
        raw?: string;
    };

type SavedGroupListItem = {
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
    item_count: number;
};

type SavedGroupDetailItem = {
    id: string;
    group_id: string;
    order_index: number;
    anilist_id: number;
    tmdb_id: number | null;
    manual_total_episodes: number | null;
    import_characters: boolean;
    title_snapshot: string | null;
    created_at: string;
    updated_at: string;
};

type RowState = {
    localId: string;
    anilistId: string;
    tmdbId: string;
    manualTotalEpisodes: string;
    importCharactersToo: boolean;
    savedTitleSnapshot: string | null;

    status: "idle" | "running" | "success" | "error";
    step: string | null;
    error: string | null;

    animeResult: ImportResponse | null;
    characterResult: CharacterImportResponse | null;
    tmdbResult: TmdbImportResponse | null;

    showRaw: boolean;
};

function makeRow(partial?: Partial<RowState>): RowState {
    return {
        localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        anilistId: "",
        tmdbId: "",
        manualTotalEpisodes: "",
        importCharactersToo: true,
        savedTitleSnapshot: null,
        status: "idle",
        step: null,
        error: null,
        animeResult: null,
        characterResult: null,
        tmdbResult: null,
        showRaw: false,
        ...partial,
    };
}

function fmtAgo(iso: string) {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return iso;
    const d = Date.now() - t;
    const s = Math.floor(d / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 48) return `${h}h ago`;
    const days = Math.floor(h / 24);
    return `${days}d ago`;
}

function rowDisplayTitle(row: RowState) {
    if (row.animeResult && row.animeResult.success === true && row.animeResult.anime) {
        return (
            row.animeResult.anime.title_english ||
            row.animeResult.anime.title ||
            row.savedTitleSnapshot ||
            null
        );
    }

    return row.savedTitleSnapshot || null;
}

async function runAnimeImport(
    anilistId: number,
    adminSecret: string,
    manualTotalEpisodes: number | null
) {
    const r = await fetch("/api/admin/import-anime-from-anilist", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-admin-secret": adminSecret,
            accept: "application/json",
        },
        body: JSON.stringify({
            anilistId,
            manualTotalEpisodes,
        }),
    });

    const text = await r.text();
    let payload: ImportResponse | { raw: string };

    try {
        payload = JSON.parse(text);
    } catch {
        payload = { raw: text?.slice(0, 4000) };
    }

    if (!r.ok) {
        throw new Error((payload as any)?.error || (payload as any)?.raw || `HTTP ${r.status}`);
    }

    return payload as ImportResponse;
}

async function runCharacterImport(anilistId: number, adminSecret: string) {
    const r = await fetch(
        `/api/admin/import-anilist-characters?media_id=${encodeURIComponent(String(anilistId))}`,
        {
            method: "GET",
            headers: {
                "x-admin-secret": adminSecret,
                accept: "application/json",
            },
        }
    );

    const text = await r.text();
    let payload: CharacterImportResponse | { raw: string };

    try {
        payload = JSON.parse(text);
    } catch {
        payload = { raw: text?.slice(0, 4000) };
    }

    if (!r.ok) {
        throw new Error((payload as any)?.error || (payload as any)?.raw || `HTTP ${r.status}`);
    }

    return payload as CharacterImportResponse;
}

async function runTmdbImport(anilistId: number, tmdbId: number, adminSecret: string) {
    const r = await fetch("/api/admin/import-tmdb-for-anime", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-admin-secret": adminSecret,
            accept: "application/json",
        },
        body: JSON.stringify({
            anilistId,
            tmdbId,
        }),
    });

    const text = await r.text();
    let payload: TmdbImportResponse | { raw: string };

    try {
        payload = JSON.parse(text);
    } catch {
        payload = { raw: text?.slice(0, 4000) };
    }

    if (!r.ok) {
        throw new Error((payload as any)?.error || (payload as any)?.raw || `HTTP ${r.status}`);
    }

    return payload as TmdbImportResponse;
}

async function fetchGroups(adminSecret: string) {
    const r = await fetch("/api/admin/anime-import-groups", {
        method: "GET",
        headers: {
            "x-admin-secret": adminSecret,
            accept: "application/json",
        },
    });

    const payload = await r.json();
    if (!r.ok || !payload?.ok) {
        throw new Error(payload?.error || `HTTP ${r.status}`);
    }

    return (payload.groups || []) as SavedGroupListItem[];
}

async function fetchGroup(adminSecret: string, groupId: string) {
    const r = await fetch(`/api/admin/anime-import-groups?id=${encodeURIComponent(groupId)}`, {
        method: "GET",
        headers: {
            "x-admin-secret": adminSecret,
            accept: "application/json",
        },
    });

    const payload = await r.json();
    if (!r.ok || !payload?.ok) {
        throw new Error(payload?.error || `HTTP ${r.status}`);
    }

    return {
        group: payload.group as { id: string; name: string; created_at: string; updated_at: string },
        items: (payload.items || []) as SavedGroupDetailItem[],
    };
}

async function saveGroup(
    adminSecret: string,
    id: string | null,
    name: string,
    rows: RowState[]
) {
    const payloadRows = rows.map((row) => ({
        anilistId: row.anilistId.trim(),
        tmdbId: row.tmdbId.trim() === "" ? null : row.tmdbId.trim(),
        manualTotalEpisodes:
            row.manualTotalEpisodes.trim() === "" ? null : row.manualTotalEpisodes.trim(),
        importCharactersToo: row.importCharactersToo,
    }));

    const r = await fetch("/api/admin/anime-import-groups", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-admin-secret": adminSecret,
            accept: "application/json",
        },
        body: JSON.stringify({
            id,
            name,
            items: payloadRows,
        }),
    });

    const payload = await r.json();
    if (!r.ok || !payload?.ok) {
        throw new Error(payload?.error || `HTTP ${r.status}`);
    }

    return payload as { ok: true; id: string; savedCount: number };
}

async function deleteGroup(adminSecret: string, groupId: string) {
    const r = await fetch(`/api/admin/anime-import-groups?id=${encodeURIComponent(groupId)}`, {
        method: "DELETE",
        headers: {
            "x-admin-secret": adminSecret,
            accept: "application/json",
        },
    });

    const payload = await r.json();
    if (!r.ok || !payload?.ok) {
        throw new Error(payload?.error || `HTTP ${r.status}`);
    }
}

export default function ImportAnimeFromAniListPage() {
    const [adminSecret, setAdminSecret] = useState("");
    const [groupId, setGroupId] = useState<string | null>(null);
    const [groupName, setGroupName] = useState("");
    const [rows, setRows] = useState<RowState[]>([makeRow()]);
    const [savedGroups, setSavedGroups] = useState<SavedGroupListItem[]>([]);
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [runningAll, setRunningAll] = useState(false);
    const [pageError, setPageError] = useState<string | null>(null);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    const trimmedSecret = adminSecret.trim();

    const validRowCount = useMemo(() => {
        return rows.filter((row) => {
            const anilistId = Number(row.anilistId.trim());
            const tmdbId = row.tmdbId.trim() === "" ? null : Number(row.tmdbId.trim());
            const manualTotalEpisodes =
                row.manualTotalEpisodes.trim() === "" ? null : Number(row.manualTotalEpisodes.trim());

            const anilistOk = Number.isFinite(anilistId) && anilistId > 0;
            const tmdbOk = tmdbId === null || (Number.isFinite(tmdbId) && tmdbId > 0);
            const manualOk =
                manualTotalEpisodes === null ||
                (Number.isFinite(manualTotalEpisodes) && manualTotalEpisodes > 0);

            return anilistOk && tmdbOk && manualOk;
        }).length;
    }, [rows]);

    const canSave = trimmedSecret.length > 0 && groupName.trim().length > 0 && validRowCount > 0;
    const canRun = trimmedSecret.length > 0 && validRowCount > 0 && !runningAll;

    async function refreshGroups() {
        if (!trimmedSecret) return;
        setLoadingGroups(true);

        try {
            const groups = await fetchGroups(trimmedSecret);
            setSavedGroups(groups);
        } catch (err: any) {
            setPageError(String(err?.message || err));
        } finally {
            setLoadingGroups(false);
        }
    }

    useEffect(() => {
        if (!trimmedSecret) return;
        refreshGroups();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trimmedSecret]);

    function updateRow(localId: string, patch: Partial<RowState>) {
        setRows((prev) =>
            prev.map((row) => (row.localId === localId ? { ...row, ...patch } : row))
        );
    }

    function removeRow(localId: string) {
        setRows((prev) => {
            if (prev.length <= 1) return prev;
            return prev.filter((row) => row.localId !== localId);
        });
    }

    function addRow() {
        setRows((prev) => [...prev, makeRow()]);
    }

    function resetGroupEditor() {
        setGroupId(null);
        setGroupName("");
        setRows([makeRow()]);
        setSaveMessage(null);
        setPageError(null);
    }

    async function handleSaveGroup() {
        if (!canSave) return;
        setPageError(null);
        setSaveMessage(null);

        try {
            const saved = await saveGroup(trimmedSecret, groupId, groupName.trim(), rows);
            setGroupId(saved.id);
            setSaveMessage(`Saved ${saved.savedCount} row(s).`);
            await refreshGroups();

            const reloaded = await fetchGroup(trimmedSecret, saved.id);
            setRows(
                reloaded.items.map((item) =>
                    makeRow({
                        anilistId: String(item.anilist_id ?? ""),
                        tmdbId: item.tmdb_id == null ? "" : String(item.tmdb_id),
                        manualTotalEpisodes:
                            item.manual_total_episodes == null ? "" : String(item.manual_total_episodes),
                        importCharactersToo: item.import_characters !== false,
                        savedTitleSnapshot: item.title_snapshot ?? null,
                    })
                )
            );
            setGroupName(reloaded.group.name);
            setGroupId(reloaded.group.id);
        } catch (err: any) {
            setPageError(String(err?.message || err));
        }
    }

    async function handleLoadGroup(id: string) {
        if (!trimmedSecret) return;
        setPageError(null);
        setSaveMessage(null);

        try {
            const payload = await fetchGroup(trimmedSecret, id);
            setGroupId(payload.group.id);
            setGroupName(payload.group.name);
            setRows(
                payload.items.map((item) =>
                    makeRow({
                        anilistId: String(item.anilist_id ?? ""),
                        tmdbId: item.tmdb_id == null ? "" : String(item.tmdb_id),
                        manualTotalEpisodes:
                            item.manual_total_episodes == null ? "" : String(item.manual_total_episodes),
                        importCharactersToo: item.import_characters !== false,
                        savedTitleSnapshot: item.title_snapshot ?? null,
                    })
                )
            );
        } catch (err: any) {
            setPageError(String(err?.message || err));
        }
    }

    async function handleDeleteGroup(id: string) {
        if (!trimmedSecret) return;
        const yes = window.confirm("Delete this saved group?");
        if (!yes) return;

        setPageError(null);
        setSaveMessage(null);

        try {
            await deleteGroup(trimmedSecret, id);

            if (groupId === id) {
                resetGroupEditor();
            }

            await refreshGroups();
        } catch (err: any) {
            setPageError(String(err?.message || err));
        }
    }

    async function runOneRow(row: RowState): Promise<RowState> {
        const parsedAniListId = Number(row.anilistId.trim());
        const parsedTmdbId = row.tmdbId.trim() === "" ? null : Number(row.tmdbId.trim());
        const parsedManualEpisodes =
            row.manualTotalEpisodes.trim() === "" ? null : Number(row.manualTotalEpisodes.trim());

        const anilistOk = Number.isFinite(parsedAniListId) && parsedAniListId > 0;
        const tmdbOk = parsedTmdbId === null || (Number.isFinite(parsedTmdbId) && parsedTmdbId > 0);
        const manualOk =
            parsedManualEpisodes === null ||
            (Number.isFinite(parsedManualEpisodes) && parsedManualEpisodes > 0);

        if (!anilistOk || !tmdbOk || !manualOk) {
            return {
                ...row,
                status: "error",
                step: null,
                error: "Invalid input in this row",
            };
        }

        try {
            updateRow(row.localId, {
                status: "running",
                step: "Importing anime",
                error: null,
                animeResult: null,
                characterResult: null,
                tmdbResult: null,
            });

            const animeResult = await runAnimeImport(
                parsedAniListId,
                trimmedSecret,
                parsedManualEpisodes
            );

            if (animeResult.success !== true) {
                return {
                    ...row,
                    status: "error",
                    step: "Anime import failed",
                    error: animeResult.error || "Anime import failed",
                    animeResult,
                    characterResult: null,
                    tmdbResult: null,
                };
            }

            let characterResult: CharacterImportResponse | null = null;
            let tmdbResult: TmdbImportResponse | null = null;

            if (row.importCharactersToo) {
                updateRow(row.localId, {
                    status: "running",
                    step: "Importing characters",
                    animeResult,
                });

                characterResult = await runCharacterImport(parsedAniListId, trimmedSecret);

                if (!("ok" in characterResult) || characterResult.ok !== true) {
                    return {
                        ...row,
                        status: "error",
                        step: "Character import failed",
                        error:
                            ("error" in characterResult && characterResult.error) || "Character import failed",
                        animeResult,
                        characterResult,
                        tmdbResult: null,
                    };
                }
            }

            if (parsedTmdbId !== null) {
                updateRow(row.localId, {
                    status: "running",
                    step: "Importing TMDB content",
                    animeResult,
                    characterResult,
                });

                tmdbResult = await runTmdbImport(parsedAniListId, parsedTmdbId, trimmedSecret);

                if (!("ok" in tmdbResult) || tmdbResult.ok !== true) {
                    return {
                        ...row,
                        status: "error",
                        step: "TMDB import failed",
                        error: ("error" in tmdbResult && tmdbResult.error) || "TMDB import failed",
                        animeResult,
                        characterResult,
                        tmdbResult,
                    };
                }
            }

            return {
                ...row,
                status: "success",
                step: "Done",
                error: null,
                animeResult,
                characterResult,
                tmdbResult,
            };
        } catch (err: any) {
            return {
                ...row,
                status: "error",
                step: "Request failed",
                error: String(err?.message || err),
            };
        }
    }

    async function handleRunAll() {
        if (!canRun) return;

        setRunningAll(true);
        setPageError(null);
        setSaveMessage(null);

        for (const row of rows) {
            const next = await runOneRow(row);
            setRows((prev) => prev.map((r) => (r.localId === row.localId ? next : r)));
        }

        setRunningAll(false);
    }

    async function handleRunSavedGroup(id: string) {
        if (!trimmedSecret) return;
        setPageError(null);
        setSaveMessage(null);

        try {
            const payload = await fetchGroup(trimmedSecret, id);
            const loadedRows = payload.items.map((item) =>
                makeRow({
                    anilistId: String(item.anilist_id ?? ""),
                    tmdbId: item.tmdb_id == null ? "" : String(item.tmdb_id),
                    manualTotalEpisodes:
                        item.manual_total_episodes == null ? "" : String(item.manual_total_episodes),
                    importCharactersToo: item.import_characters !== false,
                    savedTitleSnapshot: item.title_snapshot ?? null,
                })
            );

            setGroupId(payload.group.id);
            setGroupName(payload.group.name);
            setRows(loadedRows);
            setRunningAll(true);

            for (const row of loadedRows) {
                const next = await runOneRow(row);
                setRows((prev) => prev.map((r) => (r.localId === row.localId ? next : r)));
            }

            setRunningAll(false);
        } catch (err: any) {
            setRunningAll(false);
            setPageError(String(err?.message || err));
        }
    }

    return (
        <div style={{ maxWidth: 1320, margin: "0 auto", padding: 16 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
                Anime Import Groups
            </h1>

            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 14 }}>
                Save reusable groups of AniList and optional TMDB IDs, then rerun them whenever you need.
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "300px minmax(0, 1fr)",
                    gap: 16,
                    alignItems: "start",
                }}
            >
                <div
                    style={{
                        border: "1px solid rgba(0,0,0,0.12)",
                        borderRadius: 14,
                        padding: 12,
                        background: "white",
                        position: "sticky",
                        top: 12,
                    }}
                >
                    <div style={{ fontWeight: 900, marginBottom: 10 }}>Saved groups</div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                        <label style={{ fontSize: 12, fontWeight: 700 }}>
                            x-admin-secret / ADMIN_SECRET
                        </label>
                        <input
                            value={adminSecret}
                            onChange={(e) => setAdminSecret(e.target.value)}
                            placeholder="paste ADMIN_SECRET"
                            type="password"
                            style={{
                                width: "100%",
                                padding: "10px 12px",
                                borderRadius: 10,
                                border: "1px solid rgba(0,0,0,0.15)",
                            }}
                        />
                    </div>

                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                        <button
                            onClick={refreshGroups}
                            disabled={!trimmedSecret || loadingGroups}
                            style={{
                                padding: "10px 12px",
                                borderRadius: 10,
                                border: "1px solid rgba(0,0,0,0.15)",
                                background: "white",
                                fontWeight: 800,
                                cursor: !trimmedSecret || loadingGroups ? "not-allowed" : "pointer",
                            }}
                        >
                            {loadingGroups ? "Loading..." : "Refresh"}
                        </button>

                        <button
                            onClick={resetGroupEditor}
                            style={{
                                padding: "10px 12px",
                                borderRadius: 10,
                                border: "1px solid rgba(0,0,0,0.15)",
                                background: "white",
                                fontWeight: 800,
                                cursor: "pointer",
                            }}
                        >
                            New
                        </button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {savedGroups.map((group) => (
                            <div
                                key={group.id}
                                style={{
                                    border: "1px solid rgba(0,0,0,0.1)",
                                    borderRadius: 12,
                                    padding: 10,
                                    background: groupId === group.id ? "rgba(0,0,0,0.04)" : "white",
                                }}
                            >
                                <div style={{ fontWeight: 900, fontSize: 13 }}>{group.name}</div>
                                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                                    {group.item_count} anime • {fmtAgo(group.updated_at)}
                                </div>

                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                                    <button
                                        onClick={() => handleLoadGroup(group.id)}
                                        disabled={!trimmedSecret}
                                        style={{
                                            padding: "7px 10px",
                                            borderRadius: 10,
                                            border: "1px solid rgba(0,0,0,0.15)",
                                            background: "white",
                                            fontWeight: 800,
                                            cursor: !trimmedSecret ? "not-allowed" : "pointer",
                                        }}
                                    >
                                        Edit
                                    </button>

                                    <button
                                        onClick={() => handleRunSavedGroup(group.id)}
                                        disabled={!trimmedSecret || runningAll}
                                        style={{
                                            padding: "7px 10px",
                                            borderRadius: 10,
                                            border: "1px solid rgba(0,0,0,0.15)",
                                            background: "white",
                                            fontWeight: 800,
                                            cursor: !trimmedSecret || runningAll ? "not-allowed" : "pointer",
                                        }}
                                    >
                                        Run
                                    </button>

                                    <button
                                        onClick={() => handleDeleteGroup(group.id)}
                                        disabled={!trimmedSecret}
                                        style={{
                                            padding: "7px 10px",
                                            borderRadius: 10,
                                            border: "1px solid rgba(0,0,0,0.15)",
                                            background: "white",
                                            fontWeight: 800,
                                            cursor: !trimmedSecret ? "not-allowed" : "pointer",
                                        }}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}

                        {savedGroups.length === 0 ? (
                            <div style={{ fontSize: 12, opacity: 0.75 }}>
                                No saved groups yet.
                            </div>
                        ) : null}
                    </div>
                </div>

                <div>
                    <div
                        style={{
                            border: "1px solid rgba(0,0,0,0.12)",
                            borderRadius: 14,
                            padding: 12,
                            background: "white",
                            marginBottom: 14,
                        }}
                    >
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 320px" }}>
                                <label style={{ fontSize: 12, fontWeight: 700 }}>Group name</label>
                                <input
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    placeholder="e.g. Spring backlog"
                                    style={{
                                        width: "100%",
                                        padding: "10px 12px",
                                        borderRadius: 10,
                                        border: "1px solid rgba(0,0,0,0.15)",
                                    }}
                                />
                            </div>

                            <button
                                onClick={handleSaveGroup}
                                disabled={!canSave}
                                style={{
                                    padding: "10px 14px",
                                    borderRadius: 10,
                                    border: "1px solid rgba(0,0,0,0.15)",
                                    background: "white",
                                    fontWeight: 800,
                                    cursor: !canSave ? "not-allowed" : "pointer",
                                }}
                            >
                                {groupId ? "Save changes" : "Save group"}
                            </button>

                            <button
                                onClick={handleRunAll}
                                disabled={!canRun}
                                style={{
                                    padding: "10px 14px",
                                    borderRadius: 10,
                                    border: "1px solid rgba(0,0,0,0.15)",
                                    background: runningAll ? "rgba(0,0,0,0.05)" : "white",
                                    fontWeight: 800,
                                    cursor: !canRun ? "not-allowed" : "pointer",
                                }}
                            >
                                {runningAll ? "Running..." : "Run whole group"}
                            </button>

                            <button
                                onClick={addRow}
                                style={{
                                    padding: "10px 14px",
                                    borderRadius: 10,
                                    border: "1px solid rgba(0,0,0,0.15)",
                                    background: "white",
                                    fontWeight: 800,
                                    cursor: "pointer",
                                }}
                            >
                                Add anime
                            </button>
                        </div>

                        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                            {groupId ? "Saved group" : "Unsaved group"} • valid rows: {validRowCount}
                        </div>

                        {saveMessage ? (
                            <div
                                style={{
                                    marginTop: 12,
                                    padding: 12,
                                    borderRadius: 12,
                                    border: "1px solid rgba(0,128,0,0.22)",
                                    background: "rgba(0,128,0,0.06)",
                                    fontWeight: 700,
                                }}
                            >
                                {saveMessage}
                            </div>
                        ) : null}

                        {pageError ? (
                            <div
                                style={{
                                    marginTop: 12,
                                    padding: 12,
                                    borderRadius: 12,
                                    border: "1px solid rgba(255,0,0,0.25)",
                                    background: "rgba(255,0,0,0.06)",
                                    fontWeight: 700,
                                }}
                            >
                                Error: {pageError}
                            </div>
                        ) : null}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {rows.map((row, index) => {
                            const title = rowDisplayTitle(row);
                            const previewAnilistId =
                                "anime" in (row.tmdbResult || {}) && row.tmdbResult && "ok" in row.tmdbResult && row.tmdbResult.ok === true
                                    ? row.tmdbResult.anime?.anilist_id
                                    : null;

                            const statusColor =
                                row.status === "success"
                                    ? "rgba(0,128,0,0.08)"
                                    : row.status === "error"
                                        ? "rgba(255,0,0,0.08)"
                                        : row.status === "running"
                                            ? "rgba(255,165,0,0.08)"
                                            : "rgba(0,0,0,0.03)";

                            return (
                                <div
                                    key={row.localId}
                                    style={{
                                        border: "1px solid rgba(0,0,0,0.12)",
                                        borderRadius: 14,
                                        padding: 12,
                                        background: "white",
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns: "56px minmax(180px, 1.2fr) minmax(120px, 140px) minmax(120px, 140px) minmax(150px, 180px) 160px auto",
                                            gap: 10,
                                            alignItems: "center",
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontWeight: 900,
                                                fontSize: 13,
                                                textAlign: "center",
                                                padding: "8px 0",
                                                borderRadius: 10,
                                                background: "rgba(0,0,0,0.04)",
                                            }}
                                        >
                                            #{index + 1}
                                        </div>

                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 900 }}>
                                                {title || "Untitled row"}
                                            </div>
                                            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                                                {row.savedTitleSnapshot && !row.animeResult ? "Saved title snapshot" : ""}
                                            </div>
                                        </div>

                                        <input
                                            value={row.anilistId}
                                            onChange={(e) => updateRow(row.localId, { anilistId: e.target.value })}
                                            placeholder="AniList ID"
                                            inputMode="numeric"
                                            style={{
                                                width: "100%",
                                                padding: "10px 12px",
                                                borderRadius: 10,
                                                border: "1px solid rgba(0,0,0,0.15)",
                                            }}
                                        />

                                        <input
                                            value={row.tmdbId}
                                            onChange={(e) => updateRow(row.localId, { tmdbId: e.target.value })}
                                            placeholder="TMDB ID"
                                            inputMode="numeric"
                                            style={{
                                                width: "100%",
                                                padding: "10px 12px",
                                                borderRadius: 10,
                                                border: "1px solid rgba(0,0,0,0.15)",
                                            }}
                                        />

                                        <input
                                            value={row.manualTotalEpisodes}
                                            onChange={(e) =>
                                                updateRow(row.localId, { manualTotalEpisodes: e.target.value })
                                            }
                                            placeholder="Manual episodes"
                                            inputMode="numeric"
                                            style={{
                                                width: "100%",
                                                padding: "10px 12px",
                                                borderRadius: 10,
                                                border: "1px solid rgba(0,0,0,0.15)",
                                            }}
                                        />

                                        <label
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                                padding: "10px 12px",
                                                borderRadius: 10,
                                                border: "1px solid rgba(0,0,0,0.15)",
                                                background: "white",
                                                fontSize: 13,
                                                fontWeight: 700,
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={row.importCharactersToo}
                                                onChange={(e) =>
                                                    updateRow(row.localId, { importCharactersToo: e.target.checked })
                                                }
                                            />
                                            Characters
                                        </label>

                                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                            <button
                                                onClick={() => updateRow(row.localId, { showRaw: !row.showRaw })}
                                                style={{
                                                    padding: "8px 10px",
                                                    borderRadius: 10,
                                                    border: "1px solid rgba(0,0,0,0.15)",
                                                    background: "white",
                                                    fontWeight: 800,
                                                    cursor: "pointer",
                                                }}
                                            >
                                                {row.showRaw ? "Hide" : "Show"}
                                            </button>

                                            <button
                                                onClick={() => removeRow(row.localId)}
                                                disabled={rows.length <= 1}
                                                style={{
                                                    padding: "8px 10px",
                                                    borderRadius: 10,
                                                    border: "1px solid rgba(0,0,0,0.15)",
                                                    background: "white",
                                                    fontWeight: 800,
                                                    cursor: rows.length <= 1 ? "not-allowed" : "pointer",
                                                }}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            marginTop: 10,
                                            display: "flex",
                                            gap: 8,
                                            alignItems: "center",
                                            flexWrap: "wrap",
                                        }}
                                    >
                                        <div
                                            style={{
                                                padding: "6px 10px",
                                                borderRadius: 999,
                                                background: statusColor,
                                                border: "1px solid rgba(0,0,0,0.08)",
                                                fontSize: 12,
                                                fontWeight: 900,
                                            }}
                                        >
                                            {row.status.toUpperCase()}
                                        </div>

                                        <div style={{ fontSize: 12, opacity: 0.8 }}>
                                            {row.step || "Not run yet"}
                                        </div>

                                        {row.error ? (
                                            <div style={{ fontSize: 12, color: "#b00020", fontWeight: 700 }}>
                                                {row.error}
                                            </div>
                                        ) : null}

                                        {previewAnilistId ? (
                                            <Link
                                                href={`/admin/pages/tmdb-anime-preview?anilistId=${encodeURIComponent(
                                                    String(previewAnilistId)
                                                )}`}
                                                style={{
                                                    marginLeft: "auto",
                                                    display: "inline-block",
                                                    padding: "8px 10px",
                                                    borderRadius: 10,
                                                    border: "1px solid rgba(0,0,0,0.15)",
                                                    background: "white",
                                                    fontWeight: 800,
                                                    textDecoration: "none",
                                                    color: "inherit",
                                                    fontSize: 12,
                                                }}
                                            >
                                                View TMDB content
                                            </Link>
                                        ) : null}
                                    </div>

                                    {row.showRaw ? (
                                        <div
                                            style={{
                                                marginTop: 12,
                                                display: "grid",
                                                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                                                gap: 10,
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75, marginBottom: 6 }}>
                                                    Anime
                                                </div>
                                                <pre
                                                    style={{
                                                        margin: 0,
                                                        padding: 12,
                                                        borderRadius: 12,
                                                        border: "1px solid rgba(0,0,0,0.12)",
                                                        background: "rgba(0,0,0,0.03)",
                                                        overflowX: "auto",
                                                        fontSize: 12,
                                                        lineHeight: 1.35,
                                                    }}
                                                >
                                                    {JSON.stringify(row.animeResult, null, 2)}
                                                </pre>
                                            </div>

                                            <div>
                                                <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75, marginBottom: 6 }}>
                                                    Characters
                                                </div>
                                                <pre
                                                    style={{
                                                        margin: 0,
                                                        padding: 12,
                                                        borderRadius: 12,
                                                        border: "1px solid rgba(0,0,0,0.12)",
                                                        background: "rgba(0,0,0,0.03)",
                                                        overflowX: "auto",
                                                        fontSize: 12,
                                                        lineHeight: 1.35,
                                                    }}
                                                >
                                                    {JSON.stringify(row.characterResult, null, 2)}
                                                </pre>
                                            </div>

                                            <div>
                                                <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75, marginBottom: 6 }}>
                                                    TMDB
                                                </div>
                                                <pre
                                                    style={{
                                                        margin: 0,
                                                        padding: 12,
                                                        borderRadius: 12,
                                                        border: "1px solid rgba(0,0,0,0.12)",
                                                        background: "rgba(0,0,0,0.03)",
                                                        overflowX: "auto",
                                                        fontSize: 12,
                                                        lineHeight: 1.35,
                                                    }}
                                                >
                                                    {JSON.stringify(row.tmdbResult, null, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}