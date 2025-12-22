// pages/dev/auto-link-test.tsx
"use client";

import { useMemo, useState } from "react";

type Json = any;

function pretty(obj: any) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

export default function AutoLinkTestPage() {
  const [animeId, setAnimeId] = useState("");
  const [secret, setSecret] = useState(""); // optional (only if ANIME_IMPORT_SECRET is set)
  const [loading, setLoading] = useState(false);

  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [result, setResult] = useState<Json>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const canRun = useMemo(() => {
    const v = animeId.trim();
    // super-light UUID check (enough to prevent obvious mistakes)
    return v.length >= 32;
  }, [animeId]);

  async function run() {
    setLoading(true);
    setStatusCode(null);
    setResult(null);
    setErrorText(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Only send the header if user actually filled it in
      if (secret.trim()) headers["x-import-secret"] = secret.trim();

      const res = await fetch("/api/admin/auto-link-anime", {
        method: "POST",
        headers,
        body: JSON.stringify({ animeId: animeId.trim() }),
      });

      setStatusCode(res.status);

      const text = await res.text();
      let json: any = null;

      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        // not JSON
      }

      if (!res.ok) {
        setErrorText(text || `Request failed (HTTP ${res.status})`);
        setResult(json ?? { raw: text });
        return;
      }

      setResult(json ?? { raw: text });
    } catch (e: any) {
      setErrorText(e?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] p-6">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Auto-link tester</h1>
        <p className="mt-2 text-sm text-gray-600">
          This calls <span className="font-mono">POST /api/admin/auto-link-anime</span> with{" "}
          <span className="font-mono">{"{ animeId }"}</span> and prints the JSON response.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-800">Anime UUID (anime.id)</label>
            <input
              value={animeId}
              onChange={(e) => setAnimeId(e.target.value)}
              placeholder="e.g. 3e7f0c2a-1234-...."
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm outline-none focus:border-gray-400"
            />
            <p className="mt-1 text-xs text-gray-500">
              Copy from Supabase → Table Editor → <span className="font-mono">anime</span> →{" "}
              <span className="font-mono">id</span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800">
              Import secret (optional)
            </label>
            <input
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Only needed if you set ANIME_IMPORT_SECRET"
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm outline-none focus:border-gray-400"
            />
            <p className="mt-1 text-xs text-gray-500">
              If you did <span className="font-mono">ANIME_IMPORT_SECRET=...</span> in{" "}
              <span className="font-mono">.env.local</span>, paste the same value here. Otherwise
              leave blank.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={run}
              disabled={!canRun || loading}
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? "Running..." : "Run auto-link"}
            </button>

            {statusCode !== null ? (
              <span className="text-sm text-gray-700">
                HTTP: <span className="font-mono">{statusCode}</span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-800">Output</h2>

          {errorText ? (
            <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {errorText}
            </div>
          ) : null}

          <pre className="mt-2 max-h-[520px] overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs leading-5">
            {result ? pretty(result) : "No output yet."}
          </pre>

          <p className="mt-3 text-xs text-gray-500">
            After a success, check Supabase → <span className="font-mono">anime_external_links</span>{" "}
            filtered by your <span className="font-mono">anime_id</span> to confirm rows were
            created/updated.
          </p>
        </div>
      </div>
    </div>
  );
}
