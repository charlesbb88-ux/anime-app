const ADMIN_SECRET = process.env.ADMIN_SECRET;
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const LIMIT = parsePositiveInt(process.env.LIMIT, 100);
const PAUSE_MS = parsePositiveInt(process.env.PAUSE_MS, 1500);
const MAX_CONSECUTIVE_TRANSIENT_ERRORS = parsePositiveInt(
  process.env.MAX_CONSECUTIVE_TRANSIENT_ERRORS,
  10
);

if (!ADMIN_SECRET) {
  console.error("Missing ADMIN_SECRET env var");
  process.exit(1);
}

function parsePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(data) {
  if (typeof data?.error === "string" && data.error.trim() !== "") {
    return data.error.trim();
  }

  try {
    const serialized = JSON.stringify(data);
    if (serialized && serialized !== "{}") return serialized;
  } catch {}

  return "Unknown error";
}

function looksTransientError(message) {
  const m = String(message || "").toLowerCase();

  return (
    m.includes("fetch failed") ||
    m.includes("econnreset") ||
    m.includes("etimedout") ||
    m.includes("timeout") ||
    m.includes("network") ||
    m.includes("socket hang up") ||
    m.includes("connection reset") ||
    m.includes("temporar") ||
    m.includes("rate limit") ||
    m.includes("too many requests") ||
    m.includes("unknown error")
  );
}

function isValidNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

async function run() {
  let iteration = 0;
  let consecutiveTransientErrors = 0;

  while (true) {
    iteration++;

    console.log(`\n--- batch run ${iteration} ---`);

    let res;
    try {
      res = await fetch(`${BASE_URL}/api/admin/batch-import-manga-tags`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": ADMIN_SECRET,
        },
        body: JSON.stringify({
          limit: LIMIT,
        }),
      });
    } catch (err) {
      consecutiveTransientErrors++;
      console.error("Request itself failed:", err);

      if (consecutiveTransientErrors >= MAX_CONSECUTIVE_TRANSIENT_ERRORS) {
        console.error(
          `Stopped after ${consecutiveTransientErrors} consecutive request failures.`
        );
        process.exit(1);
      }

      console.log(`Waiting ${PAUSE_MS}ms and retrying...`);
      await sleep(PAUSE_MS);
      continue;
    }

    let data;
    try {
      data = await res.json();
    } catch (err) {
      consecutiveTransientErrors++;
      console.error("Failed to parse JSON response:", err);

      if (consecutiveTransientErrors >= MAX_CONSECUTIVE_TRANSIENT_ERRORS) {
        console.error(
          `Stopped after ${consecutiveTransientErrors} consecutive response parse failures.`
        );
        process.exit(1);
      }

      console.log(`Waiting ${PAUSE_MS}ms and retrying...`);
      await sleep(PAUSE_MS);
      continue;
    }

    if (!res.ok || !data?.ok) {
      consecutiveTransientErrors++;

      console.error("Batch request failed:");
      console.error(data);

      const message = getErrorMessage(data);
      const transient = looksTransientError(message);

      if (transient) {
        if (consecutiveTransientErrors >= MAX_CONSECUTIVE_TRANSIENT_ERRORS) {
          console.error(
            `Stopped after ${consecutiveTransientErrors} consecutive transient errors.`
          );
          process.exit(1);
        }

        console.log(`Transient error: ${message}`);
        console.log(`Waiting ${PAUSE_MS}ms and retrying...`);
        await sleep(PAUSE_MS);
        continue;
      }

      console.error(`Fatal error: ${message}`);
      process.exit(1);
    }

    consecutiveTransientErrors = 0;

    const processed = isValidNumber(data.processed) ? data.processed : 0;
    const success = isValidNumber(data.success) ? data.success : 0;
    const failed = isValidNumber(data.failed) ? data.failed : 0;
    const totalEligible = isValidNumber(data.totalEligible)
      ? data.totalEligible
      : 0;
    const done = isValidNumber(data.done) ? data.done : 0;
    const left = isValidNumber(data.left) ? data.left : 0;
    const failedTotal = isValidNumber(data.failedTotal)
      ? data.failedTotal
      : 0;

    console.log(`processed this run: ${processed}`);
    console.log(`success this run:   ${success}`);
    console.log(`failed this run:    ${failed}`);
    console.log(`total eligible:     ${totalEligible}`);
    console.log(`done total:         ${done}`);
    console.log(`left total:         ${left}`);
    console.log(`failed total:       ${failedTotal}`);

    if (Array.isArray(data.failures) && data.failures.length > 0) {
      console.log("recent failures:");
      for (const f of data.failures) {
        const mangaId =
          typeof f?.mangaId === "string" && f.mangaId.trim() !== ""
            ? f.mangaId
            : "unknown";
        const anilistId =
          f?.anilistId === null || f?.anilistId === undefined
            ? "null"
            : String(f.anilistId);
        const error =
          typeof f?.error === "string" && f.error.trim() !== ""
            ? f.error
            : "Unknown row error";

        console.log(
          `- mangaId=${mangaId} anilistId=${anilistId} error=${error}`
        );
      }
    }

    if (left === 0 && processed > 0) {
      console.log("\nAll done.");
      break;
    }

    if (processed === 0) {
      console.log(
        "\nNo rows processed this run. Stopping so it doesn't loop forever."
      );
      break;
    }

    console.log(`Waiting ${PAUSE_MS}ms...\n`);
    await sleep(PAUSE_MS);
  }
}

run().catch((err) => {
  console.error("Runner crashed:", err);
  process.exit(1);
});