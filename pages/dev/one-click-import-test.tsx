// pages/dev/one-click-import-test.tsx
"use client";

import { useState } from "react";

export default function OneClickImportTestPage() {
  const [anilistId, setAnilistId] = useState("");
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [episodes, setEpisodes] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/admin/one-click-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anilistId: anilistId.trim() ? anilistId.trim() : undefined,
          title: title.trim() ? title.trim() : undefined,
          year: year.trim() ? year.trim() : undefined,
          episodes: episodes.trim() ? episodes.trim() : undefined,
          // secret: "YOUR_SECRET_IF_YOU_USE_ONE"
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      setResult(json);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold">One-click Import Test</h1>
      <p className="mt-2 text-sm text-gray-600">
        Goal: Press one button → create/merge ONE anime → pull from AniList + TMDB + TVDB → show results.
      </p>

      <div className="mt-6 rounded-xl border bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm">
            AniList ID (recommended)
            <input
              className="mt-1 w-full rounded-md border p-2"
              value={anilistId}
              onChange={(e) => setAnilistId(e.target.value)}
              placeholder="e.g. 1735"
            />
          </label>

          <label className="text-sm">
            Title (fallback if no AniList ID)
            <input
              className="mt-1 w-full rounded-md border p-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Naruto"
            />
          </label>

          <label className="text-sm">
            Year (optional)
            <input
              className="mt-1 w-full rounded-md border p-2"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="e.g. 2002"
            />
          </label>

          <label className="text-sm">
            Episodes (optional)
            <input
              className="mt-1 w-full rounded-md border p-2"
              value={episodes}
              onChange={(e) => setEpisodes(e.target.value)}
              placeholder="e.g. 220"
            />
          </label>
        </div>

        <button
          onClick={run}
          disabled={loading}
          className="mt-4 rounded-lg bg-black px-4 py-2 text-white disabled:opacity-60"
        >
          {loading ? "Importing..." : "One-click Import"}
        </button>

        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        {result ? (
          <div className="rounded-xl border bg-white p-4">
            <div className="text-sm text-gray-600">
              <div><b>anime_id:</b> {result.anime_id}</div>
              <div className="mt-1">
                <b>Query:</b> {result?.query?.title} ({result?.query?.year ?? "?"}) • eps: {result?.query?.episodes ?? "?"}
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-3">
                <div className="font-semibold">Best TMDB match</div>
                <pre className="mt-2 overflow-auto rounded bg-gray-50 p-2 text-xs">
                  {JSON.stringify(result.best?.tmdb, null, 2)}
                </pre>
                <div className="mt-2 text-xs text-gray-600">
                  Import result:
                  <pre className="mt-1 overflow-auto rounded bg-gray-50 p-2 text-xs">
                    {JSON.stringify(result.imports?.tmdb, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="font-semibold">Best TVDB match</div>
                <pre className="mt-2 overflow-auto rounded bg-gray-50 p-2 text-xs">
                  {JSON.stringify(result.best?.tvdb, null, 2)}
                </pre>
                <div className="mt-2 text-xs text-gray-600">
                  Import result:
                  <pre className="mt-1 overflow-auto rounded bg-gray-50 p-2 text-xs">
                    {JSON.stringify(result.imports?.tvdb, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border p-3">
              <div className="font-semibold">anime row</div>
              <pre className="mt-2 overflow-auto rounded bg-gray-50 p-2 text-xs">
                {JSON.stringify(result.anime, null, 2)}
              </pre>
            </div>

            <div className="mt-4 rounded-lg border p-3">
              <div className="font-semibold">external links written</div>
              <pre className="mt-2 overflow-auto rounded bg-gray-50 p-2 text-xs">
                {JSON.stringify(result.external_links, null, 2)}
              </pre>
            </div>

            {result.warnings?.length ? (
              <div className="mt-4 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                <b>Warnings</b>
                <ul className="mt-1 list-disc pl-5">
                  {result.warnings.map((w: string, i: number) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-sm text-gray-600">
            No result yet. Run an import.
          </div>
        )}
      </div>
    </div>
  );
}
