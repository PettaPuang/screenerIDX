import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import universe from "../universe/idx.json" with { type: "json" };
import { CONFIG as C } from "../config.js";
import { fetchDaily } from "../providers/yahoo.js";
import { sleep } from "../utils/time.js";
import type { Candle } from "../engine/types.js";

interface BacktestSnapshot {
  generatedAt: string;
  range: string;
  universeCount: number;
  tickers: Record<string, Candle[]>;
}

export async function buildBacktestSnapshot(): Promise<BacktestSnapshot> {
  const tickers: Record<string, Candle[]> = {};

  for (const ticker of universe as string[]) {
    try {
      const candles = await fetchDaily(ticker, C.backtest.years);

      if (candles.length) {
        tickers[ticker] = candles;
      }
    } catch (error) {
      console.error(`snapshot skip ${ticker}:`, (error as Error).message);
    }

    await sleep(C.requestDelayMs);
  }

  return {
    generatedAt: new Date().toISOString(),
    range: C.backtest.years,
    universeCount: (universe as string[]).length,
    tickers,
  };
}

async function main(): Promise<void> {
  const outputPath = resolve(process.cwd(), C.backtest.snapshotPath);
  const snapshot = await buildBacktestSnapshot();

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  console.log({
    snapshotPath: C.backtest.snapshotPath,
    tickers: Object.keys(snapshot.tickers).length,
    range: snapshot.range,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error("snapshot_failed", error);
    process.exitCode = 1;
  });
}
