import { useState } from "react";

export default function ExternalIdLookup() {
  const [externalId, setExternalId] = useState("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup() {
    if (!externalId.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const r = await fetch(
        `/api/dev/external-id?external_id=${encodeURIComponent(externalId.trim())}`
      );

      const j = await r.json();

      if (!j.ok) {
        setError(j.error || "Not found");
      } else if (!j.data) {
        setError("No match found");
      } else {
        setResult(j.data);
      }
    } catch (e: any) {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  const slug = result?.manga?.slug;
  const title = result?.manga?.title;
  const url = slug ? `/manga/${slug}` : null;

  return (
    <div style={{ padding: 40, maxWidth: 720 }}>
      <h1>External ID → Slug Lookup</h1>

      <input
        value={externalId}
        onChange={(e) => setExternalId(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && lookup()}
        placeholder="Paste MangaDex ID here"
        style={{
          width: "100%",
          padding: 12,
          fontSize: 16,
          marginBottom: 12,
        }}
      />

      <button onClick={lookup} disabled={loading}>
        {loading ? "Looking..." : "Lookup"}
      </button>

      {error && <div style={{ color: "red", marginTop: 16 }}>{error}</div>}

      {result && (
        <div style={{ marginTop: 24 }}>
          <div><b>Title:</b> {title}</div>
          <div><b>Slug:</b> {slug}</div>

          {url && (
            <>
              <div style={{ marginTop: 8 }}>
                <b>URL:</b>{" "}
                <code>{`http://localhost:3000${url}`}</code>
              </div>

              <div style={{ marginTop: 16 }}>
                <a
                  href={url}
                  target="_blank"
                  style={{
                    padding: "10px 14px",
                    background: "#4ea1ff",
                    color: "#000",
                    borderRadius: 8,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Open on your site →
                </a>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
