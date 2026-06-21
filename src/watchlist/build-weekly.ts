import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import universe from "../universe/idx.json" with { type: "json" };
import { CONFIG as C } from "../config.js";
import { fetchDaily } from "../providers/yahoo.js";
import { sleep } from "../utils/time.js";
import { evaluateWeeklyCandidate } from "./evaluate-weekly.js";
import type { WeeklyCandidate } from "../engine/types.js";

interface GeneratedWatchlist {
  generatedAt: string;
  source: "weekly-technical-liquidity";
  universeCount: number;
  tickers: string[];
  candidates: WeeklyCandidate[];
  rejected: Record<string, number>;
}

export async function buildWeeklyWatchlist(): Promise<GeneratedWatchlist> {
  const candidates: WeeklyCandidate[] = [];
  const rejected: Record<string, number> = {};

  for (const ticker of universe as string[]) {
    try {
      const candles = await fetchDaily(ticker, C.rangeYears);
      const result = evaluateWeeklyCandidate(ticker, candles);

      if (result.candidate) {
        candidates.push(result.candidate);
      } else if (result.rejectReason) {
        rejected[result.rejectReason] = (rejected[result.rejectReason] ?? 0) + 1;
      }
    } catch (error) {
      rejected.provider_error = (rejected.provider_error ?? 0) + 1;
      console.error(`weekly skip ${ticker}:`, (error as Error).message);
    }

    await sleep(C.requestDelayMs);
  }

  candidates.sort((a, b) => b.score - a.score);

  const selected = candidates.slice(0, C.weekly.topN);

  return {
    generatedAt: new Date().toISOString(),
    source: "weekly-technical-liquidity",
    universeCount: (universe as string[]).length,
    tickers: selected.map((candidate) => candidate.ticker),
    candidates: selected,
    rejected,
  };
}

async function main(): Promise<void> {
  const outputPath = resolve(process.cwd(), C.generatedWatchlistPath);
  const watchlist = await buildWeeklyWatchlist();

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(watchlist, null, 2)}\n`, "utf8");

  console.log({
    outputPath: C.generatedWatchlistPath,
    universe: watchlist.universeCount,
    selected: watchlist.tickers.length,
    rejected: watchlist.rejected,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error("weekly_failed", error);
    process.exitCode = 1;
  });
}
