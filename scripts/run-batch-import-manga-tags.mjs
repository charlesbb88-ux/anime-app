const ADMIN_SECRET = process.env.ADMIN_SECRET;
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const LIMIT = Number(process.env.LIMIT || 100);
const PAUSE_MS = Number(process.env.PAUSE_MS || 1500);

if (!ADMIN_SECRET) {
  console.error("Missing ADMIN_SECRET env var");
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  let iteration = 0;

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
      console.error("Request itself failed:", err);
      console.log(`Waiting ${PAUSE_MS}ms and retrying...`);
      await sleep(PAUSE_MS);
      continue;
    }

    let data;
    try {
      data = await res.json();
    } catch (err) {
      console.error("Failed to parse JSON response:", err);
      console.log(`Waiting ${PAUSE_MS}ms and retrying...`);
      await sleep(PAUSE_MS);
      continue;
    }

    if (!res.ok || !data?.ok) {
      console.error("Batch request failed:");
      console.error(data);

      const message =
        typeof data?.error === "string" ? data.error : "Unknown error";

      const looksTransient =
        message.includes("fetch failed") ||
        message.includes("ECONNRESET") ||
        message.includes("ETIMEDOUT") ||
        message.includes("network") ||
        message.includes("timeout");

      if (looksTransient) {
        console.log(`Transient error. Waiting ${PAUSE_MS}ms and retrying...`);
        await sleep(PAUSE_MS);
        continue;
      }

      process.exit(1);
    }

    console.log(`processed this run: ${data.processed ?? 0}`);
    console.log(`success this run:   ${data.success ?? 0}`);
    console.log(`failed this run:    ${data.failed ?? 0}`);
    console.log(`total eligible:     ${data.totalEligible ?? 0}`);
    console.log(`done total:         ${data.done ?? 0}`);
    console.log(`left total:         ${data.left ?? 0}`);
    console.log(`failed total:       ${data.failedTotal ?? 0}`);

    if (Array.isArray(data.failures) && data.failures.length > 0) {
      console.log("recent failures:");
      for (const f of data.failures) {
        console.log(
          `- mangaId=${f.mangaId} anilistId=${f.anilistId ?? "null"} error=${f.error}`
        );
      }
    }

    if (
      typeof data.left === "number" &&
      data.left === 0 &&
      data.processed > 0
    ) {
      console.log("\nAll done.");
      break;
    }

    if ((data.processed ?? 0) === 0) {
      console.log("\nNo rows processed this run. Stopping so it doesn't loop forever.");
      break;
    }

    console.log(`Waiting ${PAUSE_MS}ms...\n`);
    await sleep(PAUSE_MS);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});