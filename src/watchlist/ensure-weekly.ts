import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { CONFIG as C } from "../config.js";
import { buildWeeklyWatchlist } from "./build-weekly.js";

interface GeneratedWatchlistMeta {
  generatedAt?: string;
}

async function generatedWatchlistIsFresh(): Promise<boolean> {
  const outputPath = resolve(process.cwd(), C.generatedWatchlistPath);

  try {
    await access(outputPath);
    const raw = await readFile(outputPath, "utf8");
    const parsed = JSON.parse(raw) as GeneratedWatchlistMeta;

    if (!parsed.generatedAt) {
      return false;
    }

    const ageMs = Date.now() - new Date(parsed.generatedAt).getTime();
    return ageMs >= 0 && ageMs < 7 * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  if (await generatedWatchlistIsFresh()) {
    console.log(`weekly watchlist fresh: ${C.generatedWatchlistPath}`);
    return;
  }

  console.log("weekly watchlist missing/stale, rebuilding...");
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  const outputPath = resolve(process.cwd(), C.generatedWatchlistPath);
  const watchlist = await buildWeeklyWatchlist();

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(watchlist, null, 2)}\n`, "utf8");

  console.log({
    outputPath: C.generatedWatchlistPath,
    selected: watchlist.tickers.length,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error("weekly_ensure_failed", error);
    process.exitCode = 1;
  });
}
