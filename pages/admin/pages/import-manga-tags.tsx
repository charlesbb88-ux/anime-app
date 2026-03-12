import { useState } from "react";
import type { NextPage } from "next";

type ApiSuccess = {
  ok: true;
  mangaId: string;
  mangaTitleInDb: string | null;
  mangaSlugInDb: string | null;
  anilistId: number;
  anilistTitle: string;
  incomingUniqueTagCount: number;
  updatedCount: number;
  insertedCount: number;
  totalTagCountNowOnManga: number | null;
};

type ApiFailure = {
  ok: false;
  error: string;
};

type ApiResponse = ApiSuccess | ApiFailure;

const pageWrapStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "40px auto",
  padding: "0 16px 48px",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 20,
  background: "#fff",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 14,
  fontWeight: 600,
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  borderRadius: 10,
  border: "1px solid #d1d5db",
  padding: "0 12px",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const buttonStyle: React.CSSProperties = {
  height: 44,
  borderRadius: 10,
  border: "none",
  padding: "0 16px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  background: "#111827",
  color: "#fff",
};

const mutedStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 14,
  lineHeight: 1.5,
};

const resultBoxStyle: React.CSSProperties = {
  marginTop: 20,
  borderRadius: 12,
  padding: 16,
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
};

const errorBoxStyle: React.CSSProperties = {
  marginTop: 20,
  borderRadius: 12,
  padding: 16,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
};

const rowStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const ImportMangaTagsPage: NextPage = () => {
  const [adminSecret, setAdminSecret] = useState("");
  const [mangaId, setMangaId] = useState("");
  const [anilistId, setAnilistId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trimmedSecret = adminSecret.trim();

  async function handleImport() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/import-manga-tags-from-anilist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": trimmedSecret,
          accept: "application/json",
        },
        body: JSON.stringify({
          mangaId,
          anilistId,
        }),
      });

      const json = (await res.json()) as ApiResponse;

      if (!res.ok || !json.ok) {
        setError(("error" in json && json.error) || `HTTP ${res.status}`);
        return;
      }

      setResult(json);
    } catch (err: any) {
      setError(err?.message ?? "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={pageWrapStyle}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
          Import Manga Tags from AniList
        </h1>
        <p style={{ ...mutedStyle, marginTop: 10 }}>
          Enter a manga ID from your database and the matching AniList ID. This
          never deletes tags. It only updates matching tags and inserts new ones.
        </p>
      </div>

      <div style={cardStyle}>
        <div style={rowStyle}>
          <div>
            <label style={labelStyle} htmlFor="admin-secret">
              x-admin-secret / ADMIN_SECRET
            </label>
            <input
              id="admin-secret"
              type="password"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              placeholder="paste ADMIN_SECRET"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="manga-id">
              Manga ID from your database
            </label>
            <input
              id="manga-id"
              type="text"
              value={mangaId}
              onChange={(e) => setMangaId(e.target.value)}
              placeholder="ex: 6a7b8c9d-1234-5678-9012-abcdef123456"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="anilist-id">
              AniList ID
            </label>
            <input
              id="anilist-id"
              type="text"
              value={anilistId}
              onChange={(e) => setAnilistId(e.target.value)}
              placeholder="ex: 30002"
              style={inputStyle}
            />
          </div>

          <div>
            <button
              type="button"
              onClick={handleImport}
              disabled={loading || !trimmedSecret}
              style={{
                ...buttonStyle,
                opacity: loading || !trimmedSecret ? 0.7 : 1,
                cursor: loading || !trimmedSecret ? "default" : "pointer",
              }}
            >
              {loading ? "Importing..." : "Import Tags"}
            </button>
          </div>
        </div>

        {error ? (
          <div style={errorBoxStyle}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Error</div>
            <div>{error}</div>
          </div>
        ) : null}

        {result ? (
          <div style={resultBoxStyle}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12 }}>
              Import Complete
            </div>

            <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
              <div>
                <strong>Manga ID:</strong> {result.mangaId}
              </div>
              <div>
                <strong>Manga title in DB:</strong>{" "}
                {result.mangaTitleInDb || "—"}
              </div>
              <div>
                <strong>Manga slug in DB:</strong>{" "}
                {result.mangaSlugInDb || "—"}
              </div>
              <div>
                <strong>AniList ID:</strong> {result.anilistId}
              </div>
              <div>
                <strong>AniList title:</strong> {result.anilistTitle}
              </div>
              <div>
                <strong>Incoming unique tags:</strong>{" "}
                {result.incomingUniqueTagCount}
              </div>
              <div>
                <strong>Updated existing tags:</strong> {result.updatedCount}
              </div>
              <div>
                <strong>Inserted new tags:</strong> {result.insertedCount}
              </div>
              <div>
                <strong>Total tags now on manga:</strong>{" "}
                {result.totalTagCountNowOnManga ?? "—"}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ImportMangaTagsPage;