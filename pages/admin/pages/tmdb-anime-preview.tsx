"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/router";

type PreviewResponse =
  | {
      ok: true;
      anime: {
        id: string;
        anilist_id: number | null;
        tmdb_id: number | null;
        title: string | null;
        slug: string | null;
      };
      counts: {
        seriesArtwork: number;
        episodes: number;
        episodeArtwork: number;
      };
      seriesArtwork: Array<{
        id: number | string;
        anime_id: string;
        source: string;
        kind: string;
        url: string;
        lang: string | null;
        width: number | null;
        height: number | null;
        vote: number | null;
        is_primary: boolean;
      }>;
      episodes: Array<{
        id: string;
        anime_id: string;
        episode_number: number;
        title: string | null;
        synopsis: string | null;
        air_date: string | null;
        season_number: number | null;
        season_episode_number: number | null;
        tmdb_episode_id: number | null;
        artwork: Array<{
          id: number | string;
          anime_episode_id: string;
          source: string;
          kind: string;
          url: string;
          lang: string | null;
          width: number | null;
          height: number | null;
          vote: number | null;
          is_primary: boolean;
        }>;
      }>;
    }
  | {
      ok: false;
      error?: string;
      raw?: string;
    };

async function loadPreview(anilistId: number, adminSecret: string) {
  const r = await fetch(
    `/api/admin/tmdb-anime-preview?anilistId=${encodeURIComponent(String(anilistId))}`,
    {
      method: "GET",
      headers: {
        "x-admin-secret": adminSecret,
        accept: "application/json",
      },
    }
  );

  const text = await r.text();

  let payload: PreviewResponse | { raw: string };
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text?.slice(0, 4000) };
  }

  if (!r.ok) {
    throw new Error((payload as any)?.error || (payload as any)?.raw || `HTTP ${r.status}`);
  }

  return payload as PreviewResponse;
}

export default function TmdbAnimePreviewPage() {
  const router = useRouter();

  const initialAnilistId =
    typeof router.query.anilistId === "string" ? router.query.anilistId : "";

  const [adminSecret, setAdminSecret] = useState("");
  const [anilistId, setAnilistId] = useState(initialAnilistId);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsedId = Number(anilistId.trim());
  const trimmedSecret = adminSecret.trim();

  const canLoad = useMemo(() => {
    return trimmedSecret.length > 0 && Number.isFinite(parsedId) && parsedId > 0;
  }, [trimmedSecret, parsedId]);

  async function onLoad(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canLoad || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload = await loadPreview(parsedId, trimmedSecret);
      setResult(payload);
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }

  const success = result && "ok" in result && result.ok === true;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
        TMDB Anime Preview
      </h1>

      <form
        onSubmit={onLoad}
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-end",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>
            x-admin-secret / ADMIN_SECRET
          </label>
          <input
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            placeholder="paste ADMIN_SECRET"
            type="password"
            style={{
              width: 360,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.15)",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>AniList ID</label>
          <input
            value={anilistId}
            onChange={(e) => setAnilistId(e.target.value)}
            placeholder="e.g. 5114"
            inputMode="numeric"
            style={{
              width: 180,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.15)",
            }}
          />
        </div>

        <button
          type="submit"
          disabled={!canLoad || loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.15)",
            background: loading ? "rgba(0,0,0,0.05)" : "white",
            fontWeight: 800,
            cursor: !canLoad || loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Loading..." : "Load preview"}
        </button>
      </form>

      {error ? (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(255,0,0,0.25)",
            background: "rgba(255,0,0,0.06)",
            fontWeight: 700,
          }}
        >
          Error: {error}
        </div>
      ) : null}

      {success ? (
        <>
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Anime</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
              <div><b>Title:</b> {result.anime.title || "—"}</div>
              <div><b>Slug:</b> {result.anime.slug || "—"}</div>
              <div><b>AniList ID:</b> {result.anime.anilist_id ?? "—"}</div>
              <div><b>TMDB ID:</b> {result.anime.tmdb_id ?? "—"}</div>
              <div><b>Series artwork rows:</b> {result.counts.seriesArtwork}</div>
              <div><b>Episodes:</b> {result.counts.episodes}</div>
              <div><b>Episode artwork rows:</b> {result.counts.episodeArtwork}</div>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
              Series artwork
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              {result.seriesArtwork.map((art) => (
                <div
                  key={String(art.id)}
                  style={{
                    border: "1px solid rgba(0,0,0,0.12)",
                    borderRadius: 12,
                    padding: 10,
                    background: "white",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>
                    {art.kind}
                    {art.is_primary ? " • PRIMARY" : ""}
                  </div>
                  <img
                    src={art.url}
                    alt={art.kind}
                    style={{
                      width: "100%",
                      height: 220,
                      objectFit: "cover",
                      borderRadius: 8,
                      display: "block",
                      marginBottom: 8,
                    }}
                  />
                  <div style={{ fontSize: 12, lineHeight: 1.35 }}>
                    <div><b>Lang:</b> {art.lang || "—"}</div>
                    <div><b>Vote:</b> {art.vote ?? "—"}</div>
                    <div><b>Size:</b> {art.width ?? "—"} × {art.height ?? "—"}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
              Episodes
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {result.episodes.map((ep) => (
                <details
                  key={ep.id}
                  style={{
                    border: "1px solid rgba(0,0,0,0.12)",
                    borderRadius: 12,
                    padding: 12,
                    background: "white",
                  }}
                >
                  <summary style={{ cursor: "pointer", fontWeight: 900 }}>
                    Episode {ep.episode_number}
                    {ep.title ? ` • ${ep.title}` : ""}
                  </summary>

                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
                    <div><b>Season:</b> {ep.season_number ?? "—"}</div>
                    <div><b>Season episode:</b> {ep.season_episode_number ?? "—"}</div>
                    <div><b>TMDB episode ID:</b> {ep.tmdb_episode_id ?? "—"}</div>
                    <div><b>Air date:</b> {ep.air_date || "—"}</div>
                    <div><b>Title:</b> {ep.title || "—"}</div>
                    <div><b>Synopsis:</b> {ep.synopsis || "—"}</div>
                  </div>

                  {ep.artwork.length > 0 ? (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>
                        Episode artwork
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                          gap: 12,
                        }}
                      >
                        {ep.artwork.map((art) => (
                          <div
                            key={String(art.id)}
                            style={{
                              border: "1px solid rgba(0,0,0,0.12)",
                              borderRadius: 12,
                              padding: 10,
                              background: "rgba(0,0,0,0.02)",
                            }}
                          >
                            <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>
                              {art.kind}
                              {art.is_primary ? " • PRIMARY" : ""}
                            </div>
                            <img
                              src={art.url}
                              alt={art.kind}
                              style={{
                                width: "100%",
                                height: 180,
                                objectFit: "cover",
                                borderRadius: 8,
                                display: "block",
                                marginBottom: 8,
                              }}
                            />
                            <div style={{ fontSize: 12, lineHeight: 1.35 }}>
                              <div><b>Lang:</b> {art.lang || "—"}</div>
                              <div><b>Vote:</b> {art.vote ?? "—"}</div>
                              <div><b>Size:</b> {art.width ?? "—"} × {art.height ?? "—"}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
                      No episode artwork stored.
                    </div>
                  )}
                </details>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {result ? (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75, marginBottom: 6 }}>
            Raw preview response
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
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}